import {
  CATEGORIES,
  VALUES,
  FALLBACK_ANSWER,
  FALLBACK_CLUES,
  HOUSES,
  DIFFICULTY_PROFILES,
  PROFILE_FALLBACKS,
  ICONS,
  iconOf,
  formatCardLabel,
  labelOf,
} from "../js/puzzle-data.js";
import * as solver from "../js/solver.js";
import { generatePuzzle } from "../js/generate.js";
import { buildHints, validateHints } from "../js/hints.js";
import { createGameState } from "../js/state.js";
import { buildAnswerFillQueue, shouldContinueReveal } from "../js/answer-fill.js";
import { createTextScale } from "../js/text-scale.js";
import { renderClues } from "../js/clues.js";
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

async function assertDomContracts() {
  let html = "";
  let mainSource = "";
  try {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const dirname = path.dirname(fileURLToPath(import.meta.url));
    html = fs.readFileSync(path.join(dirname, "../index.html"), "utf8");
    mainSource = fs.readFileSync(path.join(dirname, "../js/main.js"), "utf8");
  } catch {
    html = await (await fetch("../index.html")).text();
    mainSource = await (await fetch("../js/main.js")).text();
  }
  assert(html.includes('value="normal"'), "normal option exists");
  assert(html.includes('value="expert"'), "expert option exists");
  assert(html.includes('id="btn-hint"'), "hint button exists");
  assert(html.includes('id="btn-reveal-answer"'), "reveal answer button exists");
  assert(html.indexOf('id="btn-hint"') < html.indexOf('id="btn-reveal-answer"'), "reveal button after hint button");
  assert(html.includes('id="scale-up"'), "scale controls exist");
  assert(!html.includes('id="btn-teacher"'), "teacher button removed");
  assert(!mainSource.includes("./teacher.js"), "teacher import removed");
}

