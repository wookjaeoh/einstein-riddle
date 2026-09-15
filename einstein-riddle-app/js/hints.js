import { LABELS, labelOf } from "./puzzle-data.js";

function categoryLabel(cat) {
  return LABELS[cat] ?? cat;
}

function clueIndex(clues, clueId) {
  const index = clues.findIndex((clue) => clue.id === clueId);
  return index >= 0 ? index + 1 : null;
}

function factTextForPlacement({ cat, val, houseIndex }) {
  const house = houseIndex + 1;
  const value = labelOf(val);
  if (cat === "color") {
    return `${house}번 집은 ${value} 집입니다.`;
  }
  if (cat === "nation") {
    return `${house}번 집은 ${value} 사람이 삽니다.`;
  }
  if (cat === "drink") {
    return `${house}번 집의 음료는 ${value}입니다.`;
  }
  if (cat === "food") {
    return `${house}번 집의 음식은 ${value}입니다.`;
  }
  return `${house}번 집의 ${categoryLabel(cat)}은 ${value}입니다.`;
}

function answerHintText(firstNum, secondNum, factPlacement) {
  const fact = factTextForPlacement(factPlacement);
  if (firstNum && secondNum && firstNum !== secondNum) {
    return `단서 ${firstNum}번과 ${secondNum}번을 통해 ${fact}`;
  }
  return `단서 ${firstNum ?? 1}번을 통해 ${fact}`;
}

function bundleCount(houseCount, categories) {
  if (houseCount <= 4 && categories.length <= 4) return 2;
  return 3;
}

