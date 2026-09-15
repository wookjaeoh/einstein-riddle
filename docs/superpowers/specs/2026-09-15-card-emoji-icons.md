# 카드 이모지 아이콘 설계

**날짜:** 2026-09-15  
**상태:** 구현 완료  
**기준 구현:** `einstein-riddle-app/` (카드 이모지 아이콘)

## 1. 목표

풀·보드(및 정답 공개 비행 고스트) 카드에 값별 유니코드 이모지를 한글 라벨과 함께 표시해, 국적·동물·음료·음식·색을 한눈에 구분할 수 있게 한다.

## 2. 확정 선택

| 항목 | 선택 |
|------|------|
| 범위 | 전 카테고리 (색·국적·음료·음식·동물) |
| 자산 | 유니코드 이모지 (오프라인·USB 가능) |
| 표시 위치 | 카드만 (단서·힌트 문구는 글자만) |
| 구현 | `ICONS` 맵 + `formatCardLabel` |

## 3. 데이터

`puzzle-data.js`:

```js
export const ICONS = {
  yellow: "🟡", blue: "🔵", red: "🔴", green: "🟢", white: "⚪",
  norway: "🇳🇴", denmark: "🇩🇰", england: "🇬🇧", germany: "🇩🇪", sweden: "🇸🇪",
  water: "💧", tea: "🍵", milk: "🥛", coffee: "☕", beer: "🍺",
  gimbap: "🍙", ramen: "🍜", chicken: "🍗", burger: "🍔", pizza: "🍕",
  cat: "🐱", horse: "🐴", bird: "🐦", fish: "🐟", dog: "🐕",
};

export function iconOf(id) {
  return ICONS[id] ?? "";
}

export function formatCardLabel(id) {
  const icon = iconOf(id);
  const label = labelOf(id);
  return icon ? `${icon} ${label}` : label;
}
```

- `VALUES`의 모든 값 id에 아이콘이 있어야 한다.
- 카테고리 키(`color`, `nation` 등)에는 아이콘을 두지 않는다.

## 4. UI

- `main.js` 보드 슬롯·풀 카드·`flyCardToSlot` 고스트 텍스트에 `formatCardLabel` 사용.
- 집 머리의 색 스와치(CSS `color-*`)는 유지하고, 색 행 카드에도 이모지를 병행한다.
- 단서 목록·힌트·피드백은 기존 한글 문구만 사용.

## 5. CSS·접근성

- `.card`는 flex/gap으로 아이콘·글자가 잘리지 않게 한다.
- `--text-scale` 배율에 따라 카드 글자·이모지가 함께 커진다.
- 보이는 문자열에 한글 라벨을 포함해 의미 전달을 보장한다.

## 6. 테스트

- 모든 `VALUES[*]` id에 대해 `iconOf(id)`가 비어 있지 않다.
- `formatCardLabel("england")`에 `🇬🇧`와 `영국`이 포함된다.
- `formatCardLabel("dog")`에 동물 이모지와 `개`가 포함된다.

## 7. 범위 밖

- 단서·힌트 본문 아이콘
- SVG/PNG·CDN 이미지
- 사용자 커스텀 아이콘 편집

## 8. 성공 기준

1. 모든 카드에 카테고리에 맞는 이모지+한글이 보인다.
2. 정답 공개 비행 카드에도 동일하다.
3. 오프라인(`serve` 로컬)에서도 동작한다.
4. 기존 드래그·힌트·정답 보기 회귀가 통과한다.
