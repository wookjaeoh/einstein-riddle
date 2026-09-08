import {
  CATEGORIES,
  VALUES,
  FALLBACK_ANSWER,
  FALLBACK_CLUES,
  HOUSES,
  DIFFICULTY_PROFILES,
} from "../js/puzzle-data.js";
import * as solver from "../js/solver.js";
import { generatePuzzle } from "../js/generate.js";
import { bindTeacherPanel } from "../js/teacher.js";
import { createDragDrop } from "../js/drag-drop.js";

let failed = 0;
let passed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`ok: ${message}`);
    return;
  }
  failed++;
  console.error(`FAIL: ${message}`);
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function fakeElement() {
  const listeners = {};
  const classes = new Set(["hidden"]);
  return {
    value: "",
    textContent: "",
    innerHTML: "",
    attributes: {},
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
      toggle(name) {
        if (classes.has(name)) classes.delete(name);
        else classes.add(name);
      },
    },
    addEventListener(type, listener) {
      listeners[type] = listener;
    },
    click() {
      listeners.click?.();
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
  };
}

function testTeacherRefresh() {
  const ids = [
    "teacher-panel",
    "btn-teacher",
    "btn-teacher-unlock",
    "teacher-pw",
    "teacher-error",
    "teacher-body",
    "teacher-login",
    "answer-board",
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, fakeElement()]));
  const previousDocument = globalThis.document;
  globalThis.document = { getElementById: (id) => elements[id] };

  try {
    let answer = structuredClone(FALLBACK_ANSWER);
    const teacher = bindTeacherPanel({
      getPlacement: () => structuredClone(FALLBACK_ANSWER),
      getAnswer: () => answer,
    });
    elements["teacher-pw"].value = "teacher2026";
    elements["btn-teacher-unlock"].click();
    assert(elements["answer-board"].innerHTML.includes("노르웨이"), "teacher initially renders current answer");

    answer = structuredClone(FALLBACK_ANSWER);
    answer.nation[0] = "sweden";
    assert(typeof teacher?.refresh === "function", "teacher binding exposes refresh API");
    teacher?.refresh?.();
    assert(!elements["answer-board"].innerHTML.includes("노르웨이"), "teacher refresh renders new puzzle answer");
  } finally {
    globalThis.document = previousDocument;
  }
}

function testTeacherRefreshOnPlacementChange() {
  const ids = [
    "teacher-panel",
    "btn-teacher",
    "btn-teacher-unlock",
    "teacher-pw",
    "teacher-error",
    "teacher-body",
    "teacher-login",
    "answer-board",
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, fakeElement()]));
  const previousDocument = globalThis.document;
  globalThis.document = { getElementById: (id) => elements[id] };

  try {
    let placement = Object.fromEntries(CATEGORIES.map((cat) => [cat, [null, null, null, null, null]]));
    const teacher = bindTeacherPanel({
      getPlacement: () => placement,
      getAnswer: () => FALLBACK_ANSWER,
    });
    elements["teacher-pw"].value = "teacher2026";
    elements["btn-teacher-unlock"].click();
    assert(
      elements["answer-board"].innerHTML.includes("틀린 칸(비교): 25"),
      "teacher shows all empty cells as wrong",
    );

    placement = structuredClone(FALLBACK_ANSWER);
    teacher.refresh();
    assert(
      elements["answer-board"].innerHTML.includes("틀린 칸(비교): 0"),
      "teacher refresh updates comparison after placement matches answer",
    );

    placement = structuredClone(FALLBACK_ANSWER);
    placement.animal[0] = "dog";
    teacher.refresh();
    assert(
      elements["answer-board"].innerHTML.includes("틀린 칸(비교): 1"),
      "teacher refresh updates comparison after card move",
    );
  } finally {
    globalThis.document = previousDocument;
  }
}

function testDragCancelCleanup() {
  let dropped = false;
  const cardClasses = new Set();
  const poolClasses = new Set();
  const cardListeners = {};
  let ghostNode = null;
  let ghostRemoved = false;

  const ghost = {
    style: {},
    remove() {
      ghostRemoved = true;
    },
  };

  const card = {
    dataset: { value: "norway", category: "nation" },
    classList: {
      add: (...names) => names.forEach((name) => cardClasses.add(name)),
      remove: (...names) => names.forEach((name) => cardClasses.delete(name)),
      contains: (name) => cardClasses.has(name),
    },
    closest(selector) {
      return selector === ".card" ? this : null;
    },
    cloneNode() {
      ghostNode = ghost;
      return ghost;
    },
    setPointerCapture() {},
    releasePointerCapture() {},
    addEventListener(type, listener) {
      cardListeners[type] = listener;
    },
    removeEventListener(type, listener) {
      if (cardListeners[type] === listener) delete cardListeners[type];
    },
  };

  const rootEl = {
    listeners: {},
    addEventListener(type, listener) {
      this.listeners[type] = listener;
    },
  };
  const poolEl = {
    classList: {
      add: (...names) => names.forEach((name) => poolClasses.add(name)),
      remove: (...names) => names.forEach((name) => poolClasses.delete(name)),
      contains: (name) => poolClasses.has(name),
    },
  };
  const body = {
    children: [],
    appendChild(node) {
      this.children.push(node);
    },
  };
  const fakeDocument = {
    body,
    querySelectorAll() {
      return [];
    },
    elementFromPoint() {
      return null;
    },
  };
  const fakeWindow = {
    listeners: {},
    addEventListener(type, listener) {
      this.listeners[type] = listener;
    },
  };

  const dragDrop = createDragDrop({
    boardEl: {},
    poolEl,
    onDrop: () => {
      dropped = true;
    },
    rootEl,
    targetDocument: fakeDocument,
    targetWindow: fakeWindow,
  });
  dragDrop.bind();

  rootEl.listeners.pointerdown({
    preventDefault() {},
    target: card,
    clientX: 10,
    clientY: 20,
    pointerId: 1,
  });
  assert(dragDrop.isDragging(), "drag starts on pointerdown");
  assert(dragDrop.hasGhost(), "ghost is created while dragging");
  assert(cardClasses.has("dragging"), "card gets dragging class");

  fakeWindow.listeners.pointercancel({ pointerId: 1, clientX: 10, clientY: 20 });
  assert(!dragDrop.isDragging(), "pointercancel ends drag session");
  assert(!dragDrop.hasGhost(), "pointercancel removes ghost");
  assert(ghostRemoved, "pointercancel calls ghost.remove");
  assert(!cardClasses.has("dragging"), "pointercancel clears dragging class");
  assert(!dropped, "pointercancel does not invoke onDrop");

  dropped = false;
  ghostRemoved = false;
  cardClasses.clear();
  rootEl.listeners.pointerdown({
    preventDefault() {},
    target: card,
    clientX: 30,
    clientY: 40,
    pointerId: 2,
  });
  cardListeners.lostpointercapture?.({ pointerId: 2 });
  assert(!dragDrop.isDragging(), "lostpointercapture ends drag session");
  assert(!dragDrop.hasGhost(), "lostpointercapture removes ghost");
  assert(ghostRemoved, "lostpointercapture calls ghost.remove");
  assert(!cardClasses.has("dragging"), "lostpointercapture clears dragging class");
  assert(!dropped, "lostpointercapture does not invoke onDrop");
}

