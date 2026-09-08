import {
  CATEGORIES,
  VALUES,
  FALLBACK_ANSWER,
  FALLBACK_CLUES,
  HOUSES,
} from "../js/puzzle-data.js";
import * as solver from "../js/solver.js";
import { generatePuzzle } from "../js/generate.js";
import { bindTeacherPanel } from "../js/teacher.js";

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

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
