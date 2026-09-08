import { CATEGORIES, VALUES } from "./puzzle-data.js";

export const SOLVER_ABORTED = Symbol("SOLVER_ABORTED");
const SUPPORTED_KINDS = new Set(["atHouse", "sameHouse", "nextTo", "leftOf"]);

const permutationCache = new Map();

function getPermutations(size) {
  if (permutationCache.has(size)) return permutationCache.get(size);
  const result = [];
  function visit(prefix, rest) {
    if (rest.length === 0) {
      result.push(prefix);
      return;
    }
    for (let i = 0; i < rest.length; i++) {
      visit([...prefix, rest[i]], [...rest.slice(0, i), ...rest.slice(i + 1)]);
    }
  }
  visit([], Array.from({ length: size }, (_, index) => index));
  permutationCache.set(size, result);
  return result;
}

function clueCategories(clue) {
  if (!clue || typeof clue !== "object" || !SUPPORTED_KINDS.has(clue.kind)) return [];
  if (clue.kind === "atHouse") return [clue.cat];
  if (clue.a && clue.b) return [...new Set([clue.a.cat, clue.b.cat])];
  return [];
}

function clueHolds(assignment, clue) {
  const houseOf = (cat, val) => assignment[cat][val];
  if (clue.kind === "atHouse") {
    return houseOf(clue.cat, clue.val) === clue.houseIndex;
  }
  const aHouse = houseOf(clue.a.cat, clue.a.val);
  const bHouse = houseOf(clue.b.cat, clue.b.val);
  if (clue.kind === "sameHouse") return aHouse === bHouse;
  if (clue.kind === "nextTo") return Math.abs(aHouse - bHouse) === 1;
  if (clue.kind === "leftOf") return aHouse + 1 === bHouse;
  return false;
}

function isValidClue(clue, valueIndexes, houseCount, categories) {
  if (!clueCategories(clue).length) return false;
  if (clueCategories(clue).some((cat) => !categories.includes(cat))) return false;
  if (clue.kind === "atHouse") {
    return (
      clue.cat in valueIndexes &&
      clue.val in valueIndexes[clue.cat] &&
      Number.isInteger(clue.houseIndex) &&
      clue.houseIndex >= 0 &&
      clue.houseIndex < houseCount
    );
  }
  return (
    clue.a?.cat in valueIndexes &&
    clue.b?.cat in valueIndexes &&
    clue.a.val in valueIndexes[clue.a.cat] &&
    clue.b.val in valueIndexes[clue.b.cat]
  );
}

function answerToAssignment(answer, categories, values, houseCount) {
  if (!answer || typeof answer !== "object") return null;
  const assignment = {};
  for (const cat of categories) {
    if (
      !Array.isArray(answer[cat]) ||
      answer[cat].length !== houseCount ||
      new Set(answer[cat]).size !== houseCount ||
      answer[cat].some((value) => !values[cat].includes(value))
    ) return null;
    assignment[cat] = Object.fromEntries(answer[cat].map((value, houseIndex) => [value, houseIndex]));
  }
  return assignment;
}

/**
 * 알 수 없거나 형식이 잘못된 단서는 해가 없는 것으로 처리한다(fail-closed).
 * 취소 또는 deadline 도달 시 숫자 대신 SOLVER_ABORTED를 반환한다.
 */
export function countSolutions(
  clues,
  {
    limit = 2,
    shouldAbort,
    deadline = Infinity,
    houseCount = 5,
    categories = CATEGORIES,
    values = VALUES,
  } = {},
) {
  if (!Number.isInteger(limit) || limit < 1) return 0;
  if (!Number.isInteger(houseCount) || houseCount < 1 || houseCount > 5) return 0;
  if (!Array.isArray(categories) || !categories.length) return 0;
  if (categories.some((cat) => !CATEGORIES.includes(cat))) return 0;
  if (categories.some((cat) => !Array.isArray(values[cat]) || values[cat].length !== houseCount)) return 0;
  if (!Array.isArray(clues) || clues.some((clue) => !clueCategories(clue).length)) return 0;

  const valueIndexes = Object.fromEntries(
    categories.map((cat) => [cat, Object.fromEntries(values[cat].map((value, index) => [value, index]))]),
  );
  if (clues.some((clue) => !isValidClue(clue, valueIndexes, houseCount, categories))) return 0;

  let aborted = false;
  const finiteDeadline = Number.isFinite(deadline) ? deadline : Infinity;
  function abortRequested() {
    if (aborted) return true;
    aborted =
      (typeof shouldAbort === "function" && shouldAbort()) ||
      Date.now() >= finiteDeadline;
    return aborted;
  }

  const relevant = Object.fromEntries(categories.map((cat) => [cat, []]));
  for (const clue of clues) {
    if (abortRequested()) return SOLVER_ABORTED;
    for (const cat of clueCategories(clue)) relevant[cat].push(clue);
  }

  const categoryOrder = [...categories].sort((a, b) => {
    const aUnary = relevant[a].filter((clue) => clueCategories(clue).length === 1).length;
    const bUnary = relevant[b].filter((clue) => clueCategories(clue).length === 1).length;
    return bUnary - aUnary || relevant[b].length - relevant[a].length;
  });
  const assignment = {};
  const permutations = getPermutations(houseCount);
  let count = 0;

  function search(depth) {
    if (count >= limit || abortRequested()) return;
    if (depth === categoryOrder.length) {
      count++;
      return;
    }

    const cat = categoryOrder[depth];
    for (const permutation of permutations) {
      if (abortRequested()) break;
      const byValue = {};
      for (let valueIndex = 0; valueIndex < houseCount; valueIndex++) {
        if (abortRequested()) break;
        byValue[values[cat][valueIndex]] = permutation[valueIndex];
      }
      if (aborted) break;
      assignment[cat] = byValue;

      let valid = true;
      for (const clue of relevant[cat]) {
        if (abortRequested()) break;
        const cats = clueCategories(clue);
        if (cats.every((name) => assignment[name]) && !clueHolds(assignment, clue)) {
          valid = false;
          break;
        }
      }
      if (aborted) break;
      if (valid) search(depth + 1);
      if (count >= limit || aborted) break;
    }
    delete assignment[cat];
  }

  search(0);
  return aborted ? SOLVER_ABORTED : count;
}

export function isUniqueSolution(clues, options) {
  return countSolutions(clues, { ...options, limit: 2 }) === 1;
}

export function answerSatisfiesClues(
  answer,
  clues,
  {
    houseCount = 5,
    categories = CATEGORIES,
    values = VALUES,
  } = {},
) {
  if (!Array.isArray(clues)) return false;
  if (!Array.isArray(categories) || categories.some((cat) => !CATEGORIES.includes(cat))) return false;
  const valueIndexes = Object.fromEntries(
    categories.map((cat) => [cat, Object.fromEntries(values[cat].map((value, index) => [value, index]))]),
  );
  if (clues.some((clue) => !isValidClue(clue, valueIndexes, houseCount, categories))) return false;
  const assignment = answerToAssignment(answer, categories, values, houseCount);
  return assignment !== null && clues.every((clue) => clueHolds(assignment, clue));
}
