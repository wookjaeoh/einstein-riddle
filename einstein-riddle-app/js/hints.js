import { LABELS, labelOf } from "./puzzle-data.js";

function hasBatchim(text) {
  const code = text.charCodeAt(text.length - 1);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
}

function particle(text, withBatchim, withoutBatchim) {
  return `${text}${hasBatchim(text) ? withBatchim : withoutBatchim}`;
}

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
    return `${house}번 집은 ${value} 집으로 확정할 수 있습니다.`;
  }
  if (cat === "nation") {
    return `${house}번 집은 ${value} 사람이 사는 집으로 확정할 수 있습니다.`;
  }
  if (cat === "drink") {
    return `${house}번 집의 음료는 ${value}${hasBatchim(value) ? "으로" : "로"} 확정할 수 있습니다.`;
  }
  if (cat === "food") {
    return `${house}번 집의 음식은 ${value}${hasBatchim(value) ? "으로" : "로"} 확정할 수 있습니다.`;
  }
  return `${house}번 집의 ${categoryLabel(cat)}은 ${particle(value, "으로", "로")} 확정할 수 있습니다.`;
}

function bundleCount(houseCount, categories) {
  if (houseCount <= 4 && categories.length <= 4) return 2;
  return 3;
}

function directionText(focusKind) {
  if (focusKind === "atHouse") return "위치가 직접 정해진 단서부터 확인해 보세요.";
  if (focusKind === "sameHouse") return "같은 집을 연결하는 단서부터 확인해 보세요.";
  if (focusKind === "nextTo") return "옆집 관계 단서를 먼저 연결해 보세요.";
  return "왼쪽·오른쪽 위치 단서를 먼저 확인해 보세요.";
}

