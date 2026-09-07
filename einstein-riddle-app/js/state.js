import { CATEGORIES, VALUES } from "./puzzle-data.js";

const MAX_UNDO = 30;

function emptyPlacement() {
  return Object.fromEntries(CATEGORIES.map((c) => [c, [null, null, null, null, null]]));
}

function clonePlacement(p) {
  return Object.fromEntries(CATEGORIES.map((c) => [c, [...p[c]]]));
}

export function createGameState() {
  let answer = null;
  let clues = [];
  let difficulty = "easy";
  let placement = emptyPlacement();
  let history = [];

  let timerStart = null;
  let timerAccum = 0;
  let timerRunning = false;

  function resetTimer() {
    timerStart = null;
    timerAccum = 0;
    timerRunning = false;
  }

  function loadPuzzle({ answer: ans, clues: cls, difficulty: diff }) {
    answer = structuredClone(ans);
    clues = [...cls];
    difficulty = diff ?? "easy";
    placement = emptyPlacement();
    history = [];
    resetTimer();
  }

  function getAnswer() {
    return answer ? structuredClone(answer) : null;
  }

  function getClues() {
    return [...clues];
  }

  function getPlacement() {
    return clonePlacement(placement);
  }

  function getDifficulty() {
    return difficulty;
  }

  function resetPlacement({ keepTimer = false } = {}) {
    placement = emptyPlacement();
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
    const row = placement[category];
    for (let i = 0; i < 5; i++) {
      if (row[i] === value) return i;
    }
    return -1;
  }

  function moveCard({ value, category, from, to }) {
    if (!answer) return false;
    if (!VALUES[category]?.includes(value)) return false;

    if (from.type === "slot") {
      if (from.category !== category) return false;
      if (from.houseIndex < 0 || from.houseIndex > 4) return false;
      if (placement[category][from.houseIndex] !== value) return false;
    } else if (from.type === "pool") {
      if (slotOf(category, value) !== -1) return false;
    } else {
      return false;
    }

    if (to.type === "slot") {
      if (to.category !== category) return false;
      if (to.houseIndex < 0 || to.houseIndex > 4) return false;
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

    history.push(clonePlacement(placement));
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
    if (!history.length) return;
    placement = history.pop();
  }

  return {
    loadPuzzle,
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
  };
}