await assertDomContracts();

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function testDragCancelCleanup() {
  let dropped = false;
  let dropTo = null;
  let locked = false;
  let cloneCount = 0;
  const cardClasses = new Set();
  const poolClasses = new Set();
  const bodyClasses = new Set();
  let ghostNode = null;
  let ghostRemoved = false;

  const ghost = {
    style: {},
    classList: {
      add() {},
      remove() {},
    },
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
      cloneCount++;
      ghostNode = ghost;
      return ghost;
    },
  };

  const slot = {
    dataset: { category: "nation", houseIndex: "0" },
    closest(selector) {
      return selector === ".slot" ? this : null;
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
    classList: {
      toggle(name, force) {
        if (force) bodyClasses.add(name);
        else bodyClasses.delete(name);
      },
    },
    appendChild(node) {
      this.children.push(node);
    },
  };
  let pointTarget = null;
  const fakeDocument = {
    body,
    querySelectorAll() {
      return [];
    },
    elementFromPoint() {
      return pointTarget;
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
    onDrop: ({ to }) => {
      dropped = true;
      dropTo = to;
    },
    rootEl,
    targetDocument: fakeDocument,
    targetWindow: fakeWindow,
    isLocked: () => locked,
  });
  dragDrop.bind();

  rootEl.listeners.click({
    preventDefault() {},
    target: card,
    clientX: 10,
    clientY: 20,
  });
  assert(dragDrop.isHolding(), "click picks up card");
  assert(dragDrop.hasGhost(), "ghost is created while holding");
  assert(cardClasses.has("picked"), "card gets picked class");
  assert(bodyClasses.has("holding-card"), "body gets holding-card class");

  fakeWindow.listeners.keydown({ key: "Escape" });
  assert(!dragDrop.isHolding(), "Escape cancels holding");
  assert(!dragDrop.hasGhost(), "Escape removes ghost");
  assert(ghostRemoved, "Escape calls ghost.remove");
  assert(!cardClasses.has("picked"), "Escape clears picked class");
  assert(!dropped, "Escape does not invoke onDrop");

  dropped = false;
  ghostRemoved = false;
  cardClasses.clear();
  bodyClasses.clear();
  rootEl.listeners.click({
    preventDefault() {},
    target: card,
    clientX: 30,
    clientY: 40,
  });
  assert(dragDrop.isHolding(), "second pick holds card");
  pointTarget = slot;
  rootEl.listeners.click({
    preventDefault() {},
    target: slot,
    clientX: 50,
    clientY: 60,
  });
  assert(dropped, "click slot places held card");
  assert(dropTo?.type === "slot" && dropTo.houseIndex === 0, "drop targets clicked slot");
  assert(!dragDrop.isHolding(), "place clears holding");
  assert(!dragDrop.hasGhost(), "place removes ghost");

  locked = true;
  const clonesBeforeLocked = cloneCount;
  rootEl.listeners.click({
    preventDefault() {},
    target: card,
    clientX: 70,
    clientY: 80,
  });
  assert(!dragDrop.isHolding(), "locked click does not pick card");
  assert(!dragDrop.hasGhost(), "locked click does not create ghost");
  assert(cloneCount === clonesBeforeLocked, "locked click does not clone card");
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

const reasoningPuzzle = generatePuzzle("easy", { timeLimitMs: 2500, random: seededRandom(21) });
assert(validateHints(reasoningPuzzle), "validateHints accepts puzzle with reasoning");
for (const hint of reasoningPuzzle.hints.filter((h) => h.stage === "fact")) {
  assert(Array.isArray(hint.reasoning), `fact ${hint.id} has reasoning array`);
  assert(hint.reasoning.length >= 2 && hint.reasoning.length <= 3, `fact ${hint.id} reasoning 2-3 steps`);
  assert(hint.reasoning.some((line) => line.includes("단서") && line.includes("「")), `fact ${hint.id} cites clue quote`);
  assert(hint.reasoning.some((line) => /①|1\./.test(line) || line.includes("①")), `fact ${hint.id} numbered steps`);
}

function clueRelatesToFact(clue, factMeta, answer) {
  const placements = [
    clue?.cat && clue?.val ? { cat: clue.cat, val: clue.val } : null,
    clue?.a,
    clue?.b,
  ].filter(Boolean);
  const houseNumber = factMeta.houseIndex + 1;
  return (
    placements.some(
      ({ cat, val }) =>
        val === factMeta.val || answer[cat]?.indexOf(val) === factMeta.houseIndex,
    ) ||
    clue?.houseIndex === factMeta.houseIndex ||
    clue?.houseIds?.includes(houseNumber)
  );
}

function clueMentionsFactValue(clue, factMeta) {
  const placementValues = [
    clue?.cat && clue?.val ? clue.val : null,
    clue?.a?.val,
    clue?.b?.val,
  ].filter(Boolean);
  return clue?.values?.includes(factMeta.val) || placementValues.includes(factMeta.val);
}

function assertFactCitationsRelate(puzzle, label) {
  for (const hint of puzzle.hints.filter((candidate) => candidate.stage === "fact")) {
    const citedNumbers = hint.reasoning.flatMap((line) =>
      [...line.matchAll(/단서\s+(\d+)/g)].map((match) => Number(match[1])),
    );
    assert(citedNumbers.length >= 1, `${label} ${hint.id} cites at least one clue`);
    assert(
      citedNumbers.every((number) =>
        clueRelatesToFact(puzzle.clues[number - 1], hint.meta, puzzle.answer),
      ),
      `${label} ${hint.id} cites only clues related to its fact`,
    );
    const directCluesExist = puzzle.clues.some((clue) => clueMentionsFactValue(clue, hint.meta));
    assert(
      !directCluesExist ||
        citedNumbers.some((number) => clueMentionsFactValue(puzzle.clues[number - 1], hint.meta)),
      `${label} ${hint.id} cites a clue that directly mentions its fact value when available`,
    );
  }
}

assertFactCitationsRelate(reasoningPuzzle, "generated reasoning");

const fallbackReasoningPuzzle = {
  houseCount: 4,
  categories: ["color", "nation", "drink", "food"],
  answer: {
    color: ["yellow", "blue", "red", "green"],
    nation: ["norway", "denmark", "england", "sweden"],
    drink: ["water", "tea", "milk", "coffee"],
    food: ["gimbap", "ramen", "pizza", "burger"],
  },
  clues: [
    {
      id: "r1",
      kind: "nextTo",
      a: { cat: "color", val: "yellow" },
      b: { cat: "nation", val: "denmark" },
      text: "노란 집은 덴마크 사람이 사는 집 옆에 있다.",
      values: ["yellow", "denmark"],
    },
    {
      id: "r2",
      kind: "leftOf",
      a: { cat: "drink", val: "tea" },
      b: { cat: "drink", val: "milk" },
      text: "차를 마시는 집은 우유를 마시는 집 왼쪽에 있다.",
      values: ["tea", "milk"],
    },
    {
      id: "r3",
      kind: "nextTo",
      a: { cat: "food", val: "pizza" },
      b: { cat: "nation", val: "sweden" },
      text: "피자를 먹는 집은 스웨덴 사람이 사는 집 옆에 있다.",
      values: ["pizza", "sweden"],
    },
  ],
};
fallbackReasoningPuzzle.hints = buildHints(fallbackReasoningPuzzle);
assertFactCitationsRelate(fallbackReasoningPuzzle, "answer fallback reasoning");

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

const runtimePuzzle = generatePuzzle("easy", { timeLimitMs: 2500, random: seededRandom(21) });
const game = createGameState();
game.loadPuzzle(runtimePuzzle);
assert(game.getPuzzle().houseCount === runtimePuzzle.houseCount, "getPuzzle returns houseCount");
assert(game.getPuzzle().hints.length === runtimePuzzle.hints.length, "getPuzzle returns hints");
game.toggleClueRead(runtimePuzzle.clues[0].id);
assert(game.isClueRead(runtimePuzzle.clues[0].id), "clue read toggles on");
assert(game.getRevealedHints().length === 0, "clue toggle does not reveal hint");
assert(game.revealNextHint().stage === "direction", "first reveal direction");
assert(game.revealNextHint().stage === "clues", "second reveal clue guidance");
assert(game.revealNextHint().stage === "fact", "third reveal fact");
assert(game.getRevealedHints().length === 3, "three hints revealed");
game.toggleClueRead(runtimePuzzle.clues[0].id);
assert(!game.isClueRead(runtimePuzzle.clues[0].id), "clue read toggles off");
game.resetPlacement({ keepTimer: true });
assert(game.getRevealedHints().length === 3, "resetPlacement keeps revealed hints");
game.loadPuzzle(runtimePuzzle);
assert(game.getRevealedHints().length === 0, "loadPuzzle clears revealed hints");
assert(!game.isClueRead(runtimePuzzle.clues[0].id), "loadPuzzle clears clue read");

const exhausted = game.revealNextHint();
assert(exhausted === null || exhausted.done === true || typeof exhausted === "object", "reveal continues until exhausted");
while (game.getRevealedHints().length < runtimePuzzle.hints.length) {
  const next = game.revealNextHint();
  if (!next || next.done) break;
}
assert(game.getRevealedHints().length === runtimePuzzle.hints.length, "all hints can be revealed");
const afterExhaust = game.revealNextHint();
assert(afterExhaust == null || afterExhaust.done === true, "no more hints after exhaustion");

const memory = new Map();
const storage = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => memory.set(k, String(v)),
};
const scale = createTextScale({ storage });
assert(scale.get() === 150, "scale defaults 150");
for (let i = 0; i < 9; i++) scale.increase();
assert(scale.get() === 200 && !scale.canIncrease(), "scale capped 200");
for (let i = 0; i < 20; i++) scale.decrease();
assert(scale.get() === 100 && !scale.canDecrease(), "scale floored 100");
assert(memory.get("einstein-text-scale") === "100", "scale persists to storage");
const restored = createTextScale({ storage });
assert(restored.get() === 100, "scale restores from storage");
storage.setItem("einstein-text-scale", "not-a-number");
assert(createTextScale({ storage }).get() === 150, "invalid storage falls back to 150");

