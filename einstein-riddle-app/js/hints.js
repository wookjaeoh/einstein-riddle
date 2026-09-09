import { LABELS, labelOf } from "./puzzle-data.js";

function hasBatchim(text) {
  const code = text.charCodeAt(text.length - 1);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
}

function particle(text, withBatchim, withoutBatchim) {
  return `${text}${hasBatchim(text) ? withBatchim : withoutBatchim}`;
}

function clueNumber(clues, clueId) {
  const index = clues.findIndex((clue) => clue.id === clueId);
  return index >= 0 ? index + 1 : null;
}

function categoryLabel(cat) {
  return LABELS[cat] ?? cat;
}

function factTextForAtHouse(clue) {
  const house = clue.houseIndex + 1;
  const value = labelOf(clue.val);
  if (clue.cat === "color") {
    return `${house}번 집은 ${value} 집으로 확정할 수 있습니다.`;
  }
  if (clue.cat === "nation") {
    return `${house}번 집은 ${value} 사람이 사는 집으로 확정할 수 있습니다.`;
  }
  if (clue.cat === "drink") {
    return `${house}번 집의 음료는 ${value}${hasBatchim(value) ? "으로" : "로"} 확정할 수 있습니다.`;
  }
  if (clue.cat === "food") {
    return `${house}번 집의 음식은 ${value}${hasBatchim(value) ? "으로" : "로"} 확정할 수 있습니다.`;
  }
  return `${house}번 집의 ${categoryLabel(clue.cat)}은 ${particle(value, "으로", "로")} 확정할 수 있습니다.`;
}

function factTextFromAnswer(answer, categories, houseCount) {
  const preferred = ["drink", "food", "nation", "color", "animal"].filter((cat) =>
    categories.includes(cat),
  );
  const cat = preferred[0] ?? categories[0];
  const houseIndex = Math.min(2, houseCount - 1);
  const value = labelOf(answer[cat][houseIndex]);
  const house = houseIndex + 1;
  if (cat === "drink") {
    return `${house}번 집의 음료는 ${value}${hasBatchim(value) ? "으로" : "로"} 확정할 수 있습니다.`;
  }
  if (cat === "food") {
    return `${house}번 집의 음식은 ${value}${hasBatchim(value) ? "으로" : "로"} 확정할 수 있습니다.`;
  }
  if (cat === "nation") {
    return `${house}번 집은 ${value} 사람이 사는 집으로 확정할 수 있습니다.`;
  }
  if (cat === "color") {
    return `${house}번 집은 ${value} 집으로 확정할 수 있습니다.`;
  }
  return `${house}번 집의 ${categoryLabel(cat)}은 ${particle(value, "으로", "로")} 확정할 수 있습니다.`;
}

function pickCluePair(clues) {
  const atHouse = clues.filter((clue) => clue.kind === "atHouse");
  if (atHouse.length >= 2) {
    return [atHouse[0].id, atHouse[1].id];
  }
  if (atHouse.length === 1 && clues.length >= 2) {
    const partner = clues.find((clue) => clue.id !== atHouse[0].id);
    return partner ? [atHouse[0].id, partner.id] : [clues[0].id, clues[1]?.id ?? clues[0].id];
  }
  if (clues.length >= 2) {
    return [clues[0].id, clues[1].id];
  }
  return [clues[0]?.id, clues[0]?.id].filter(Boolean);
}

/**
 * @param {{ clues: object[], answer: object, houseCount: number, categories: string[] }} input
 * @returns {{ id: string, stage: "direction"|"clues"|"fact", text: string }[]}
 */
export function buildHints({ clues, answer, houseCount, categories }) {
  if (!Array.isArray(clues) || clues.length === 0) {
    return [];
  }

  const atHouseClues = clues.filter((clue) => clue.kind === "atHouse");
  const [firstId, secondId] = pickCluePair(clues);
  const firstNum = clueNumber(clues, firstId);
  const secondNum = clueNumber(clues, secondId);
  const anchorClue = atHouseClues[0] ?? clues[0];

  const directionText =
    atHouseClues.length > 0
      ? "위치가 직접 정해진 단서부터 확인해 보세요."
      : "같은 집을 연결하는 단서부터 확인해 보세요.";

  const cluesText =
    firstNum && secondNum && firstNum !== secondNum
      ? `단서 ${firstNum}번과 ${secondNum}번을 함께 연결해 보세요.`
      : `단서 ${firstNum ?? 1}번을 다른 단서와 함께 연결해 보세요.`;

  const factText =
    anchorClue?.kind === "atHouse"
      ? factTextForAtHouse(anchorClue)
      : factTextFromAnswer(answer, categories, houseCount);

  return [
    { id: "h1-direction", stage: "direction", text: directionText },
    { id: "h1-clues", stage: "clues", text: cluesText },
    { id: "h1-fact", stage: "fact", text: factText },
  ];
}
