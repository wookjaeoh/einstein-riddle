import {
  CATEGORIES,
  VALUES,
  DIFFICULTY_TARGETS,
  FALLBACK_ANSWER,
  FALLBACK_CLUES,
  labelOf,
} from "./puzzle-data.js";
import {
  SOLVER_ABORTED,
  answerSatisfiesClues,
  countSolutions,
  isUniqueSolution,
} from "./solver.js";

const DEFAULT_TIME_LIMIT_MS = 1800;

function shuffle(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function randomAnswer(random) {
  return Object.fromEntries(CATEGORIES.map((cat) => [cat, shuffle(VALUES[cat], random)]));
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

function sameHouseText(a, b) {
  const pair = [a, b].sort(
    (x, y) => CATEGORIES.indexOf(x.cat) - CATEGORIES.indexOf(y.cat),
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

function buildCandidateClues(answer) {
  const clues = [];
  let nextId = 1;
  const add = (clue) => clues.push({ id: `g${nextId++}`, ...clue });
  const point = (cat, houseIndex) => ({ cat, val: answer[cat][houseIndex] });

  for (const cat of CATEGORIES) {
    for (let houseIndex = 0; houseIndex < 5; houseIndex++) {
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

  for (let i = 0; i < CATEGORIES.length; i++) {
    for (let j = i + 1; j < CATEGORIES.length; j++) {
      const catA = CATEGORIES[i];
      const catB = CATEGORIES[j];
      for (let houseIndex = 0; houseIndex < 5; houseIndex++) {
        const a = point(catA, houseIndex);
        const b = point(catB, houseIndex);
        add({
          kind: "sameHouse",
          a,
          b,
          categories: [catA, catB],
          values: [a.val, b.val],
          text: sameHouseText(a, b),
        });
      }
      for (let houseIndex = 0; houseIndex < 4; houseIndex++) {
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

  for (const cat of CATEGORIES) {
    for (let houseIndex = 0; houseIndex < 4; houseIndex++) {
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

function orderPool(pool, random) {
  const strength = { leftOf: 0, atHouse: 1, sameHouse: 1, nextTo: 2 };
  const buckets = [[], [], []];
  for (const clue of pool) buckets[strength[clue.kind]].push(clue);
  return buckets.flatMap((bucket) => shuffle(bucket, random));
}

function uniqueBeforeDeadline(clues, deadline) {
  return countSolutions(clues, { limit: 2, deadline });
}

function shrinkWhileUnique(working, stopAt, deadline, random) {
  for (const clue of shuffle(working, random)) {
    if (Date.now() >= deadline || working.length <= stopAt) break;
    const trial = working.filter((item) => item.id !== clue.id);
    const result = uniqueBeforeDeadline(trial, deadline);
    if (result === SOLVER_ABORTED) return { working, aborted: true };
    if (result === 1) working = trial;
  }
  return { working, aborted: Date.now() >= deadline };
}

function verifiedFallback() {
  if (!isUniqueSolution(FALLBACK_CLUES)) {
    throw new Error("폴백 단서가 유일해가 아닙니다.");
  }
  if (!answerSatisfiesClues(FALLBACK_ANSWER, FALLBACK_CLUES)) {
    throw new Error("폴백 정답이 폴백 단서를 만족하지 않습니다.");
  }
  return {
    answer: structuredClone(FALLBACK_ANSWER),
    clues: FALLBACK_CLUES.map((clue) => structuredClone(clue)),
    meta: { usedFallback: true, clueCount: FALLBACK_CLUES.length },
  };
}

export function generatePuzzle(
  difficulty,
  { timeLimitMs = DEFAULT_TIME_LIMIT_MS, random = Math.random } = {},
) {
  const normalizedDifficulty = difficulty in DIFFICULTY_TARGETS ? difficulty : "easy";
  const target = DIFFICULTY_TARGETS[normalizedDifficulty];
  const preferMax = normalizedDifficulty === "easy";
  const safeTimeLimit =
    Number.isFinite(timeLimitMs) && timeLimitMs >= 0
      ? timeLimitMs
      : DEFAULT_TIME_LIMIT_MS;
  const deadline = Date.now() + safeTimeLimit;

  for (let attempt = 0; attempt < 20; attempt++) {
    if (Date.now() >= deadline) break;
    const answer = randomAnswer(random);
    const pool = orderPool(buildCandidateClues(answer), random);
    const selected = [];
    let selectedResult = 0;

    for (const clue of pool) {
      if (Date.now() >= deadline) break;
      selected.push(clue);
      selectedResult = uniqueBeforeDeadline(selected, deadline);
      if (selectedResult === SOLVER_ABORTED || selectedResult === 1) break;
      if (selected.length > 35) break;
    }
    if (selectedResult === SOLVER_ABORTED) break;
    if (selectedResult !== 1) continue;

    const shrunk = shrinkWhileUnique([...selected], target.min, deadline, random);
    if (shrunk.aborted) break;
    let working = shrunk.working;
    if (preferMax && working.length < target.max) {
      for (const clue of pool) {
        if (Date.now() >= deadline || working.length >= target.max) break;
        if (working.some((item) => item.id === clue.id)) continue;
        // answer에서 만든 참인 단서를 유일해 집합에 더해도 기존 유일해는 유지된다.
        working = [...working, clue];
      }
    }

    const finalResult = uniqueBeforeDeadline(working, deadline);
    if (finalResult === SOLVER_ABORTED) break;
    if (finalResult !== 1 || !answerSatisfiesClues(answer, working)) continue;
    const inTarget =
      working.length >= target.min && working.length <= target.max;
    if (preferMax && !inTarget) continue;
    if (!preferMax && working.length >= 15) continue;

    return {
      answer,
      clues: working,
      meta: { usedFallback: false, clueCount: working.length },
    };
  }

  return verifiedFallback();
}
