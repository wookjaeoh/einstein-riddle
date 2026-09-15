import { LABELS, labelOf } from "./puzzle-data.js";
import { createGameState } from "./state.js";
import { bindDragDrop } from "./drag-drop.js";
import { renderClues } from "./clues.js";
import { grade } from "./validate.js";
import { generatePuzzle } from "./generate.js";
import { createTextScale } from "./text-scale.js";

const game = createGameState();
const textScale = createTextScale({ storage: localStorage });

const HELP_TEXT = {
  easy: "카드를 집의 칸으로 끌어다 놓고, 단서를 눌러 읽음 표시를 하세요. 힌트는 아래 버튼으로 확인할 수 있습니다.",
  normal: "동물 카테고리가 추가됩니다. 단서를 연결해 추론해 보세요.",
  hard: "다섯 채의 집과 모든 카테고리입니다. 단서를 꼼꼼히 연결하세요.",
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
        ${v ? `<span class="card" draggable="false" data-value="${v}" data-category="${cat}">${labelOf(v)}</span>` : ""}
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
      html += `<span class="card" data-value="${v}" data-category="${cat}">${labelOf(v)}</span>`;
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

  list.innerHTML = revealed.map((hint) => `<li>${hint.text}</li>`).join("");

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
  document.getElementById("btn-undo").disabled = !game.canUndo();
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
  onDrop({ value, category, to }) {
    game.moveCard({ value, category, from: resolveFrom(value, category), to });
    renderAll();
  },
});

document.getElementById("btn-undo").onclick = () => {
  game.undo();
  renderAll();
};

document.getElementById("btn-reset").onclick = () => {
  if (!confirm("배치만 초기화할까요? (타이머·힌트·읽음은 유지)")) return;
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

function startNewPuzzle() {
  const difficulty = document.getElementById("difficulty").value;
  updateHelpText(difficulty);
  const button = document.getElementById("btn-new");
  const feedback = document.getElementById("feedback");
  button.disabled = true;
  feedback.className = "feedback";
  feedback.textContent = "문제 만드는 중…";

  requestAnimationFrame(() => {
    const puzzle = generatePuzzle(difficulty);
    game.loadPuzzle(puzzle);
    renderAll();
    button.disabled = false;
    feedback.className = "feedback";
    feedback.textContent = puzzle.meta.usedFallback
      ? "기본 문제로 시작합니다."
      : `새 문제 (단서 ${puzzle.meta.clueCount}개)`;
  });
}

document.getElementById("btn-new").onclick = () => {
  if (!confirm("새 문제를 만들까요? 진행 중 배치는 사라집니다.")) return;
  startNewPuzzle();
};

document.getElementById("difficulty").onchange = () => {
  const select = document.getElementById("difficulty");
  if (!confirm("난이도를 바꾸면 새 문제가 만들어집니다. 계속할까요?")) {
    select.value = game.getDifficulty();
    return;
  }
  startNewPuzzle();
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
    fb.textContent = `정답입니다! 소요 시간 ${formatMs(game.getElapsedMs())}`;
    fb.classList.add("ok");
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

applyTextScale();
startNewPuzzle();
