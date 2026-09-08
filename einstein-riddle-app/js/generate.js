import {
  CATEGORIES,
  VALUES,
  DIFFICULTY_TARGETS,
  FALLBACK_ANSWER,
  FALLBACK_CLUES,
  labelOf,
} from "./puzzle-data.js";
import { countSolutions } from "./solver.js";

const now = () => globalThis.performance?.now?.() ?? Date.now();

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function randomAnswer() {
  return Object.fromEntries(CATEGORIES.map((cat) => [cat, shuffle(VALUES[cat])]));
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

function orderPool(pool) {
  const strength = { leftOf: 0, atHouse: 1, sameHouse: 1, nextTo: 2 };
  const buckets = [[], [], []];
  for (const clue of pool) buckets[strength[clue.kind]].push(clue);
  return buckets.flatMap(shuffle);
}

function shrinkWhileUnique(working, stopAt, deadline) {
  for (const clue of shuffle(working)) {
    if (now() >= deadline || working.length <= stopAt) break;
    const trial = working.filter((item) => item.id !== clue.id);
    if (countSolutions(trial, { limit: 2 }) === 1) working = trial;
  }
  return working;
}

export function generatePuzzle(difficulty) {
  const normalizedDifficulty = difficulty in DIFFICULTY_TARGETS ? difficulty : "easy";
  const target = DIFFICULTY_TARGETS[normalizedDifficulty];
  const preferMax = normalizedDifficulty === "easy";
  const deadline = now() + 1500;

  for (let attempt = 0; attempt < 20; attempt++) {
    if (now() >= deadline) break;
    const answer = randomAnswer();
    const pool = orderPool(buildCandidateClues(answer));
    const selected = [];

    for (const clue of pool) {
      if (now() >= deadline) break;
      selected.push(clue);
      if (countSolutions(selected, { limit: 2 }) === 1) break;
      if (selected.length > 35) break;
    }
    if (countSolutions(selected, { limit: 2 }) !== 1) continue;

    let working = shrinkWhileUnique([...selected], target.min, deadline);
    if (preferMax && working.length < target.max) {
      for (const clue of pool) {
        if (now() >= deadline || working.length >= target.max) break;
        if (working.some((item) => item.id === clue.id)) continue;
        const trial = [...working, clue];
        if (countSolutions(trial, { limit: 2 }) === 1) working = trial;
      }
    }

    if (countSolutions(working, { limit: 2 }) !== 1) continue;
    const inTarget =
      working.length >= target.min && working.length <= target.max;
    if (preferMax && !inTarget) continue;

    return {
      answer,
      clues: working,
      meta: { usedFallback: false, clueCount: working.length },
    };
  }

  return {
    answer: structuredClone(FALLBACK_ANSWER),
    clues: FALLBACK_CLUES.map((clue) => structuredClone(clue)),
    meta: { usedFallback: true, clueCount: FALLBACK_CLUES.length },
  };
}
