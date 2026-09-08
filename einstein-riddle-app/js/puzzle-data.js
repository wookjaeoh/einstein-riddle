export const HOUSES = [1, 2, 3, 4, 5];

export const CATEGORIES = ["color", "nation", "drink", "food", "animal"];

export const LABELS = {
  color: "색",
  nation: "국적",
  drink: "음료",
  food: "음식",
  animal: "동물",
  yellow: "노랑",
  blue: "파랑",
  red: "빨강",
  green: "초록",
  white: "하양",
  norway: "노르웨이",
  denmark: "덴마크",
  england: "영국",
  germany: "독일",
  sweden: "스웨덴",
  water: "물",
  tea: "차",
  milk: "우유",
  coffee: "커피",
  beer: "맥주",
  gimbap: "김밥",
  ramen: "라면",
  chicken: "치킨",
  burger: "햄버거",
  pizza: "피자",
  cat: "고양이",
  horse: "말",
  bird: "새",
  fish: "물고기",
  dog: "개",
};

export const VALUES = {
  color: ["yellow", "blue", "red", "green", "white"],
  nation: ["norway", "denmark", "england", "germany", "sweden"],
  drink: ["water", "tea", "milk", "coffee", "beer"],
  food: ["gimbap", "ramen", "chicken", "burger", "pizza"],
  animal: ["cat", "horse", "bird", "fish", "dog"],
};

/** index 0 = house 1 — 폴백 정답 */
export const FALLBACK_ANSWER = {
  color: ["yellow", "blue", "red", "green", "white"],
  nation: ["norway", "denmark", "england", "germany", "sweden"],
  drink: ["water", "tea", "milk", "coffee", "beer"],
  food: ["gimbap", "ramen", "chicken", "burger", "pizza"],
  animal: ["cat", "horse", "bird", "fish", "dog"],
};

export const ANSWER = FALLBACK_ANSWER; // 별칭(테스트·폴백)

export const FALLBACK_CLUES = [
  { id: "c1", kind: "sameHouse", a: { cat: "nation", val: "england" }, b: { cat: "color", val: "red" }, text: "영국 사람은 빨간 집에 산다.", categories: ["nation", "color"], values: ["england", "red"] },
  { id: "c2", kind: "sameHouse", a: { cat: "nation", val: "sweden" }, b: { cat: "animal", val: "dog" }, text: "스웨덴 사람은 개를 기른다.", categories: ["nation", "animal"], values: ["sweden", "dog"] },
  { id: "c3", kind: "sameHouse", a: { cat: "nation", val: "denmark" }, b: { cat: "drink", val: "tea" }, text: "덴마크 사람은 차를 마신다.", categories: ["nation", "drink"], values: ["denmark", "tea"] },
  { id: "c4", kind: "leftOf", a: { cat: "color", val: "green" }, b: { cat: "color", val: "white" }, text: "초록 집은 하얀 집의 왼쪽(바로 옆)에 있다.", houseIds: [4, 5], categories: ["color"], values: ["green", "white"] },
  { id: "c5", kind: "sameHouse", a: { cat: "color", val: "green" }, b: { cat: "drink", val: "coffee" }, text: "초록 집에 사는 사람은 커피를 마신다.", categories: ["color", "drink"], values: ["green", "coffee"] },
  { id: "c6", kind: "sameHouse", a: { cat: "food", val: "chicken" }, b: { cat: "animal", val: "bird" }, text: "치킨을 먹는 사람은 새를 기른다.", categories: ["food", "animal"], values: ["chicken", "bird"] },
  { id: "c7", kind: "sameHouse", a: { cat: "color", val: "yellow" }, b: { cat: "food", val: "gimbap" }, text: "노란 집에 사는 사람은 김밥을 먹는다.", categories: ["color", "food"], values: ["yellow", "gimbap"] },
  { id: "c8", kind: "atHouse", cat: "drink", val: "milk", houseIndex: 2, text: "가운데(3번) 집에 사는 사람은 우유를 마신다.", houseIds: [3], categories: ["drink"], values: ["milk"] },
  { id: "c9", kind: "atHouse", cat: "nation", val: "norway", houseIndex: 0, text: "노르웨이 사람은 1번 집에 산다.", houseIds: [1], categories: ["nation"], values: ["norway"] },
  { id: "c10", kind: "nextTo", a: { cat: "food", val: "ramen" }, b: { cat: "animal", val: "cat" }, text: "라면을 먹는 사람은 고양이를 기르는 사람의 옆집에 산다.", categories: ["food", "animal"], values: ["ramen", "cat"] },
  { id: "c11", kind: "nextTo", a: { cat: "animal", val: "horse" }, b: { cat: "food", val: "gimbap" }, text: "말을 기르는 사람은 김밥을 먹는 사람의 옆집에 산다.", categories: ["animal", "food"], values: ["horse", "gimbap"] },
  { id: "c12", kind: "sameHouse", a: { cat: "food", val: "pizza" }, b: { cat: "drink", val: "beer" }, text: "피자를 먹는 사람은 맥주를 마신다.", categories: ["food", "drink"], values: ["pizza", "beer"] },
  { id: "c13", kind: "sameHouse", a: { cat: "nation", val: "germany" }, b: { cat: "food", val: "burger" }, text: "독일 사람은 햄버거를 먹는다.", categories: ["nation", "food"], values: ["germany", "burger"] },
  { id: "c14", kind: "nextTo", a: { cat: "nation", val: "norway" }, b: { cat: "color", val: "blue" }, text: "노르웨이 사람은 파란 집 옆집에 산다.", houseIds: [1, 2], categories: ["nation", "color"], values: ["norway", "blue"] },
  { id: "c15", kind: "nextTo", a: { cat: "food", val: "ramen" }, b: { cat: "drink", val: "water" }, text: "라면을 먹는 사람은 물을 마시는 사람의 옆집에 산다.", categories: ["food", "drink"], values: ["ramen", "water"] },
];

export const CLUES = FALLBACK_CLUES;

export const DIFFICULTY_PROFILES = Object.freeze({
  easy: Object.freeze({
    id: "easy",
    label: "쉬움",
    houseCount: 4,
    categories: Object.freeze(["color", "nation", "drink", "food"]),
    clueRange: Object.freeze([10, 12]),
    minimize: false,
  }),
  normal: Object.freeze({
    id: "normal",
    label: "보통",
    houseCount: 4,
    categories: Object.freeze([...CATEGORIES]),
    clueRange: Object.freeze([12, 14]),
    minimize: false,
  }),
  hard: Object.freeze({
    id: "hard",
    label: "어려움",
    houseCount: 5,
    categories: Object.freeze([...CATEGORIES]),
    clueRange: Object.freeze([15, 15]),
    minimize: false,
  }),
  expert: Object.freeze({
    id: "expert",
    label: "매우 어려움",
    houseCount: 5,
    categories: Object.freeze([...CATEGORIES]),
    clueRange: Object.freeze([12, 14]),
    minimize: true,
  }),
});

// 이전 API를 사용하는 코드가 Task 2에서 전환될 때까지 호환성을 유지한다.
export const DIFFICULTY_TARGETS = {
  easy: { min: 10, max: 12 },
  normal: { min: 12, max: 14 },
  hard: { min: 15, max: 15 },
  expert: { min: 12, max: 14 },
};

export function labelOf(id) {
  return LABELS[id] ?? id;
}
