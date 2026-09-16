import { LABELS, labelOf, formatCardLabel } from "./puzzle-data.js";
import { createGameState } from "./state.js";
import { bindDragDrop } from "./drag-drop.js";
import { renderClues } from "./clues.js";
import { grade } from "./validate.js";
import { generatePuzzle } from "./generate.js";
import { createTextScale } from "./text-scale.js";
import { buildAnswerFillQueue, shouldContinueReveal } from "./answer-fill.js";
import { bindAuthUi, updateIntroAuthLabel } from "./auth.js";
import { bindRankingUi, openCelebrateRegister } from "./rankings.js";

const game = createGameState();
const textScale = createTextScale({ storage: localStorage });
let revealGeneration = 0;
let selectedDifficulty = null;

const DIFFICULTY_LABELS = {
  easy: "쉬움",
  normal: "보통",
  hard: "어려움",
  expert: "매우 어려움",
};

const HELP_TEXT = {
  easy: "카드를 한 번 클릭해 집고, 칸을 다시 클릭해 놓으세요. 단서를 눌러 읽음 표시를 하세요. 힌트는 아래 버튼으로 확인할 수 있습니다.",
  normal: "동물 카테고리가 추가됩니다. 카드를 클릭으로 집고 칸에 놓으며 단서를 연결해 보세요.",
  hard: "다섯 채의 집과 모든 카테고리입니다. 클릭으로 카드를 배치하며 단서를 꼼꼼히 연결하세요.",
  expert: "단서가 더 적습니다. 힌트를 아껴 쓰며 깊게 추론해 보세요.",
};

function updateHelpText(difficulty) {
  const el = document.getElementById("help-easy");
  if (el) el.textContent = HELP_TEXT[difficulty] ?? HELP_TEXT.easy;
}