const expectedProfiles = {
  easy: { houseCount: 4, categories: ["color", "nation", "drink", "food"] },
  normal: { houseCount: 4, categories: ["color", "nation", "drink", "food", "animal"] },
  hard: { houseCount: 5, categories: CATEGORIES },
  expert: { houseCount: 5, categories: CATEGORIES },
};
for (const [id, expected] of Object.entries(expectedProfiles)) {
  assert(DIFFICULTY_PROFILES[id].houseCount === expected.houseCount, `${id} house count`);
  assert(
    JSON.stringify(DIFFICULTY_PROFILES[id].categories) === JSON.stringify(expected.categories),
    `${id} categories`,
  );
}
assert(
  solver.countSolutions([], {
    limit: 2,
    houseCount: 4,
    categories: ["color"],
    values: { color: ["yellow", "blue", "red", "green"] },
  }) === 2,
  "variable solver supports 4 houses",
);

assert(HOUSES.length === 5, "5 houses");
assert(CATEGORIES.every((cat) => VALUES[cat].length === 5), "5 values per category");
assert(solver.countSolutions([], { limit: 2 }) === 2, "no clues reach solution limit");
assert(solver.isUniqueSolution(FALLBACK_CLUES), "fallback clues have one solution");

let abortChecks = 0;
const aborted = solver.countSolutions([], {
  limit: 2,
  shouldAbort: () => ++abortChecks >= 10,
});
assert(
  "SOLVER_ABORTED" in solver && aborted === solver.SOLVER_ABORTED,
  "solver reports cancellation explicitly",
);

const unknownClue = { id: "unknown", kind: "teleports", cat: "nation", val: "norway" };
const malformedClue = { id: "malformed", kind: "atHouse", cat: "nation", val: "unknown", houseIndex: 0 };
assert(solver.countSolutions([unknownClue]) === 0, "unknown clue fails closed");
assert(!solver.isUniqueSolution([unknownClue]), "unknown clue is never unique");
assert(solver.countSolutions([malformedClue]) === 0, "malformed clue fails closed");
assert(
  typeof solver.answerSatisfiesClues === "function" &&
    solver.answerSatisfiesClues(FALLBACK_ANSWER, FALLBACK_CLUES),
  "fallback answer satisfies every clue",
);
assert(
  typeof solver.answerSatisfiesClues === "function" &&
    !solver.answerSatisfiesClues(FALLBACK_ANSWER, [unknownClue]),
  "answer validation fails closed for unknown clue",
);

const timeoutStarted = Date.now();
const timedOutPuzzle = generatePuzzle("hard", { timeLimitMs: 0, random: seededRandom(1) });
assert(timedOutPuzzle.meta.usedFallback, "expired generation budget uses fallback");
assert(Date.now() - timeoutStarted < 500, "expired generation budget returns promptly");
assert(solver.isUniqueSolution(timedOutPuzzle.clues), "fallback result is verified unique");

const easy = generatePuzzle("easy", { random: seededRandom(7) });
const hard = generatePuzzle("hard", { random: seededRandom(7) });
for (const [difficulty, puzzle] of [["easy", easy], ["hard", hard]]) {
  assert(solver.isUniqueSolution(puzzle.clues), `${difficulty} result is unique including fallback`);
  assert(
    typeof solver.answerSatisfiesClues === "function" &&
      solver.answerSatisfiesClues(puzzle.answer, puzzle.clues),
    `${difficulty} answer satisfies all returned clues`,
  );
}
assert(easy.meta.usedFallback || easy.clues.length === 15, "non-fallback easy has 15 clues");
assert(hard.meta.usedFallback || hard.clues.length <= 14, "non-fallback hard has at most 14 clues");
if (!easy.meta.usedFallback && !hard.meta.usedFallback) {
  assert(hard.clues.length < easy.clues.length, "non-fallback hard has strictly fewer clues than easy");
}

testTeacherRefresh();
testTeacherRefreshOnPlacementChange();
testDragCancelCleanup();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