function cluesText(firstNum, secondNum) {
  if (firstNum && secondNum && firstNum !== secondNum) {
    return `단서 ${firstNum}번과 ${secondNum}번을 함께 연결해 보세요.`;
  }
  return `단서 ${firstNum ?? 1}번을 다른 단서와 함께 연결해 보세요.`;
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

function clueRelatesToFact(clue, factPlacement, answer) {
  const houseNumber = factPlacement.houseIndex + 1;
  return (
    cluePlacements(clue).some(
      ({ cat, val }) =>
        val === factPlacement.val || answer[cat]?.indexOf(val) === factPlacement.houseIndex,
    ) ||
    clue?.houseIndex === factPlacement.houseIndex ||
    clue?.houseIds?.includes(houseNumber)
  );
}

function buildReasoning({ clues, clueIndices, anchor, factPlacement }) {
  const steps = [];
  const nums = (clueIndices ?? []).filter(Boolean);
  const primary = nums[0] ? clues[nums[0] - 1] : anchor;
  const secondary = nums[1] && nums[1] !== nums[0] ? clues[nums[1] - 1] : null;
  const house = factPlacement.houseIndex + 1;
  const value = labelOf(factPlacement.val);
  const catLabel = categoryLabel(factPlacement.cat);
  const primaryKind = primary?.kind ?? anchor.kind;

  if (primaryKind === "atHouse") {
    steps.push(`① 단서 ${nums[0] ?? clueIndex(clues, anchor.id)}: 「${clipQuote(primary?.text ?? anchor.text)}」 → ${house}번 집의 ${catLabel}이(가) 직접 정해집니다.`);
    steps.push(`② 따라서 ${house}번 집 ${catLabel} = ${value}`);
  } else if (primaryKind === "sameHouse") {
    steps.push(`① 단서 ${nums[0] ?? clueIndex(clues, anchor.id)}: 「${clipQuote(primary?.text ?? anchor.text)}」 → 두 속성이 같은 집입니다.`);
    if (secondary) {
      steps.push(`② 단서 ${nums[1]}: 「${clipQuote(secondary.text)}」 → 위치·속성을 이어서 좁힙니다.`);
      steps.push(`③ 따라서 ${house}번 집 ${catLabel} = ${value}`);
    } else {
      steps.push(`② 정답 배치와 맞추면 ${house}번 집 ${catLabel} = ${value}`);
    }
  } else {
    steps.push(`① 단서 ${nums[0] ?? clueIndex(clues, anchor.id)}: 「${clipQuote(primary?.text ?? anchor.text)}」 → 옆집/좌우 관계로 후보를 줄입니다.`);
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
      const supportCount = clues.filter((clue) => clueRelatesToFact(clue, candidate, answer)).length;
      if (!best || supportCount > best.supportCount) {
        best = { ...candidate, key, supportCount };
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
  const byKind = {
    atHouse: clues.filter((c) => c.kind === "atHouse"),
    sameHouse: clues.filter((c) => c.kind === "sameHouse"),
    nextTo: clues.filter((c) => c.kind === "nextTo"),
    leftOf: clues.filter((c) => c.kind === "leftOf"),
  };
  const order = ["atHouse", "sameHouse", "nextTo", "leftOf"];
  const anchors = [];
  const usedIds = new Set();

  for (const kind of order) {
    for (const clue of byKind[kind]) {
      if (anchors.length >= count) break;
      if (usedIds.has(clue.id)) continue;
      anchors.push({ focusKind: kind, anchor: clue });
      usedIds.add(clue.id);
    }
    if (anchors.length >= count) break;
  }

  while (anchors.length < count && clues.length) {
    const clue = clues[anchors.length % clues.length];
    if (!usedIds.has(clue.id)) {
      anchors.push({ focusKind: clue.kind, anchor: clue });
      usedIds.add(clue.id);
    } else {
      anchors.push({ focusKind: clue.kind, anchor: clue });
    }
    if (anchors.length >= count) break;
  }

  return anchors.slice(0, count);
}

function pickCluePair(clues, anchor, factPlacement, answer, usedPairs) {
  const anchorIndex = clueIndex(clues, anchor.id);
  const relatedIndices = clues
    .map((clue, index) => (clueRelatesToFact(clue, factPlacement, answer) ? index + 1 : null))
    .filter(Boolean);
  const primaryIndex = relatedIndices.includes(anchorIndex) ? anchorIndex : relatedIndices[0];
  const partnerIndices = relatedIndices.filter((index) => index !== primaryIndex);

  for (const partnerIndex of partnerIndices) {
    const key = [primaryIndex, partnerIndex].sort((a, b) => a - b).join(":");
    if (!usedPairs.has(key)) {
      usedPairs.add(key);
      return [primaryIndex, partnerIndex];
    }
  }

  const indices = [primaryIndex, partnerIndices[0]].filter(Boolean);
  usedPairs.add([...indices].sort((a, b) => a - b).join(":"));
  return indices;
}

/**
 * @param {{ clues: object[], answer: object, houseCount: number, categories: string[] }} input
 */
export function buildHints({ clues, answer, houseCount, categories }) {
  if (!Array.isArray(clues) || clues.length === 0) return [];

  const bundles = pickBundleAnchors(clues, bundleCount(houseCount, categories));
  const hints = [];
  const usedFacts = new Set();
  const usedPairs = new Set();

  bundles.forEach(({ focusKind, anchor }, index) => {
    const bundle = index + 1;
    let factPlacement = factFromClue(anchor, answer);
    if (!factPlacement) {
      factPlacement = factFromAnswer(answer, categories, houseCount, usedFacts, clues);
    } else {
      usedFacts.add(`${factPlacement.cat}:${factPlacement.val}:${factPlacement.houseIndex}`);
    }
    const [firstNum, secondNum] = pickCluePair(
      clues,
      anchor,
      factPlacement,
      answer,
      usedPairs,
    );

    hints.push({
      id: `h${bundle}-direction`,
      stage: "direction",
      text: directionText(focusKind),
      meta: { bundle, focusKind },
    });
    hints.push({
      id: `h${bundle}-clues`,
      stage: "clues",
      text: cluesText(firstNum, secondNum),
      meta: { bundle, clueIndices: [firstNum, secondNum].filter(Boolean) },
    });
    hints.push({
      id: `h${bundle}-fact`,
      stage: "fact",
      text: factTextForPlacement(factPlacement),
      reasoning: buildReasoning({
        clues,
        clueIndices: [firstNum, secondNum].filter(Boolean),
        anchor,
        factPlacement,
      }),
      meta: {
        bundle,
        cat: factPlacement.cat,
        val: factPlacement.val,
        houseIndex: factPlacement.houseIndex,
        clueIndices: [firstNum, secondNum].filter(Boolean),
      },
    });
  });

  return hints;
}

/**
 * @param {{ hints: object[], clues: object[], answer: object, houseCount: number, categories: string[] }} input
 */
export function validateHints({ hints, clues, answer, houseCount, categories }) {
  if (!Array.isArray(hints) || hints.length < 6) return false;
  if (!Array.isArray(clues) || !clues.length) return false;
  if (!answer || typeof answer !== "object") return false;

  const ids = new Set();
  for (const hint of hints) {
    if (!hint?.id || ids.has(hint.id)) return false;
    ids.add(hint.id);
  }

  const byBundle = new Map();
  for (const hint of hints) {
    const bundle = hint.meta?.bundle;
    if (!Number.isInteger(bundle)) return false;
    if (!byBundle.has(bundle)) byBundle.set(bundle, []);
    byBundle.get(bundle).push(hint);
  }
  if (byBundle.size < 2) return false;

  for (const [, group] of byBundle) {
    if (group.length !== 3) return false;
    const stages = group.map((hint) => hint.stage);
    if (stages[0] !== "direction" || stages[1] !== "clues" || stages[2] !== "fact") return false;

    const cluesHint = group.find((hint) => hint.stage === "clues");
    const indices = cluesHint?.meta?.clueIndices;
    if (!Array.isArray(indices) || !indices.length) return false;
    if (indices.some((index) => !Number.isInteger(index) || index < 1 || index > clues.length)) {
      return false;
    }

    const factHint = group.find((hint) => hint.stage === "fact");
    const { cat, val, houseIndex } = factHint?.meta ?? {};
    if (!categories.includes(cat)) return false;
    if (!Number.isInteger(houseIndex) || houseIndex < 0 || houseIndex >= houseCount) return false;
    if (answer[cat]?.[houseIndex] !== val) return false;
    if (!Array.isArray(factHint.reasoning) || factHint.reasoning.length < 2 || factHint.reasoning.length > 3) return false;
    if (factHint.reasoning.some((line) => typeof line !== "string" || !line.trim())) return false;
    if (!factHint.reasoning.some((line) => line.includes("「") && line.includes("」"))) return false;
  }

  return true;
}
