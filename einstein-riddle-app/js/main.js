import {
  CATEGORIES,
  HOUSES,
  VALUES,
  LABELS,
  labelOf,
  FALLBACK_ANSWER,
  FALLBACK_CLUES,
} from "./puzzle-data.js";
import { createGameState } from "./state.js";

const game = createGameState();

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
  document.getElementById("btn-undo").disabled = !game.canUndo();
}

game.loadPuzzle({ answer: FALLBACK_ANSWER, clues: FALLBACK_CLUES, difficulty: "easy" });
renderAll();