const styleProps = {};
const fakeRoot = {
  style: {
    setProperty(name, value) {
      styleProps[name] = value;
    },
  },
};
restored.increase();
restored.apply(fakeRoot);
assert(styleProps["--text-scale"] === "1.1", "apply sets css variable as ratio");

function testRenderCluesReadToggle() {
  const previousDocument = globalThis.document;
  const children = [];
  const container = {
    innerHTML: "",
    appendChild(node) {
      children.push(node);
    },
  };
  const clicks = [];
  try {
    globalThis.document = {
      createElement() {
        const el = {
          type: "",
          className: "",
          textContent: "",
          dataset: {},
          attributes: {},
          setAttribute(name, value) {
            this.attributes[name] = value;
          },
          addEventListener(type, listener) {
            if (type === "click") this._click = listener;
          },
          click() {
            this._click?.();
          },
        };
        return el;
      },
    };
    renderClues({
      container,
      clues: [{ id: "c1", text: "테스트 단서" }],
      readIds: new Set(["c1"]),
      onToggleRead: (id) => clicks.push(id),
    });
    assert(children.length === 1, "renderClues creates one button");
    assert(children[0].attributes["aria-pressed"] === "true", "read clue has aria-pressed true");
    assert(children[0].className.includes("read") || children[0].dataset.read === "true", "read clue marked");
    assert(children[0].textContent.includes("✓"), "read clue shows check");
    children[0].click();
    assert(clicks[0] === "c1", "click toggles read via callback");
  } finally {
    globalThis.document = previousDocument;
  }
}

