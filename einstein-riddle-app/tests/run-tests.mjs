import {
  CATEGORIES,
  VALUES,
  FALLBACK_ANSWER,
  FALLBACK_CLUES,
  HOUSES,
  DIFFICULTY_PROFILES,
  PROFILE_FALLBACKS,
} from "../js/puzzle-data.js";
import * as solver from "../js/solver.js";
import { generatePuzzle } from "../js/generate.js";
import { buildHints, validateHints } from "../js/hints.js";
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

function puzzleSolverOptions(puzzle) {
  return {
    houseCount: puzzle.houseCount,
    categories: puzzle.categories,
    values: puzzle.values,
  };
}

for (const id of ["easy", "normal", "hard", "expert"]) {
  const puzzle = generatePuzzle(id, { timeLimitMs: 2500, random: seededRandom(11 + id.length) });
  const profile = DIFFICULTY_PROFILES[id];
  assert(puzzle.houseCount === profile.houseCount, `${id} generated house count`);
  assert(
    JSON.stringify(puzzle.categories) === JSON.stringify(profile.categories),
    `${id} categories`,
  );
  assert(
    solver.isUniqueSolution(puzzle.clues, puzzleSolverOptions(puzzle)),
    `${id} unique`,
  );
  assert(
    solver.answerSatisfiesClues(puzzle.answer, puzzle.clues, puzzleSolverOptions(puzzle)),
    `${id} answer satisfies clues`,
  );
  assert(Array.isArray(puzzle.hints) && puzzle.hints.length >= 6, `${id} has multiple hint bundles`);
  assert(puzzle.difficulty === id, `${id} difficulty field`);
  assert(
    validateHints({
      hints: puzzle.hints,
      clues: puzzle.clues,
      answer: puzzle.answer,
      houseCount: puzzle.houseCount,
      categories: puzzle.categories,
    }),
    `${id} hints validate against answer and clue indices`,
  );
  assert(new Set(puzzle.hints.map((hint) => hint.id)).size === puzzle.hints.length, `${id} hint ids unique`);
}

const easy = generatePuzzle("easy", { timeLimitMs: 2500, random: seededRandom(7) });
assert(!easy.categories.includes("animal"), "easy excludes animal");
assert(!("animal" in easy.answer), "easy answer excludes animal");
assert(Object.values(easy.values).every((row) => row.length === 4), "easy selects four values");
assert(easy.hints.length >= 6, "easy has at least two hint bundles");
assert(easy.hints[0].stage === "direction", "first hint direction");
assert(easy.hints[1].stage === "clues", "second hint clue guidance");
assert(easy.hints[2].stage === "fact", "third hint fact");
assert(
  easy.hints[1].meta?.clueIndices?.every(
    (index) => Number.isInteger(index) && index >= 1 && index <= easy.clues.length,
  ),
  "hint clue indices are valid",
);
assert(
  easy.hints[2].meta?.val === easy.answer[easy.hints[2].meta.cat]?.[easy.hints[2].meta.houseIndex],
  "hint fact matches answer placement",
);
assert(
  easy.hints[1].text.includes("번") && !easy.hints[1].text.includes("2번과 5번"),
  "hint clue numbers come from generated puzzle",
);

const hard = generatePuzzle("hard", { timeLimitMs: 2500, random: seededRandom(9) });
const expert = generatePuzzle("expert", { timeLimitMs: 2500, random: seededRandom(13) });
assert(hard.hints.length >= 9, "hard has at least three hint bundles");
assert(hard.meta.usedFallback || hard.clues.length === 15, "non-fallback hard has 15 clues");
assert(
  expert.meta.usedFallback ||
    (expert.clues.length >= 12 && expert.clues.length <= 14),
  "non-fallback expert has 12-14 clues",
);
assert(hard.clues.length > expert.clues.length, "hard always has more clues than expert");
assert(
  PROFILE_FALLBACKS.hard.clues.length > PROFILE_FALLBACKS.expert.clues.length,
  "hard fallback has more clues than expert fallback",
);
assert(
  PROFILE_FALLBACKS.expert.clues.length >= 12 &&
    PROFILE_FALLBACKS.expert.clues.length <= 14,
  "expert fallback stays within 12-14 clues",
);

const timeoutStarted = Date.now();
const timedOutPuzzle = generatePuzzle("hard", { timeLimitMs: 0, random: seededRandom(1) });
assert(timedOutPuzzle.meta.usedFallback, "expired generation budget uses fallback");
assert(Date.now() - timeoutStarted < 500, "expired generation budget returns promptly");
assert(
  solver.isUniqueSolution(timedOutPuzzle.clues, puzzleSolverOptions(timedOutPuzzle)),
  "fallback result is verified unique",
);
assert(timedOutPuzzle.houseCount === 5, "hard fallback keeps profile house count");

const easyTimeout = generatePuzzle("easy", { timeLimitMs: 0, random: seededRandom(2) });
assert(easyTimeout.meta.usedFallback, "easy expired budget uses fallback");
assert(easyTimeout.houseCount === 4, "easy fallback keeps profile house count");
assert(!easyTimeout.categories.includes("animal"), "easy fallback excludes animal");

const expertTimeout = generatePuzzle("expert", { timeLimitMs: 0, random: seededRandom(3) });
assert(expertTimeout.meta.usedFallback, "expert expired budget uses fallback");
assert(
  expertTimeout.clues.length >= 12 && expertTimeout.clues.length <= 14,
  "expert fallback clue count in range",
);
assert(
  timedOutPuzzle.clues.length > expertTimeout.clues.length,
  "hard fallback beats expert fallback clue count",
);

assert(typeof buildHints === "function", "buildHints export exists");
assert(typeof validateHints === "function", "validateHints export exists");

testTeacherRefresh();
testTeacherRefreshOnPlacementChange();
testDragCancelCleanup();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
