import { CATEGORIES, VALUES } from "./puzzle-data.js";

const MAX_UNDO = 30;

function emptyPlacement(categories, houseCount) {
  return Object.fromEntries(
    categories.map((c) => [c, Array.from({ length: houseCount }, () => null)]),
  );
}

function clonePlacement(p, categories) {
  return Object.fromEntries(categories.map((c) => [c, [...(p[c] ?? [])]]));
}

function clonePuzzle(puzzle) {
  return {
    houseCount: puzzle.houseCount,
    categories: [...puzzle.categories],
    values: Object.fromEntries(
      puzzle.categories.map((cat) => [cat, [...puzzle.values[cat]]]),
    ),
    answer: structuredClone(puzzle.answer),
    clues: puzzle.clues.map((clue) => structuredClone(clue)),
    hints: (puzzle.hints ?? []).map((hint) => structuredClone(hint)),
    difficulty: puzzle.difficulty,
    meta: puzzle.meta ? structuredClone(puzzle.meta) : undefined,
  };
}

export function createGameState() {
  let puzzle = null;
  let answer = null;
  let clues = [];
  let hints = [];
  let difficulty = "easy";
  let categories = [...CATEGORIES];
  let values = VALUES;
  let houseCount = 5;
  let placement = emptyPlacement(categories, houseCount);
  let history = [];
  let readClueIds = new Set();
  let revealedHintCount = 0;

  let timerStart = null;
  let timerAccum = 0;
  let timerRunning = false;
  let interactionLocked = false;

  function resetTimer() {
    timerStart = null;
    timerAccum = 0;
    timerRunning = false;
  }

  function loadPuzzle(runtimePuzzle) {
    puzzle = clonePuzzle(runtimePuzzle);
    answer = structuredClone(runtimePuzzle.answer);
    clues = runtimePuzzle.clues.map((clue) => structuredClone(clue));
    hints = (runtimePuzzle.hints ?? []).map((hint) => structuredClone(hint));
    difficulty = runtimePuzzle.difficulty ?? "easy";
    categories = [...runtimePuzzle.categories];
    values = Object.fromEntries(
      categories.map((cat) => [cat, [...runtimePuzzle.values[cat]]]),
    );
    houseCount = runtimePuzzle.houseCount;
    placement = emptyPlacement(categories, houseCount);
    history = [];
    readClueIds = new Set();
    revealedHintCount = 0;
    interactionLocked = false;
    resetTimer();
  }

  function getPuzzle() {
    return puzzle ? clonePuzzle(puzzle) : null;
  }

  function getAnswer() {
    return answer ? structuredClone(answer) : null;
  }

  function getClues() {
    return clues.map((clue) => structuredClone(clue));
  }

  function getPlacement() {
    return clonePlacement(placement, categories);
  }

  function getDifficulty() {
    return difficulty;
  }

  function resetPlacement({ keepTimer = false } = {}) {
    if (interactionLocked) return;
    placement = emptyPlacement(categories, houseCount);
    history = [];
    if (!keepTimer) resetTimer();
  }

  function ensureTimerStarted() {
    if (timerRunning) return;
    timerRunning = true;
    timerStart = Date.now();
  }

  function stopTimer() {
    if (!timerRunning) return;
    timerAccum += Date.now() - timerStart;
    timerStart = null;
    timerRunning = false;
  }

  function getElapsedMs() {
    if (timerRunning && timerStart != null) {
      return timerAccum + (Date.now() - timerStart);
    }
    return timerAccum;
  }

  function isTimerRunning() {
    return timerRunning;
  }

  function slotOf(category, value) {
    const row = placement[category] ?? [];
    for (let i = 0; i < houseCount; i++) {
      if (row[i] === value) return i;
    }
    return -1;
  }

  function isInteractionLocked() {
    return interactionLocked;
  }

  function lockInteraction() {
    interactionLocked = true;
  }

  function setCellToAnswer(category, houseIndex) {
    if (!answer) return false;
    if (!categories.includes(category)) return false;
    if (houseIndex < 0 || houseIndex >= houseCount) return false;
    const value = answer[category]?.[houseIndex];
    if (value == null) return false;
    placement[category][houseIndex] = value;
    return true;
  }

  function applyFullAnswer() {
    if (!answer) return;
    placement = clonePlacement(answer, categories);
    history = [];
  }

  function moveCard({ value, category, from, to }) {
    if (interactionLocked) return false;
    if (!answer) return false;
    if (!categories.includes(category)) return false;
    if (!values[category]?.includes(value)) return false;

    if (from.type === "slot") {
      if (from.category !== category) return false;
      if (from.houseIndex < 0 || from.houseIndex >= houseCount) return false;
      if (placement[category][from.houseIndex] !== value) return false;
    } else if (from.type === "pool") {
      if (slotOf(category, value) !== -1) return false;
    } else {
      return false;
    }

    if (to.type === "slot") {
      if (to.category !== category) return false;
      if (to.houseIndex < 0 || to.houseIndex >= houseCount) return false;
    } else if (to.type !== "pool") {
      return false;
    }

    if (
      from.type === "slot" &&
      to.type === "slot" &&
      from.houseIndex === to.houseIndex &&
      from.category === to.category
    ) {
      return false;
    }
    if (from.type === "pool" && to.type === "pool") return false;

    history.push(clonePlacement(placement, categories));
    if (history.length > MAX_UNDO) history.shift();

    ensureTimerStarted();

    if (to.type === "slot") {
      const targetIdx = to.houseIndex;
      const displaced = placement[category][targetIdx];

      if (from.type === "slot") {
        const fromIdx = from.houseIndex;
        placement[category][targetIdx] = value;
        placement[category][fromIdx] = displaced ?? null;
      } else {
        placement[category][targetIdx] = value;
      }
    } else if (from.type === "slot") {
      placement[category][from.houseIndex] = null;
    }

    return true;
  }

  function canUndo() {
    return history.length > 0;
  }

  function undo() {
    if (interactionLocked) return;
    if (!history.length) return;
    placement = history.pop();
  }

  function toggleClueRead(id) {
    if (interactionLocked) return;
    if (readClueIds.has(id)) readClueIds.delete(id);
    else readClueIds.add(id);
  }

  function isClueRead(id) {
    return readClueIds.has(id);
  }

  function getRevealedHints() {
    return hints.slice(0, revealedHintCount).map((hint) => structuredClone(hint));
  }

  function revealNextHint() {
    if (interactionLocked) return null;
    if (revealedHintCount >= hints.length) return null;
    const hint = hints[revealedHintCount];
    revealedHintCount += 1;
    return structuredClone(hint);
  }

  return {
    loadPuzzle,
    getPuzzle,
    getAnswer,
    getClues,
    getPlacement,
    getDifficulty,
    resetPlacement,
    moveCard,
    undo,
    canUndo,
    ensureTimerStarted,
    stopTimer,
    getElapsedMs,
    isTimerRunning,
    toggleClueRead,
    isClueRead,
    revealNextHint,
    getRevealedHints,
    isInteractionLocked,
    lockInteraction,
    setCellToAnswer,
    applyFullAnswer,
  };
}