testRenderCluesReadToggle();
testDragCancelCleanup();

const fillPuzzle = generatePuzzle("easy", { timeLimitMs: 0, random: seededRandom(5) });
const fillGame = createGameState();
fillGame.loadPuzzle(fillPuzzle);
const place = fillGame.getPlacement();
place.color[0] = fillPuzzle.answer.color[0];
const queue = buildAnswerFillQueue(place, fillPuzzle.answer, fillPuzzle.categories);
assert(!queue.some((q) => q.category === "color" && q.houseIndex === 0), "correct cell omitted from fill queue");
assert(queue.length === fillPuzzle.categories.length * fillPuzzle.houseCount - 1, "queue covers all non-correct cells");

assert(shouldContinueReveal(1, 1), "shouldContinueReveal true when session matches");
assert(!shouldContinueReveal(1, 2), "shouldContinueReveal false when generation bumped");

fillGame.lockInteraction();
assert(fillGame.isInteractionLocked(), "lockInteraction sets locked");
fillGame.ensureTimerStarted();
assert(fillGame.isTimerRunning(), "ensureTimerStarted runs timer");
fillGame.stopTimer();
assert(!fillGame.isTimerRunning(), "stopTimer clears running");
assert(fillGame.moveCard({
  value: fillPuzzle.answer.color[1],
  category: "color",
  from: { type: "pool" },
  to: { type: "slot", category: "color", houseIndex: 1 },
}) === false, "moveCard blocked when locked");

const lockedPlacement = fillGame.getPlacement();
fillGame.undo();
assert(JSON.stringify(fillGame.getPlacement()) === JSON.stringify(lockedPlacement), "undo no-op when locked");
fillGame.resetPlacement();
assert(JSON.stringify(fillGame.getPlacement()) === JSON.stringify(lockedPlacement), "resetPlacement no-op when locked");
const clueId = fillPuzzle.clues[0]?.id;
if (clueId) {
  fillGame.toggleClueRead(clueId);
  assert(!fillGame.isClueRead(clueId), "toggleClueRead no-op when locked");
}
assert(fillGame.revealNextHint() === null, "revealNextHint null when locked");

fillGame.loadPuzzle(fillPuzzle);
assert(!fillGame.isInteractionLocked(), "loadPuzzle clears lock");

assert(fillGame.setCellToAnswer("color", 0) === true, "setCellToAnswer writes answer cell");
assert(fillGame.getPlacement().color[0] === fillPuzzle.answer.color[0], "cell matches answer");

const dupGame = createGameState();
dupGame.loadPuzzle(fillPuzzle);
dupGame.moveCard({
  value: fillPuzzle.answer.color[0],
  category: "color",
  from: { type: "pool" },
  to: { type: "slot", category: "color", houseIndex: 1 },
});
assert(dupGame.setCellToAnswer("color", 0) === true, "setCellToAnswer clears duplicate");
const dupPlace = dupGame.getPlacement();
assert(dupPlace.color[0] === fillPuzzle.answer.color[0], "setCellToAnswer places value in target cell");
assert(dupPlace.color[1] === null, "setCellToAnswer clears duplicate in same category");

const fullGame = createGameState();
fullGame.loadPuzzle(fillPuzzle);
fullGame.applyFullAnswer();
assert(JSON.stringify(fullGame.getPlacement()) === JSON.stringify(fillPuzzle.answer), "applyFullAnswer matches answer");

for (const cat of Object.keys(VALUES)) {
  for (const id of VALUES[cat]) {
    assert(Boolean(iconOf(id)), `iconOf(${id}) non-empty`);
    assert(ICONS[id] === iconOf(id), `ICONS[${id}] matches iconOf`);
    assert(formatCardLabel(id).includes(labelOf(id)), `formatCardLabel includes Korean for ${id}`);
    assert(formatCardLabel(id).includes(iconOf(id)), `formatCardLabel includes icon for ${id}`);
  }
}
assert(formatCardLabel("england").includes("🇬🇧"), "england flag");
assert(formatCardLabel("england").includes("영국"), "england Korean");
assert(formatCardLabel("dog").includes("🐕"), "dog emoji");
assert(formatCardLabel("dog").includes("개"), "dog Korean");
assert(!Object.prototype.hasOwnProperty.call(ICONS, "color"), "category keys are not in ICONS");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
