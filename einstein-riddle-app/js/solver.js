import { CATEGORIES, VALUES } from "./puzzle-data.js";

const permutations = (() => {
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
  visit([], [0, 1, 2, 3, 4]);
  return result;
})();

function clueCategories(clue) {
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

export function countSolutions(clues, { limit = 2 } = {}) {
  if (!Number.isInteger(limit) || limit < 1) return 0;
  if (!Array.isArray(clues) || clues.some((clue) => !clueCategories(clue).length)) return 0;

  const relevant = Object.fromEntries(CATEGORIES.map((cat) => [cat, []]));
  for (const clue of clues) {
    for (const cat of clueCategories(clue)) relevant[cat].push(clue);
  }

  const categoryOrder = [...CATEGORIES].sort((a, b) => {
    const aUnary = relevant[a].filter((clue) => clueCategories(clue).length === 1).length;
    const bUnary = relevant[b].filter((clue) => clueCategories(clue).length === 1).length;
    return bUnary - aUnary || relevant[b].length - relevant[a].length;
  });
  const valueIndexes = Object.fromEntries(
    CATEGORIES.map((cat) => [cat, Object.fromEntries(VALUES[cat].map((value, index) => [value, index]))]),
  );
  const assignment = {};
  let count = 0;

  function search(depth) {
    if (count >= limit) return;
    if (depth === categoryOrder.length) {
      count++;
      return;
    }

    const cat = categoryOrder[depth];
    for (const permutation of permutations) {
      const byValue = {};
      for (let valueIndex = 0; valueIndex < 5; valueIndex++) {
        byValue[VALUES[cat][valueIndex]] = permutation[valueIndex];
      }
      assignment[cat] = byValue;

      let valid = true;
      for (const clue of relevant[cat]) {
        const cats = clueCategories(clue);
        if (cats.every((name) => assignment[name]) && !clueHolds(assignment, clue)) {
          valid = false;
          break;
        }
      }
      if (valid) search(depth + 1);
      if (count >= limit) break;
    }
    delete assignment[cat];
  }

  // Keep the lookup construction above explicit so invalid clue values fail closed.
  for (const clue of clues) {
    if (clue.kind === "atHouse") {
      if (!(clue.cat in valueIndexes) || !(clue.val in valueIndexes[clue.cat])) return 0;
      if (!Number.isInteger(clue.houseIndex) || clue.houseIndex < 0 || clue.houseIndex > 4) return 0;
    } else {
      if (
        !(clue.a?.cat in valueIndexes) ||
        !(clue.b?.cat in valueIndexes) ||
        !(clue.a.val in valueIndexes[clue.a.cat]) ||
        !(clue.b.val in valueIndexes[clue.b.cat])
      ) return 0;
    }
  }

  search(0);
  return count;
}

export function isUniqueSolution(clues) {
  return countSolutions(clues, { limit: 2 }) === 1;
}