function formatMs(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function updateScaleControls() {
  const value = textScale.get();
  document.getElementById("scale-value").textContent = `${value}%`;
  document.getElementById("scale-down").disabled = !textScale.canDecrease();
  document.getElementById("scale-up").disabled = !textScale.canIncrease();
}

function applyTextScale() {
  textScale.apply(document.documentElement);
  updateScaleControls();
}

setInterval(() => {
  document.getElementById("timer").textContent = formatMs(game.getElapsedMs());
}, 250);

function renderBoard() {
  const board = document.getElementById("board");
  const puzzle = game.getPuzzle();
  if (!puzzle) {
    board.innerHTML = "";
    return;
  }

  const { houseCount, categories } = puzzle;
  const placement = game.getPlacement();
  document.documentElement.style.setProperty("--house-count", String(houseCount));
  board.setAttribute("aria-label", `${houseCount}채의 집`);

  const tagline = document.getElementById("tagline");
  if (tagline) {
    tagline.textContent = `단서를 읽고 ${houseCount}채의 집 배치를 맞혀 보세요`;
  }

  const badge = document.getElementById("difficulty-badge");
  if (badge) {
    const current = game.getDifficulty();
    badge.textContent = DIFFICULTY_LABELS[current] ?? current;
    badge.dataset.difficulty = current;
  }

  let html = `<div class="row-label"></div>`;
  for (let h = 1; h <= houseCount; h++) {
    const colorId = placement.color?.[h - 1];
    const colorName = colorId ? labelOf(colorId) : "색 미정";
    html += `<div class="house-head" data-house="${h}">
      <span>${h}번 집</span>
      <span class="house-swatch ${colorId ? "color-" + colorId : ""}"></span>
      <small>${colorName}</small>
    </div>`;
  }

  for (const cat of categories) {
    html += `<div class="row-label">${LABELS[cat]}</div>`;
    for (let i = 0; i < houseCount; i++) {
      const v = placement[cat][i];
      html += `<div class="slot" data-house-index="${i}" data-category="${cat}">
        ${v ? `<span class="card" draggable="false" data-value="${v}" data-category="${cat}">${formatCardLabel(v)}</span>` : ""}
      </div>`;
    }
  }
  board.innerHTML = html;
}

function renderPool() {
  const pool = document.getElementById("pool");
  const puzzle = game.getPuzzle();
  if (!puzzle) {
    pool.innerHTML = "";
    return;
  }

  const placement = game.getPlacement();
  const used = new Set(puzzle.categories.flatMap((c) => placement[c].filter(Boolean)));
  let html = "";
  for (const cat of puzzle.categories) {
    for (const v of puzzle.values[cat]) {
      if (used.has(v)) continue;
      html += `<span class="card" data-value="${v}" data-category="${cat}">${formatCardLabel(v)}</span>`;
    }
  }
  pool.innerHTML = html || "<span>모든 카드가 배치되었습니다</span>";
}

function renderHints() {
  const list = document.getElementById("hint-list");
  const status = document.getElementById("hint-status");
  const button = document.getElementById("btn-hint");
  const revealed = game.getRevealedHints();
  const puzzle = game.getPuzzle();
  const total = puzzle?.hints?.length ?? 0;

  list.innerHTML = revealed.map((hint) => {
    const reasoning = Array.isArray(hint.reasoning) && hint.reasoning.length
      ? `<div class="hint-reasoning">${hint.reasoning.map((line) => escapeHtml(line)).join("<br>")}</div>`
      : "";
    return `<li><div class="hint-text">${escapeHtml(hint.text)}</div>${reasoning}</li>`;
  }).join("");

  if (!total) {
    status.textContent = "";
    button.disabled = true;
    return;
  }

  if (revealed.length >= total) {
    status.textContent = "모든 힌트를 확인했습니다.";
    button.disabled = true;
  } else {
    status.textContent = `힌트 ${revealed.length} / ${total}`;
    button.disabled = false;
  }
}

function renderAll() {
  renderBoard();
  renderPool();
  const clues = game.getClues();
  const readIds = new Set(clues.filter((c) => game.isClueRead(c.id)).map((c) => c.id));
  renderClues({
    container: document.getElementById("clues"),
    clues,
    readIds,
    onToggleRead(id) {
      game.toggleClueRead(id);
      renderAll();
    },
  });
  renderHints();
  updateLockedControls();
}

function updateLockedControls() {
  const locked = game.isInteractionLocked();
  document.getElementById("btn-undo").disabled = locked || !game.canUndo();
  document.getElementById("btn-reset").disabled = locked;
  document.getElementById("btn-submit").disabled = locked;
  document.getElementById("btn-hint").disabled =
    locked || document.getElementById("btn-hint").disabled;
  document.getElementById("btn-reveal-answer").disabled = locked;
}

function resolveFrom(value, category) {
  const slotIdx = game.getPlacement()[category].indexOf(value);
  return slotIdx >= 0
    ? { type: "slot", category, houseIndex: slotIdx }
    : { type: "pool" };
}

bindDragDrop({
  boardEl: document.getElementById("board"),
  poolEl: document.getElementById("pool"),
  isLocked: () => game.isInteractionLocked(),
  onDrop({ value, category, to }) {
    if (game.isInteractionLocked()) return;
    game.moveCard({ value, category, from: resolveFrom(value, category), to });
    renderAll();
  },
});

document.getElementById("btn-undo").onclick = () => {
  game.undo();
  renderAll();
};

document.getElementById("btn-reset").onclick = () => {
  game.resetPlacement({ keepTimer: true });
  renderAll();
  document.getElementById("feedback").textContent = "";
};

document.getElementById("btn-hint").onclick = () => {
  const next = game.revealNextHint();
  if (!next) {
    document.getElementById("hint-status").textContent = "모든 힌트를 확인했습니다.";
    document.getElementById("btn-hint").disabled = true;
    return;
  }
  renderHints();
};

async function flyCardToSlot(step) {
  const destination = document.querySelector(
    `.slot[data-house-index="${step.houseIndex}"][data-category="${step.category}"]`,
  );
  if (!destination) return;

  const source = document.querySelector(
    `.card[data-value="${step.value}"][data-category="${step.category}"]`,
  );
  const targetRect = destination.getBoundingClientRect();
  const sourceRect = source?.getBoundingClientRect() ?? {
    left: targetRect.left,
    top: Math.max(0, targetRect.top - 80),
    width: targetRect.width,
    height: targetRect.height,
  };
  const ghost = source?.cloneNode(true) ?? document.createElement("span");
  if (!source) {
    ghost.className = "card";
    ghost.textContent = formatCardLabel(step.value);
  }
  ghost.classList.add("answer-fly-ghost");
  Object.assign(ghost.style, {
    left: `${sourceRect.left}px`,
    top: `${sourceRect.top}px`,
    width: `${sourceRect.width}px`,
    minHeight: `${sourceRect.height}px`,
    margin: "0",
  });
  document.body.appendChild(ghost);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  ghost.style.transform = `translate(${targetRect.left - sourceRect.left}px, ${targetRect.top - sourceRect.top}px)`;
  ghost.style.opacity = "0.25";
  await wait(400);
  ghost.remove();
}

async function animateAnswerFill(queue, session) {
  for (const step of queue) {
    if (!shouldContinueReveal(session, revealGeneration)) return false;
    await flyCardToSlot(step);
    if (!shouldContinueReveal(session, revealGeneration)) return false;
    game.setCellToAnswer(step.category, step.houseIndex);
    renderBoard();
    renderPool();
    await wait(150);
    if (!shouldContinueReveal(session, revealGeneration)) return false;
  }
  return true;
}

document.getElementById("btn-reveal-answer").onclick = async () => {
  if (game.isInteractionLocked()) return;
  const confirmed = await askGiveUpConfirm();
  if (!confirmed) return;
  game.resetTimer();
  document.getElementById("timer").textContent = formatMs(0);
  game.lockInteraction();
  updateLockedControls();
  document.body.classList.add("interaction-locked");
  const puzzle = game.getPuzzle();
  const session = ++revealGeneration;
  const queue = buildAnswerFillQueue(
    game.getPlacement(),
    game.getAnswer(),
    puzzle.categories,
  );
  const completed = await animateAnswerFill(queue, session);
  if (!shouldContinueReveal(session, revealGeneration)) return;
  if (!completed) return;
  game.applyFullAnswer();
  renderAll();
  const fb = document.getElementById("feedback");
  fb.className = "feedback";
  fb.textContent = "포기했습니다. 정답을 표시합니다.";
};

function askGiveUpConfirm() {
  const modal = document.getElementById("giveup-modal");
  const yesBtn = document.getElementById("giveup-yes");
  const noBtn = document.getElementById("giveup-no");
  return new Promise((resolve) => {
    function close(result) {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
      yesBtn.removeEventListener("click", onYes);
      noBtn.removeEventListener("click", onNo);
      modal.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKey);
      resolve(result);
    }
    function onYes() {
      close(true);
    }
    function onNo() {
      close(false);
    }
    function onBackdrop(e) {
      if (e.target.matches("[data-giveup-cancel]")) close(false);
    }
    function onKey(e) {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter") close(true);
    }
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    yesBtn.addEventListener("click", onYes);
    noBtn.addEventListener("click", onNo);
    modal.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKey);
    yesBtn.focus();
  });
}

