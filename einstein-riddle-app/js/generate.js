import {
  VALUES,
  DIFFICULTY_PROFILES,
  PROFILE_FALLBACKS,
  labelOf,
} from "./puzzle-data.js";
import {
  SOLVER_ABORTED,
  answerSatisfiesClues,
  countSolutions,
  isUniqueSolution,
} from "./solver.js";
import { buildHints } from "./hints.js";

const DEFAULT_TIME_LIMIT_MS = 1800;

function shuffle(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function hasBatchim(text) {
  const code = text.charCodeAt(text.length - 1);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
}

function particle(text, withBatchim, withoutBatchim) {
  return `${text}${hasBatchim(text) ? withBatchim : withoutBatchim}`;
}

function descriptor({ cat, val }) {
  const value = labelOf(val);
  if (cat === "color") return `${value} 집`;
  if (cat === "nation") return `${value} 사람이 사는 집`;
  if (cat === "drink") return `${particle(value, "을", "를")} 마시는 집`;
  if (cat === "food") return `${particle(value, "을", "를")} 먹는 집`;
  return `${particle(value, "을", "를")} 기르는 집`;
}

function sameHouseText(a, b, categories) {
  const pair = [a, b].sort(
    (x, y) => categories.indexOf(x.cat) - categories.indexOf(y.cat),
  );
  const [first, second] = pair;
  const aLabel = labelOf(first.val);
  const bLabel = labelOf(second.val);
  const key = `${first.cat}:${second.cat}`;
  const templates = {
    "color:nation": `${bLabel} 사람은 ${aLabel} 집에 산다.`,
    "color:drink": `${aLabel} 집에 사는 사람은 ${particle(bLabel, "을", "를")} 마신다.`,
    "color:food": `${aLabel} 집에 사는 사람은 ${particle(bLabel, "을", "를")} 먹는다.`,
    "color:animal": `${aLabel} 집에 사는 사람은 ${particle(bLabel, "을", "를")} 기른다.`,
    "nation:drink": `${aLabel} 사람은 ${particle(bLabel, "을", "를")} 마신다.`,
    "nation:food": `${aLabel} 사람은 ${particle(bLabel, "을", "를")} 먹는다.`,
    "nation:animal": `${aLabel} 사람은 ${particle(bLabel, "을", "를")} 기른다.`,
    "drink:food": `${particle(bLabel, "을", "를")} 먹는 사람은 ${particle(aLabel, "을", "를")} 마신다.`,
    "drink:animal": `${particle(bLabel, "을", "를")} 기르는 사람은 ${particle(aLabel, "을", "를")} 마신다.`,
    "food:animal": `${particle(aLabel, "을", "를")} 먹는 사람은 ${particle(bLabel, "을", "를")} 기른다.`,
  };
  return templates[key] ?? `${descriptor(a)}과 ${descriptor(b)}은 같은 집이다.`;
}

function atHouseText(cat, val, houseIndex) {
  const house = houseIndex + 1;
  const value = labelOf(val);
  if (cat === "color") return `${house}번 집은 ${value} 집이다.`;
  if (cat === "nation") return `${value} 사람은 ${house}번 집에 산다.`;
  if (cat === "drink") return `${house}번 집에 사는 사람은 ${particle(value, "을", "를")} 마신다.`;
  if (cat === "food") return `${house}번 집에 사는 사람은 ${particle(value, "을", "를")} 먹는다.`;
  return `${house}번 집에 사는 사람은 ${particle(value, "을", "를")} 기른다.`;
}

function buildRuntimeContext(profile, random) {
  const { houseCount, categories } = profile;
  const values = Object.fromEntries(
    categories.map((cat) => [cat, shuffle(VALUES[cat], random).slice(0, houseCount)]),
  );
  const answer = Object.fromEntries(
    categories.map((cat) => [cat, shuffle(values[cat], random)]),
  );
  return { houseCount, categories, values, answer };
}

function solverOptions(ctx) {
  return {
    houseCount: ctx.houseCount,
    categories: ctx.categories,
    values: ctx.values,
  };
}

function buildCandidateClues(answer, categories, houseCount) {
  const clues = [];
  let nextId = 1;
  const add = (clue) => clues.push({ id: `g${nextId++}`, ...clue });
  const point = (cat, houseIndex) => ({ cat, val: answer[cat][houseIndex] });

  for (const cat of categories) {
    for (let houseIndex = 0; houseIndex < houseCount; houseIndex++) {
      const val = answer[cat][houseIndex];
      add({
        kind: "atHouse",
        cat,
        val,
        houseIndex,
        houseIds: [houseIndex + 1],
        categories: [cat],
        values: [val],
        text: atHouseText(cat, val, houseIndex),
      });
    }
  }

  for (let i = 0; i < categories.length; i++) {
    for (let j = i + 1; j < categories.length; j++) {
      const catA = categories[i];
      const catB = categories[j];
      for (let houseIndex = 0; houseIndex < houseCount; houseIndex++) {
        const a = point(catA, houseIndex);
        const b = point(catB, houseIndex);
        add({
          kind: "sameHouse",
          a,
          b,
          categories: [catA, catB],
          values: [a.val, b.val],
          text: sameHouseText(a, b, categories),
        });
      }
      for (let houseIndex = 0; houseIndex < houseCount - 1; houseIndex++) {
        for (const [a, b] of [
          [point(catA, houseIndex), point(catB, houseIndex + 1)],
          [point(catB, houseIndex), point(catA, houseIndex + 1)],
        ]) {
          add({
            kind: "nextTo",
            a,
            b,
            houseIds: [houseIndex + 1, houseIndex + 2],
            categories: [a.cat, b.cat],
            values: [a.val, b.val],
            text: `${particle(descriptor(a), "은", "는")} ${descriptor(b)}의 옆집이다.`,
          });
          add({
            kind: "leftOf",
            a,
            b,
            houseIds: [houseIndex + 1, houseIndex + 2],
            categories: [a.cat, b.cat],
            values: [a.val, b.val],
            text: `${particle(descriptor(a), "은", "는")} ${descriptor(b)} 바로 왼쪽에 있다.`,
          });
        }
      }
    }
  }

  for (const cat of categories) {
    for (let houseIndex = 0; houseIndex < houseCount - 1; houseIndex++) {
      const a = point(cat, houseIndex);
      const b = point(cat, houseIndex + 1);
      add({
        kind: "leftOf",
        a,
        b,
        houseIds: [houseIndex + 1, houseIndex + 2],
        categories: [cat],
        values: [a.val, b.val],
        text: `${particle(descriptor(a), "은", "는")} ${descriptor(b)} 바로 왼쪽에 있다.`,
      });
    }
  }
  return clues;
}

function orderPool(pool, random, profile) {
  const strength =
    profile?.minimize
      ? { atHouse: 0, sameHouse: 0, leftOf: 1, nextTo: 2 }
      : { leftOf: 0, atHouse: 1, sameHouse: 1, nextTo: 2 };
  const buckets = [[], [], []];
  for (const clue of pool) buckets[strength[clue.kind]].push(clue);
  return buckets.flatMap((bucket) => shuffle(bucket, random));
}

function uniqueBeforeDeadline(clues, solverCtx, deadline) {
  return countSolutions(clues, { ...solverCtx, limit: 2, deadline });
}

function shrinkWhileUnique(working, stopAt, solverCtx, deadline, random, maxRemovals = Infinity) {
  let removals = 0;
  for (const clue of shuffle(working, random)) {
    if (Date.now() >= deadline || working.length <= stopAt || removals >= maxRemovals) break;
    const trial = working.filter((item) => item.id !== clue.id);
    const result = uniqueBeforeDeadline(trial, solverCtx, deadline);
    if (result === SOLVER_ABORTED) return { working, aborted: true };
    if (result === 1) {
      working = trial;
      removals++;
    }
  }
  return { working, aborted: Date.now() >= deadline };
}

function growWhileUnique(working, targetCount, pool, solverCtx, deadline) {
  if (working.length >= targetCount) return { working, aborted: Date.now() >= deadline };
  for (const clue of pool) {
    if (Date.now() >= deadline || working.length >= targetCount) break;
    if (working.some((item) => item.id === clue.id)) continue;
    const trial = [...working, clue];
    const result = uniqueBeforeDeadline(trial, solverCtx, deadline);
    if (result === SOLVER_ABORTED) return { working, aborted: true };
    if (result === 1) working = trial;
  }
  return { working, aborted: Date.now() >= deadline };
}

function finalizePuzzle(ctx, clues, difficulty, meta) {
  return {
    houseCount: ctx.houseCount,
    categories: [...ctx.categories],
    values: structuredClone(ctx.values),
    answer: structuredClone(ctx.answer),
    clues,
    hints: buildHints({
      clues,
      answer: ctx.answer,
      houseCount: ctx.houseCount,
      categories: ctx.categories,
    }),
    difficulty,
    meta,
  };
}

function verifiedFallback(difficulty) {
  const profile = DIFFICULTY_PROFILES[difficulty] ?? DIFFICULTY_PROFILES.easy;
  const fallback = PROFILE_FALLBACKS[profile.id];
  const solverCtx = {
    houseCount: fallback.houseCount,
    categories: fallback.categories,
    values: fallback.values,
  };
  if (!isUniqueSolution(fallback.clues, solverCtx)) {
    throw new Error(`${profile.id} 폴백 단서가 유일해가 아닙니다.`);
  }
  if (!answerSatisfiesClues(fallback.answer, fallback.clues, solverCtx)) {
    throw new Error(`${profile.id} 폴백 정답이 폴백 단서를 만족하지 않습니다.`);
  }
  return finalizePuzzle(
    fallback,
    fallback.clues.map((clue) => structuredClone(clue)),
    profile.id,
    { usedFallback: true, clueCount: fallback.clues.length },
  );
}

function shrinkHardPuzzleToExpert(hardPuzzle, random, deadline) {
  const [targetMin, targetMax] = DIFFICULTY_PROFILES.expert.clueRange;
  const ctx = {
    houseCount: hardPuzzle.houseCount,
    categories: hardPuzzle.categories,
    values: hardPuzzle.values,
    answer: hardPuzzle.answer,
  };
  const solverCtx = solverOptions(ctx);
  let working = hardPuzzle.clues.map((clue) => structuredClone(clue));

  for (let stop = Math.min(working.length - 1, targetMax); stop >= targetMin; stop--) {
    if (working.length > stop) {
      const shrunk = shrinkWhileUnique(
        working,
        stop,
        solverCtx,
        deadline,
        random,
        working.length - stop,
      );
      working = shrunk.working;
    }
    if (
      working.length >= targetMin &&
      working.length <= targetMax &&
      isUniqueSolution(working, solverCtx) &&
      answerSatisfiesClues(ctx.answer, working, solverCtx)
    ) {
      return finalizePuzzle(ctx, working, "expert", {
        usedFallback: false,
        clueCount: working.length,
      });
    }
  }
  return null;
}

function generateStandardPuzzle(profile, { timeLimitMs = DEFAULT_TIME_LIMIT_MS, random = Math.random } = {}) {
  const [targetMin, targetMax] = profile.clueRange;
  const safeTimeLimit =
    Number.isFinite(timeLimitMs) && timeLimitMs >= 0
      ? timeLimitMs
      : DEFAULT_TIME_LIMIT_MS;
  const deadline = Date.now() + safeTimeLimit;

  for (let attempt = 0; attempt < 20; attempt++) {
    if (Date.now() >= deadline) break;
    const ctx = buildRuntimeContext(profile, random);
    const solverCtx = solverOptions(ctx);
    const pool = orderPool(
      buildCandidateClues(ctx.answer, ctx.categories, ctx.houseCount),
      random,
      profile,
    );
    const selected = [];
    let selectedResult = 0;

    for (const clue of pool) {
      if (Date.now() >= deadline) break;
      selected.push(clue);
      selectedResult = uniqueBeforeDeadline(selected, solverCtx, deadline);
      if (selectedResult === SOLVER_ABORTED || selectedResult === 1) break;
      if (selected.length > 40) break;
    }
    if (selectedResult === SOLVER_ABORTED) break;
    if (selectedResult !== 1) continue;

    const shrunk = shrinkWhileUnique([...selected], targetMin, solverCtx, deadline, random);
    if (shrunk.aborted) break;
    let working = shrunk.working;

    if (working.length < targetMax) {
      const grown = growWhileUnique(working, targetMax, pool, solverCtx, deadline);
      if (grown.aborted) break;
      working = grown.working;
    }

    const finalResult = uniqueBeforeDeadline(working, solverCtx, deadline);
    if (finalResult === SOLVER_ABORTED) break;
    if (finalResult !== 1 || !answerSatisfiesClues(ctx.answer, working, solverCtx)) continue;

    const inTarget = working.length >= targetMin && working.length <= targetMax;
    if (!inTarget) continue;

    return finalizePuzzle(ctx, working, profile.id, {
      usedFallback: false,
      clueCount: working.length,
    });
  }

  return verifiedFallback(profile.id);
}

export function generatePuzzle(
  difficulty,
  { timeLimitMs = DEFAULT_TIME_LIMIT_MS, random = Math.random } = {},
) {
  const profile = DIFFICULTY_PROFILES[difficulty] ?? DIFFICULTY_PROFILES.easy;

  if (profile.id === "expert") {
    const safeTimeLimit =
      Number.isFinite(timeLimitMs) && timeLimitMs >= 0
        ? timeLimitMs
        : DEFAULT_TIME_LIMIT_MS;
    const shrinkBudget = Math.max(250, Math.floor(safeTimeLimit / 5));
    const hardBudget = Math.max(0, safeTimeLimit - shrinkBudget);
    const hardPuzzle = generateStandardPuzzle(DIFFICULTY_PROFILES.hard, {
      timeLimitMs: hardBudget,
      random,
    });
    if (!hardPuzzle.meta.usedFallback && hardPuzzle.clues.length === 15) {
      const expertPuzzle = shrinkHardPuzzleToExpert(
        hardPuzzle,
        random,
        Date.now() + shrinkBudget,
      );
      if (expertPuzzle) return expertPuzzle;
    }
    return verifiedFallback("expert");
  }

  return generateStandardPuzzle(profile, { timeLimitMs, random });
}