function clipQuote(text, max = 28) {
  const t = String(text ?? "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function cluePlacements(clue) {
  return [
    clue?.cat && clue?.val ? { cat: clue.cat, val: clue.val } : null,
    clue?.a,
    clue?.b,
  ].filter(Boolean);
}

function clueDirectlyMentionsFact(clue, factPlacement) {
  return (
    clue?.values?.includes(factPlacement.val) ||
    cluePlacements(clue).some(({ val }) => val === factPlacement.val)
  );
}

function clueRelationRank(clue, factPlacement, answer) {
  if (clueDirectlyMentionsFact(clue, factPlacement)) return 2;
  if (
    cluePlacements(clue).some(
      ({ cat, val }) => answer[cat]?.indexOf(val) === factPlacement.houseIndex,
    )
  ) {
    return 1;
  }
  return 0;
}

export function clueRelatesToFact(clue, factPlacement, answer) {
  return clueRelationRank(clue, factPlacement, answer) > 0;
}

function buildReasoning({ clues, clueIndices, anchor, factPlacement }) {
  const steps = [];
  const nums = (clueIndices ?? []).filter(Boolean);
  const primary = nums[0] ? clues[nums[0] - 1] : anchor;
  const secondary = nums[1] && nums[1] !== nums[0] ? clues[nums[1] - 1] : null;
  const house = factPlacement.houseIndex + 1;
  const value = labelOf(factPlacement.val);
  const catLabel = categoryLabel(factPlacement.cat);
  const primaryKind = primary?.kind ?? anchor?.kind;

  if (primaryKind === "atHouse") {
    steps.push(`① 단서 ${nums[0] ?? clueIndex(clues, anchor.id)}: 「${clipQuote(primary?.text ?? anchor.text)}」 → ${house}번 집의 ${catLabel}이(가) 직접 정해집니다.`);
    steps.push(`② 따라서 ${house}번 집 ${catLabel} = ${value}`);
  } else if (primaryKind === "sameHouse") {
    steps.push(`① 단서 ${nums[0] ?? clueIndex(clues, anchor.id)}: 「${clipQuote(primary?.text ?? anchor.text)}」 → 두 속성이 같은 집입니다.`);
    if (secondary) {
      steps.push(`② 단서 ${nums[1]}: 「${clipQuote(secondary.text)}」 → 속성을 이어서 좁힙니다.`);
      steps.push(`③ 따라서 ${house}번 집 ${catLabel} = ${value}`);
    } else {
      steps.push(`② 정답 배치와 맞추면 ${house}번 집 ${catLabel} = ${value}`);
    }
  } else {
    steps.push(`① 단서 ${nums[0] ?? clueIndex(clues, anchor.id)}: 「${clipQuote(primary?.text ?? anchor.text)}」 → 관련 단서로 후보를 줄입니다.`);
    if (secondary) {
      steps.push(`② 단서 ${nums[1]}: 「${clipQuote(secondary.text)}」 → 후보가 하나로 모입니다.`);
      steps.push(`③ 따라서 ${house}번 집 ${catLabel} = ${value}`);
    } else {
      steps.push(`② 따라서 ${house}번 집 ${catLabel} = ${value}`);
    }
  }
  return steps.slice(0, 3);
}

function factFromClue(clue, answer) {
  if (clue.kind === "atHouse") {
    return { cat: clue.cat, val: clue.val, houseIndex: clue.houseIndex };
  }
  if (clue.kind === "sameHouse") {
    const cat = clue.a.cat;
    const val = clue.a.val;
    const houseIndex = answer[cat]?.indexOf(val);
    if (houseIndex >= 0) return { cat, val, houseIndex };
  }
  return null;
}

function factFromAnswer(answer, categories, houseCount, usedFacts, clues) {
  const preferred = ["drink", "food", "nation", "color", "animal"].filter((cat) =>
    categories.includes(cat),
  );
  let best = null;
  for (const cat of preferred) {
    for (let houseIndex = 0; houseIndex < houseCount; houseIndex++) {
      const val = answer[cat][houseIndex];
      const key = `${cat}:${val}:${houseIndex}`;
      if (usedFacts.has(key)) continue;
      const candidate = { cat, val, houseIndex };
      const supportScore = clues.reduce(
        (score, clue) => score + clueRelationRank(clue, candidate, answer),
        0,
      );
      if (!best || supportScore > best.supportScore) {
        best = { ...candidate, key, supportScore };
      }
    }
  }
  if (best) {
    usedFacts.add(best.key);
    return { cat: best.cat, val: best.val, houseIndex: best.houseIndex };
  }
  const cat = categories[0];
  return { cat, val: answer[cat][0], houseIndex: 0 };
}

function pickBundleAnchors(clues, count) {
  const preferred = clues.filter((c) => c.kind === "atHouse" || c.kind === "sameHouse");
  const fallback = clues.filter((c) => c.kind !== "atHouse" && c.kind !== "sameHouse");
  const ordered = [...preferred, ...fallback];
  const anchors = [];
  const usedIds = new Set();

  for (const clue of ordered) {
    if (anchors.length >= count) break;
    if (usedIds.has(clue.id)) continue;
    anchors.push({ anchor: clue });
    usedIds.add(clue.id);
  }

  while (anchors.length < count && clues.length) {
    const clue = clues[anchors.length % clues.length];
    anchors.push({ anchor: clue });
  }

  return anchors.slice(0, count);
}

function pickCluePair(clues, anchor, factPlacement, answer, usedPairs) {
  const relatedIndices = clues
    .map((clue, index) => ({
      index: index + 1,
      rank: clueRelationRank(clue, factPlacement, answer),
    }))
    .filter(({ rank }) => rank > 0)
    .sort((left, right) => right.rank - left.rank)
    .map(({ index }) => index);

  if (!relatedIndices.length) return [];

  const anchorIndex = clueIndex(clues, anchor?.id);
  const topRank = clueRelationRank(clues[relatedIndices[0] - 1], factPlacement, answer);
  const anchorRank = anchorIndex
    ? clueRelationRank(clues[anchorIndex - 1], factPlacement, answer)
    : 0;
  const primaryIndex =
    anchorRank === topRank && relatedIndices.includes(anchorIndex)
      ? anchorIndex
      : relatedIndices[0];
  const partnerIndices = relatedIndices.filter((index) => index !== primaryIndex);

  for (const partnerIndex of partnerIndices) {
    const key = [primaryIndex, partnerIndex].sort((a, b) => a - b).join(":");
    if (!usedPairs.has(key)) {
      usedPairs.add(key);
      return [primaryIndex, partnerIndex];
    }
  }

  // Prefer a two-clue path when a second related clue exists (even if pair reused).
  if (partnerIndices[0]) {
    const indices = [primaryIndex, partnerIndices[0]];
    usedPairs.add([...indices].sort((a, b) => a - b).join(":"));
    return indices;
  }

  usedPairs.add(String(primaryIndex));
  return [primaryIndex];
}

/**
 * Hints only state which clue number(s) yield a concrete answer fact.
 * @param {{ clues: object[], answer: object, houseCount: number, categories: string[] }} input
 */
export function buildHints({ clues, answer, houseCount, categories }) {
  if (!Array.isArray(clues) || clues.length === 0) return [];

  const target = bundleCount(houseCount, categories);
  const hints = [];
  const usedFacts = new Set();
  const usedPairs = new Set();
  const anchors = pickBundleAnchors(clues, Math.max(target * 2, target));

  for (const { anchor } of anchors) {
    if (hints.length >= target) break;

    let factPlacement = factFromClue(anchor, answer);
    if (!factPlacement) {
      factPlacement = factFromAnswer(answer, categories, houseCount, usedFacts, clues);
    } else {
      const key = `${factPlacement.cat}:${factPlacement.val}:${factPlacement.houseIndex}`;
      if (usedFacts.has(key)) {
        factPlacement = factFromAnswer(answer, categories, houseCount, usedFacts, clues);
      } else {
        usedFacts.add(key);
      }
    }

    const indices = pickCluePair(clues, anchor, factPlacement, answer, usedPairs).filter(Boolean);
    if (!indices.length) continue;
    if (!indices.every((index) => clueRelatesToFact(clues[index - 1], factPlacement, answer))) {
      continue;
    }

    const bundle = hints.length + 1;
    hints.push({
      id: `h${bundle}-answer`,
      stage: "fact",
      text: answerHintText(indices[0], indices[1], factPlacement),
      reasoning: buildReasoning({
        clues,
        clueIndices: indices,
        anchor,
        factPlacement,
      }),
      meta: {
        bundle,
        cat: factPlacement.cat,
        val: factPlacement.val,
        houseIndex: factPlacement.houseIndex,
        clueIndices: indices,
      },
    });
  }

  return hints;
}

/**
 * @param {{ hints: object[], clues: object[], answer: object, houseCount: number, categories: string[] }} input
 */
export function validateHints({ hints, clues, answer, houseCount, categories }) {
  if (!Array.isArray(hints) || hints.length < 2) return false;
  if (!Array.isArray(clues) || !clues.length) return false;
  if (!answer || typeof answer !== "object") return false;

  const ids = new Set();
  for (const hint of hints) {
    if (!hint?.id || ids.has(hint.id)) return false;
    ids.add(hint.id);
    if (hint.stage !== "fact") return false;
    if (!/단서\s+\d+번/.test(hint.text ?? "")) return false;

    const indices = hint.meta?.clueIndices;
    if (!Array.isArray(indices) || !indices.length) return false;
    if (indices.some((index) => !Number.isInteger(index) || index < 1 || index > clues.length)) {
      return false;
    }
    if (
      !indices.every((index) =>
        clueRelatesToFact(clues[index - 1], hint.meta, answer),
      )
    ) {
      return false;
    }

    const { cat, val, houseIndex } = hint.meta ?? {};
    if (!categories.includes(cat)) return false;
    if (!Number.isInteger(houseIndex) || houseIndex < 0 || houseIndex >= houseCount) return false;
    if (answer[cat]?.[houseIndex] !== val) return false;
    if (!Array.isArray(hint.reasoning) || hint.reasoning.length < 2 || hint.reasoning.length > 3) {
      return false;
    }
    if (hint.reasoning.some((line) => typeof line !== "string" || !line.trim())) return false;
    if (!hint.reasoning.some((line) => line.includes("「") && line.includes("」"))) return false;
  }

  return true;
}