function startNewPuzzle({ autoStartTimer = false } = {}) {
  revealGeneration += 1;
  const difficulty = selectedDifficulty ?? game.getDifficulty();
  updateHelpText(difficulty);
  const button = document.getElementById("btn-new");
  const feedback = document.getElementById("feedback");
  button.disabled = true;
  feedback.className = "feedback";
  feedback.textContent = "문제 만드는 중…";

  requestAnimationFrame(() => {
    const puzzle = generatePuzzle(difficulty);
    game.loadPuzzle(puzzle);
    document.body.classList.remove("interaction-locked");
    renderAll();
    button.disabled = false;
    feedback.className = "feedback";
    feedback.textContent = puzzle.meta.usedFallback
      ? "기본 문제로 시작합니다."
      : `새 문제 (단서 ${puzzle.meta.clueCount}개)`;
    if (autoStartTimer) {
      game.ensureTimerStarted();
      document.getElementById("timer").textContent = formatMs(game.getElapsedMs());
    }
  });
}

function showScreen(name) {
  const intro = document.getElementById("screen-intro");
  const howto = document.getElementById("screen-howto");
  const gameScreen = document.getElementById("screen-game");
  const scale = document.getElementById("scale-controls");
  const isIntro = name === "intro";
  const isHowto = name === "howto";
  const isGame = name === "game";

  intro.classList.toggle("hidden", !isIntro);
  intro.toggleAttribute("hidden", !isIntro);
  howto.classList.toggle("hidden", !isHowto);
  howto.toggleAttribute("hidden", !isHowto);
  gameScreen.classList.toggle("hidden", !isGame);
  gameScreen.toggleAttribute("hidden", !isGame);
  scale.classList.toggle("hidden", !isGame);
  scale.toggleAttribute("hidden", !isGame);

  document.body.classList.toggle("on-intro", isIntro);
  document.body.classList.toggle("on-howto", isHowto);
  document.body.classList.toggle("on-game", isGame);
}

