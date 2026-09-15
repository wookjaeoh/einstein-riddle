# Card Emoji Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 풀·보드·정답 비행 카드에 값별 유니코드 이모지와 한글 라벨을 함께 표시한다.

**Architecture:** `puzzle-data.js`에 `ICONS`와 `formatCardLabel`을 두고, `main.js` 카드 렌더가 이를 소비한다. 단서·힌트 문구는 변경하지 않는다.

**Tech Stack:** Vanilla JS ES modules, CSS, Node `run-tests.mjs`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-15-card-emoji-icons.md`
- 전 카테고리 값에 이모지; 카드에만 표시; 단서/힌트는 글자만
- `formatCardLabel(id)` = `아이콘 + 공백 + 한글` (아이콘 없으면 라벨만)
- 국기/동물 등 명세 표의 이모지 사용 (england→🇬🇧, dog→🐕 등)
- Windows: commit env `Einstein Dev` / `dev@local`; no `git config`; PowerShell `git commit -m "..."`
- `run-tests.mjs` 변경 시 `run-tests.html` 동기화

---

## File Structure

| 파일 | 책임 |
|------|------|
| `einstein-riddle-app/js/puzzle-data.js` | `ICONS`, `iconOf`, `formatCardLabel` |
| `einstein-riddle-app/js/main.js` | 보드·풀·고스트에 `formatCardLabel` |
| `einstein-riddle-app/css/styles.css` | `.card` flex/gap, 잘림 방지 |
| `einstein-riddle-app/tests/run-tests.mjs` | 아이콘 커버리지 테스트 |
| `einstein-riddle-app/tests/run-tests.html` | 동기화 |
| `einstein-riddle-app/README.md` | 한 줄 안내 |

---

### Task 1: ICONS 맵과 formatCardLabel

**Files:**
- Modify: `einstein-riddle-app/js/puzzle-data.js`
- Modify: `einstein-riddle-app/tests/run-tests.mjs`
- Modify: `einstein-riddle-app/tests/run-tests.html`

**Interfaces:**
- Produces: `ICONS`, `iconOf(id): string`, `formatCardLabel(id): string`

- [ ] **Step 1: 실패 테스트**

```js
import { VALUES, ICONS, iconOf, formatCardLabel, labelOf } from "../js/puzzle-data.js";

for (const cat of Object.keys(VALUES)) {
  for (const id of VALUES[cat]) {
    assert(Boolean(iconOf(id)), `iconOf(${id}) non-empty`);
    assert(ICONS[id] === iconOf(id), `ICONS[${id}] matches iconOf`);
    assert(formatCardLabel(id).includes(labelOf(id)), `formatCardLabel includes Korean for ${id}`);
    assert(formatCardLabel(id).includes(iconOf(id)), `formatCardLabel includes icon for ${id}`);
  }
}
assert(formatCardLabel("england").includes("🇬🇧"), "england flag");
assert(formatCardLabel("england").includes("영국"), "england Korean");
assert(formatCardLabel("dog").includes("🐕") || formatCardLabel("dog").includes("🐶"), "dog emoji");
assert(formatCardLabel("dog").includes("개"), "dog Korean");
assert(iconOf("color") === "" || !ICONS.color, "category keys are not required in ICONS");
```

(구현은 명세대로 `dog: "🐕"`.)

- [ ] **Step 2: RED**

Run: `node --experimental-default-type=module einstein-riddle-app/tests/run-tests.mjs`  
Expected: `ICONS` / `formatCardLabel` 미정의로 실패.

- [ ] **Step 3: 구현**

`LABELS` 아래 `ICONS`를 명세 표대로 추가하고 `iconOf` / `formatCardLabel` export.

- [ ] **Step 4: GREEN**

Expected: 전체 통과.

- [ ] **Step 5: Commit**

```bash
git add einstein-riddle-app/js/puzzle-data.js einstein-riddle-app/tests
git commit -m "feat: add emoji icon map and formatCardLabel"
```

---

### Task 2: 카드 UI 적용 + CSS + README

**Files:**
- Modify: `einstein-riddle-app/js/main.js`
- Modify: `einstein-riddle-app/css/styles.css`
- Modify: `einstein-riddle-app/README.md`
- Modify: `docs/superpowers/specs/2026-09-15-card-emoji-icons.md` (상태 → 구현 완료)

**Interfaces:**
- Consumes: `formatCardLabel` from `puzzle-data.js`

- [ ] **Step 1: main.js에서 labelOf(카드용) 교체**

Import `formatCardLabel`. 다음 세 곳을 `formatCardLabel(...)`로 변경:

- 보드 슬롯 카드 텍스트
- 풀 카드 텍스트
- `flyCardToSlot`의 `ghost.textContent`

집 머리 `colorName`은 `labelOf` 유지(또는 `formatCardLabel` — 명세는 카드만; 집 머리는 스와치+한글만 유지).

- [ ] **Step 2: CSS**

```css
.card {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35em;
  white-space: nowrap;
}
```

기존 `.card` 규칙과 병합(중복 `display` 정리).

- [ ] **Step 3: README**

힌트/카드 절에 한 줄: 카드에 이모지 아이콘(국기·동물 등)+한글 라벨 표시.

명세 상태: `구현 완료`.

- [ ] **Step 4: 테스트·스모크**

Run: `node --experimental-default-type=module einstein-riddle-app/tests/run-tests.mjs`  
Expected: 통과.  
수동: localhost에서 풀 카드에 🇬🇧 등 보이는지 확인.

- [ ] **Step 5: Commit**

```bash
git add einstein-riddle-app/js/main.js einstein-riddle-app/css/styles.css einstein-riddle-app/README.md docs/superpowers/specs/2026-09-15-card-emoji-icons.md
git commit -m "feat: show emoji icons on board and pool cards"
```

---

## Self-Review

- Spec coverage: ICONS/API(Task 1), 카드 렌더·CSS·문서(Task 2). 단서 아이콘은 범위 밖.
- Placeholder scan: 없음.
- Consistency: `formatCardLabel` 명칭 통일.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-15-card-emoji-icons.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — 태스크별 서브에이전트 + 리뷰  
2. **Inline Execution** — 이 세션에서 바로 실행  

Which approach?
