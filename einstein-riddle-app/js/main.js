import {
  CATEGORIES,
  HOUSES,
  VALUES,
  LABELS,
  labelOf,
} from "./puzzle-data.js";
import { createGameState } from "./state.js";
import { bindDragDrop } from "./drag-drop.js";
import { renderClues, applyHighlight } from "./clues.js";
import { grade } from "./validate.js";
import { bindTeacherPanel } from "./teacher.js";
import { generatePuzzle } from "./generate.js";

const game = createGameState();
let teacherPanel;

function formatMs(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

setInterval(() => {
  document.getElementById("timer").textContent = formatMs(game.getElapsedMs());
}, 250);
let selectedClueId = null;

function renderBoard() {
  const board = document.getElementById("board");
  const placement = game.getPlacement();
  let html = `<div class="row-label"></div>`;
  for (const h of HOUSES) {
    const colorId = placement.color[h - 1];
    const colorName = colorId ? labelOf(colorId) : "색 미정";
    html += `<div class="house-head" data-house="${h}">
      <span>${h}번 집</span>
      <span class="house-swatch ${colorId ? "color-" + colorId : ""}"></span>
      <small>${colorName}</small>
    </div>`;
  }
  for (const cat of CATEGORIES) {
    html += `<div class="row-label">${LABELS[cat]}</div>`;
    for (let i = 0; i < 5; i++) {
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
  const placement = game.getPlacement();
  const used = new Set(CATEGORIES.flatMap((c) => placement[c].filter(Boolean)));
  let html = "";
  for (const cat of CATEGORIES) {
    for (const v of VALUES[cat]) {
      if (used.has(v)) continue;
      html += `<span class="card" data-value="${v}" data-category="${cat}">${labelOf(v)}</span>`;
    }
  }
  pool.innerHTML = html || "<span>모든 카드가 배치되었습니다</span>";
}

function renderAll() {
  renderBoard();
  renderPool();
  const clues = game.getClues();
  renderClues({
    container: document.getElementById("clues"),
    clues,
    selectedId: selectedClueId,
    onSelect(id) {
      selectedClueId = id;
      renderAll();
    },
  });
  applyHighlight(selectedClueId, clues);
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
  if (!confirm("배치만 초기화할까요? (타이머는 유지)")) return;
  game.resetPlacement({ keepTimer: true });
  renderAll();
  document.getElementById("feedback").textContent = "";
};

function startNewPuzzle() {
  const difficulty = document.getElementById("difficulty").value;
  const button = document.getElementById("btn-new");
  const feedback = document.getElementById("feedback");
  button.disabled = true;
  feedback.className = "feedback";
  feedback.textContent = "문제 만드는 중…";

  requestAnimationFrame(() => {
    const puzzle = generatePuzzle(difficulty);
    game.loadPuzzle({ answer: puzzle.answer, clues: puzzle.clues, difficulty });
    selectedClueId = null;
    renderAll();
    teacherPanel.refresh();
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
  const result = grade(game.getPlacement(), game.getAnswer());
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

teacherPanel = bindTeacherPanel({
  getPlacement: () => game.getPlacement(),
  getAnswer: () => game.getAnswer(),
});

startNewPuzzle();