function setSelectedDifficulty(difficulty) {
  selectedDifficulty = difficulty;
  for (const button of document.querySelectorAll("#difficulty-choices .difficulty-dot")) {
    const isActive = button.dataset.difficulty === difficulty;
    button.classList.toggle("is-selected", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  }
  const status = document.getElementById("howto-status");
  if (status) {
    status.classList.remove("is-warning");
    status.textContent = `${DIFFICULTY_LABELS[difficulty]} 난이도로 시작합니다.`;
  }
}

document.getElementById("difficulty-choices").addEventListener("click", (event) => {
  const button = event.target.closest(".difficulty-dot");
  if (!button) return;
  setSelectedDifficulty(button.dataset.difficulty);
});

document.getElementById("btn-intro-start").onclick = () => {
  showScreen("howto");
};

document.getElementById("btn-howto-back").onclick = () => {
  showScreen("intro");
};

document.getElementById("btn-howto-start").onclick = () => {
  if (!selectedDifficulty) {
    const status = document.getElementById("howto-status");
    status.textContent = "난이도를 먼저 선택해 주세요.";
    status.classList.add("is-warning");
    document.getElementById("difficulty-choices").classList.remove("needs-pick");
    requestAnimationFrame(() => {
      document.getElementById("difficulty-choices").classList.add("needs-pick");
    });
    return;
  }
  showScreen("game");
  startNewPuzzle({ autoStartTimer: true });
};

document.getElementById("btn-game-back").onclick = () => {
  game.stopTimer();
  showScreen("howto");
};

document.getElementById("btn-new").onclick = () => {
  if (!confirm("새 문제를 만들까요? 진행 중 배치는 사라집니다.")) return;
  startNewPuzzle({ autoStartTimer: true });
};

document.getElementById("btn-submit").onclick = () => {
  const puzzle = game.getPuzzle();
  const result = grade(game.getPlacement(), game.getAnswer(), puzzle?.categories);
  const fb = document.getElementById("feedback");
  fb.className = "feedback";
  if (!result.complete) {
    fb.textContent = "모든 칸에 카드를 배치한 뒤 제출해 주세요.";
    fb.classList.add("bad");
    return;
  }
  game.stopTimer();
  if (result.solved) {
    const ms = game.getElapsedMs();
    fb.textContent = `정답입니다! 소요 시간 ${formatMs(ms)}`;
    fb.classList.add("ok");
    openCelebrateRegister({
      elapsedMs: ms,
      difficulty: game.getDifficulty(),
      formatMs,
    });
  } else {
    fb.textContent = `틀린 칸 수 = ${result.wrongCount}`;
    fb.classList.add("bad");
  }
};

document.getElementById("scale-up").onclick = () => {
  textScale.increase();
  applyTextScale();
};

document.getElementById("scale-down").onclick = () => {
  textScale.decrease();
  applyTextScale();
};

bindAuthUi();
bindRankingUi({
  getDifficulty: () => game.getDifficulty(),
  formatMs,
});
updateIntroAuthLabel();

applyTextScale();
showScreen("intro");
