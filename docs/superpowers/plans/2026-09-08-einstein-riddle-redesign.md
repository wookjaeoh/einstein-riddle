# Einstein Riddle Difficulty, Hint, and Dark UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 추론 게임을 4단계 가변 퍼즐 엔진으로 확장하고, 단계형 힌트·단서 읽음 표시·다크블루 UI·100~200% 글자 배율을 추가하며 교사 기능을 제거한다.

**Architecture:** `DIFFICULTY_PROFILES`가 집 수·활성 카테고리·단서 정책을 정의한다. 솔버와 생성기는 런타임 퍼즐 구성 `{ houseCount, categories, values }`을 입력받아 가변 크기로 동작한다. 상태는 배치·읽은 단서·힌트 진행을 보관하고, UI는 현재 퍼즐 구성만 렌더링한다.

**Tech Stack:** HTML5, CSS3, Vanilla JavaScript ES modules, Node 기반 테스트 러너.

## Global Constraints

- 난이도 순서와 ID: `easy`(쉬움), `normal`(보통), `hard`(어려움), `expert`(매우 어려움).
- 쉬움: 4집, 색·국적·음료·음식, 단서 10~12개.
- 보통: 4집, 색·국적·음료·음식·동물, 단서 12~14개.
- 어려움: 5집, 모든 카테고리, 단서 15개 내외.
- 매우 어려움: 5집, 모든 카테고리, 유일해 최소 집합(주로 12~14개).
- 4집 문제는 카테고리마다 원본 5개 중 4개 값을 무작위 선택한다.
- 모든 생성 문제는 유일해이거나 검증된 난이도별 폴백이어야 한다.
- 단서 클릭은 읽음 표시만 토글하며 힌트 상태를 변경하지 않는다.
- 힌트는 별도 버튼으로 하단에 누적하며 방향→관련 단서→확정 사실 순으로 구체화한다.
- 교사 버튼·패널·코드·테스트를 삭제한다.
- 네이비 데이터랩 색상과 높은 명암 대비를 적용한다.
- 글자 배율 기본 150%, 10% 간격, 최소 100%, 최대 200%, `localStorage` 저장.
- 새 문제는 배치·Undo·타이머·읽음·힌트를 초기화한다. 초기화 버튼은 배치만 초기화한다.
- 상세 설계: `docs/superpowers/specs/2026-09-08-einstein-riddle-redesign.md`.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `js/puzzle-data.js` | 값·난이도 프로필·난이도별 폴백 |
| `js/solver.js` | 가변 집 수·카테고리 솔버 |
| `js/generate.js` | 프로필 기반 문제·단서 생성 |
| `js/hints.js` | 단계형 힌트 생성 |
| `js/state.js` | 런타임 퍼즐·배치·읽음·힌트 상태 |
| `js/clues.js` | 읽음 토글 단서 UI |
| `js/text-scale.js` | 글자 배율 계산·저장·DOM 적용 |
| `js/main.js` | 가변 보드·힌트·배율 조립 |
| `css/styles.css` | 네이비 테마·가변 보드·확대 대응 |
| `index.html` | 4단계 난이도·힌트·배율 컨트롤 |
| `tests/run-tests.mjs` | 자동 회귀 테스트 |
| `tests/run-tests.html` | 브라우저 테스트 |
| `js/teacher.js` | 삭제 |

---

### Task 1: 난이도 프로필과 가변 솔버

**Files:**
- Modify: `einstein-riddle-app/js/puzzle-data.js`
- Modify: `einstein-riddle-app/js/solver.js`
- Modify: `einstein-riddle-app/tests/run-tests.mjs`
- Modify: `einstein-riddle-app/tests/run-tests.html`

**Interfaces:**
- Produces `DIFFICULTY_PROFILES: Record<Difficulty, PuzzleProfile>`.
- `PuzzleProfile = { id, label, houseCount, categories, clueRange, minimize }`.
- `countSolutions(clues, { limit, deadline, shouldAbort, houseCount, categories, values })`.
- `isUniqueSolution(clues, config)`.
- `answerSatisfiesClues(answer, clues, config)`.

- [ ] **Step 1: 실패 테스트 추가**

```js
const expectedProfiles = {
  easy: { houseCount: 4, categories: ["color", "nation", "drink", "food"] },
  normal: { houseCount: 4, categories: ["color", "nation", "drink", "food", "animal"] },
  hard: { houseCount: 5, categories: CATEGORIES },
  expert: { houseCount: 5, categories: CATEGORIES },
};
for (const [id, expected] of Object.entries(expectedProfiles)) {
  assert(DIFFICULTY_PROFILES[id].houseCount === expected.houseCount, `${id} house count`);
  assert(JSON.stringify(DIFFICULTY_PROFILES[id].categories) === JSON.stringify(expected.categories), `${id} categories`);
}
assert(countSolutions([], {
  limit: 2,
  houseCount: 4,
  categories: ["color"],
  values: { color: ["yellow", "blue", "red", "green"] },
}) === 2, "variable solver supports 4 houses");
```

- [ ] **Step 2: RED 확인**

Run: `node --experimental-default-type=module einstein-riddle-app/tests/run-tests.mjs`  
Expected: `DIFFICULTY_PROFILES` 미정의 또는 가변 솔버 테스트 실패.

- [ ] **Step 3: 프로필과 가변 솔버 구현**

```js
export const DIFFICULTY_PROFILES = Object.freeze({
  easy: {
    id: "easy", label: "쉬움", houseCount: 4,
    categories: ["color", "nation", "drink", "food"],
    clueRange: [10, 12], minimize: false,
  },
  normal: {
    id: "normal", label: "보통", houseCount: 4,
    categories: [...CATEGORIES],
    clueRange: [12, 14], minimize: false,
  },
  hard: {
    id: "hard", label: "어려움", houseCount: 5,
    categories: [...CATEGORIES],
    clueRange: [15, 15], minimize: false,
  },
  expert: {
    id: "expert", label: "매우 어려움", houseCount: 5,
    categories: [...CATEGORIES],
    clueRange: [12, 14], minimize: true,
  },
});
```

솔버에서 고정 `5`, 전역 `CATEGORIES`, 전역 `VALUES` 사용을 모두 옵션의 `houseCount`, `categories`, `values`로 교체한다. 순열 캐시는 집 수별 `Map<number, number[][]>`로 유지한다. 전달하지 않으면 기존 5×5 기본값을 사용해 이전 폴백 테스트를 보존한다.

- [ ] **Step 4: GREEN 확인**

Run: `node --experimental-default-type=module einstein-riddle-app/tests/run-tests.mjs`  
Expected: 모든 기존 테스트와 새 프로필·4집 솔버 테스트 통과.

- [ ] **Step 5: Commit**

```bash
git add einstein-riddle-app/js/puzzle-data.js einstein-riddle-app/js/solver.js einstein-riddle-app/tests/run-tests.mjs einstein-riddle-app/tests/run-tests.html
git commit -m "feat: generalize solver for four difficulty profiles"
```

---

### Task 2: 프로필 기반 생성기와 단계형 힌트

**Files:**
- Modify: `einstein-riddle-app/js/generate.js`
- Create: `einstein-riddle-app/js/hints.js`
- Modify: `einstein-riddle-app/js/puzzle-data.js`
- Modify: `einstein-riddle-app/tests/run-tests.mjs`
- Modify: `einstein-riddle-app/tests/run-tests.html`

**Interfaces:**
- `generatePuzzle(difficulty, options?): RuntimePuzzle`.
- `RuntimePuzzle = { houseCount, categories, values, answer, clues, hints, difficulty, meta }`.
- `buildHints({ clues, answer, houseCount, categories }): Hint[]`.
- `Hint = { id: string, stage: "direction"|"clues"|"fact", text: string }`.

- [ ] **Step 1: 실패 테스트 추가**

```js
for (const id of ["easy", "normal", "hard", "expert"]) {
  const puzzle = generatePuzzle(id, { timeLimitMs: 2500 });
  const profile = DIFFICULTY_PROFILES[id];
  assert(puzzle.houseCount === profile.houseCount, `${id} generated house count`);
  assert(JSON.stringify(puzzle.categories) === JSON.stringify(profile.categories), `${id} categories`);
  assert(isUniqueSolution(puzzle.clues, puzzle), `${id} unique`);
  assert(answerSatisfiesClues(puzzle.answer, puzzle.clues, puzzle), `${id} answer satisfies clues`);
}
const easy = generatePuzzle("easy", { timeLimitMs: 2500 });
assert(!easy.categories.includes("animal"), "easy excludes animal");
assert(!("animal" in easy.answer), "easy answer excludes animal");
assert(Object.values(easy.values).every((row) => row.length === 4), "easy selects four values");
assert(easy.hints[0].stage === "direction", "first hint direction");
assert(easy.hints[1].stage === "clues", "second hint clue guidance");
assert(easy.hints[2].stage === "fact", "third hint fact");
```

- [ ] **Step 2: RED 확인**

Expected: 런타임 구성·힌트 미정의로 실패.

- [ ] **Step 3: 생성기 구현**

`generatePuzzle`은 프로필을 조회한 뒤:

1. 카테고리별 값을 `shuffle(VALUES[cat]).slice(0, houseCount)`로 선택한다.
2. 선택값을 다시 섞어 answer를 만든다.
3. 선택된 `categories`끼리만 단서 후보를 만든다.
4. 가변 솔버 옵션으로 유일해를 만든다.
5. `hard`는 15개까지 보강하고 `expert`는 최소 집합을 유지한다.
6. `buildHints` 결과를 포함한다.
7. 제한시간 소진 시 같은 `houseCount/categories`를 가진 난이도별 폴백을 반환한다.

`buildHints`는 직접 위치 단서를 우선해 각 추론 묶음마다 아래 3개를 생성한다.

```js
[
  { id: "h1-direction", stage: "direction", text: "위치가 직접 정해진 단서부터 확인해 보세요." },
  { id: "h1-clues", stage: "clues", text: "단서 2번과 5번을 함께 연결해 보세요." },
  { id: "h1-fact", stage: "fact", text: "3번 집의 음료는 우유로 확정할 수 있습니다." },
]
```

문구의 번호·값은 현재 생성 단서와 answer에서 계산하며 정적 예시를 그대로 사용하지 않는다.

- [ ] **Step 4: GREEN·벤치**

Run:

```bash
node --experimental-default-type=module einstein-riddle-app/tests/run-tests.mjs
node --experimental-default-type=module einstein-riddle-app/tests/benchmark-generator.mjs
```

Expected: 네 난이도 유일해. 쉬움에 animal 없음. 비폴백 hard 단서 수 > expert 단서 수. 각 결과 2.1초 검증 경계 이내.

- [ ] **Step 5: Commit**

```bash
git add einstein-riddle-app/js/generate.js einstein-riddle-app/js/hints.js einstein-riddle-app/js/puzzle-data.js einstein-riddle-app/tests
git commit -m "feat: generate variable puzzles with staged hints"
```

---

### Task 3: 게임 상태·단서 읽음·힌트 진행·배율 모델

**Files:**
- Modify: `einstein-riddle-app/js/state.js`
- Modify: `einstein-riddle-app/js/clues.js`
- Create: `einstein-riddle-app/js/text-scale.js`
- Modify: `einstein-riddle-app/tests/run-tests.mjs`
- Modify: `einstein-riddle-app/tests/run-tests.html`

**Interfaces:**
- State: `getPuzzle()`, `toggleClueRead(id)`, `isClueRead(id)`, `revealNextHint()`, `getRevealedHints()`.
- Scale: `createTextScale({ storage, initial = 150, min = 100, max = 200, step = 10 })`.
- Scale object: `get()`, `increase()`, `decrease()`, `canIncrease()`, `canDecrease()`, `apply(root)`.

- [ ] **Step 1: 실패 테스트**

```js
game.loadPuzzle(runtimePuzzle);
game.toggleClueRead(runtimePuzzle.clues[0].id);
assert(game.isClueRead(runtimePuzzle.clues[0].id), "clue read toggles on");
assert(game.getRevealedHints().length === 0, "clue toggle does not reveal hint");
assert(game.revealNextHint().stage === "direction", "first reveal direction");
assert(game.revealNextHint().stage === "clues", "second reveal clue guidance");
assert(game.revealNextHint().stage === "fact", "third reveal fact");

const memory = new Map();
const storage = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v) };
const scale = createTextScale({ storage });
assert(scale.get() === 150, "scale defaults 150");
for (let i = 0; i < 9; i++) scale.increase();
assert(scale.get() === 200 && !scale.canIncrease(), "scale capped 200");
for (let i = 0; i < 20; i++) scale.decrease();
assert(scale.get() === 100 && !scale.canDecrease(), "scale floored 100");
```

- [ ] **Step 2: RED 확인**

- [ ] **Step 3: 상태·읽음 UI·배율 구현**

`loadPuzzle`은 answer/clues만 복사하지 말고 런타임 퍼즐 전체를 방어적으로 복사한다. `readClueIds = new Set()`과 `revealedHintCount = 0`을 새 문제마다 초기화한다. `resetPlacement`에서는 유지한다.

`renderClues`는 버튼에 `aria-pressed`, `data-read`, `✓` 표시를 주고 클릭 시 `onToggleRead(clue.id)`만 호출한다. 기존 `applyHighlight`와 관련 선택 상태는 제거한다.

`text-scale.js`는 키 `einstein-text-scale`을 사용하고 잘못된 저장값은 150으로 보정한다. `apply(root)`는 `root.style.setProperty("--text-scale", String(value / 100))`를 호출한다.

- [ ] **Step 4: GREEN 확인**

- [ ] **Step 5: Commit**

```bash
git add einstein-riddle-app/js/state.js einstein-riddle-app/js/clues.js einstein-riddle-app/js/text-scale.js einstein-riddle-app/tests
git commit -m "feat: add clue progress hints and text scaling state"
```

---

### Task 4: 가변 UI·네이비 테마·교사 기능 제거

**Files:**
- Modify: `einstein-riddle-app/index.html`
- Modify: `einstein-riddle-app/css/styles.css`
- Modify: `einstein-riddle-app/js/main.js`
- Delete: `einstein-riddle-app/js/teacher.js`
- Modify: `einstein-riddle-app/tests/run-tests.mjs`
- Modify: `einstein-riddle-app/tests/run-tests.html`

**Interfaces:**
- Consumes Task 1~3 런타임 퍼즐·상태·배율 API.
- Produces `#btn-hint`, `#hint-list`, `#scale-down`, `#scale-value`, `#scale-up`.

- [ ] **Step 1: DOM 계약 실패 테스트 추가**

테스트에서 `index.html` 문자열을 읽어 다음을 검증한다.

```js
assert(html.includes('value="normal"'), "normal option exists");
assert(html.includes('value="expert"'), "expert option exists");
assert(html.includes('id="btn-hint"'), "hint button exists");
assert(html.includes('id="scale-up"'), "scale controls exist");
assert(!html.includes('id="btn-teacher"'), "teacher button removed");
assert(!mainSource.includes("./teacher.js"), "teacher import removed");
```

- [ ] **Step 2: RED 확인**

- [ ] **Step 3: HTML·main 구현**

- 난이도 option을 쉬움→보통→어려움→매우 어려움 순서로 둔다.
- 교사 section 전체를 삭제한다.
- 피드백 아래에 힌트 section과 오른쪽 하단 배율 컨트롤을 추가한다.
- `renderBoard`는 `game.getPuzzle().houseCount/categories`로 열·행을 만든다.
- `renderPool`은 `game.getPuzzle().values`만 사용한다.
- `btn-hint`는 `revealNextHint()` 후 누적 목록을 렌더하고 소진 문구를 표시한다.
- `scale-up/down`은 배율 모델 갱신→적용→표시→버튼 disabled를 수행한다.
- 교사 import·binding·refresh를 삭제한다.

- [ ] **Step 4: 네이비 CSS 구현**

```css
:root {
  --page-bg: #071525;
  --panel-bg: #0d2238;
  --panel-alt: #102a44;
  --border: #24415e;
  --text: #e8f2ff;
  --text-muted: #a8bdd2;
  --accent: #64d9ff;
  --success: #5de0a3;
  --error: #ff7b8a;
  --text-scale: 1.5;
}
html { font-size: calc(16px * var(--text-scale)); }
.board { grid-template-columns: minmax(5.5rem, auto) repeat(var(--house-count), minmax(7rem, 1fr)); }
.play { min-width: 0; overflow-x: auto; }
.scale-controls { position: fixed; right: 1.25rem; bottom: 1.25rem; }
```

전체 기존 밝은 배경·검은 카드 색상을 위 변수 기반으로 교체한다. 단서 읽음 상태는 체크 표시·투명도·취소선으로 구분하고 색상만으로 표시하지 않는다.

- [ ] **Step 5: teacher 삭제·GREEN 확인**

Run: `node --experimental-default-type=module einstein-riddle-app/tests/run-tests.mjs`  
Expected: 교사 관련 테스트 제거 후 전체 통과.

- [ ] **Step 6: Commit**

```bash
git add einstein-riddle-app
git commit -m "feat: ship navy variable board UI and remove teacher mode"
```

---

### Task 5: 통합 검증·문서화

**Files:**
- Modify: `einstein-riddle-app/README.md`
- Modify: `docs/superpowers/specs/2026-09-08-einstein-riddle-redesign.md`

- [ ] **Step 1: 자동 테스트**

```bash
node --experimental-default-type=module einstein-riddle-app/tests/run-tests.mjs
node --experimental-default-type=module einstein-riddle-app/tests/benchmark-generator.mjs
```

Expected: 실패 0. 네 난이도 결과가 모두 유일해 또는 검증 폴백. 비폴백 hard 단서 수가 expert보다 많음.

- [ ] **Step 2: 정적 서버 스모크**

```bash
npx --yes serve einstein-riddle-app -l 4173
```

확인:

- 초기 난이도 쉬움, 4집, 동물 행 없음
- 난이도 순서 쉬움·보통·어려움·매우 어려움
- 단서 클릭 시 읽음만 변경
- 힌트 버튼 3회가 방향→단서→사실 순으로 누적
- 배율 100·150·200%에서 컨트롤 제한
- 교사 버튼 없음

- [ ] **Step 3: README 갱신**

README에 4개 난이도 표, 힌트 사용법, 배율 조절법, 교사 모드 제거, 테스트 명령, 수업 전 태블릿·프로젝터 확인 항목을 기록한다.

- [ ] **Step 4: 명세 상태 갱신**

상태를 `구현 완료, 실기기 수업 전 검증 대기`로 변경하고 실제 테스트·벤치 수치를 기록한다.

- [ ] **Step 5: Commit**

```bash
git add einstein-riddle-app/README.md docs/superpowers/specs/2026-09-08-einstein-riddle-redesign.md
git commit -m "docs: document four difficulty redesign"
```

---

## Self-Review

- Spec coverage: 난이도(Task 1~2), 힌트(Task 2~4), 읽음(Task 3~4), 교사 제거(Task 4), 다크 UI(Task 4), 배율(Task 3~4), 검증·문서(Task 5).
- Placeholder scan: 미정 항목이나 구현 연기 문구 없음.
- Type consistency: `RuntimePuzzle`, `PuzzleProfile`, 솔버 옵션, 상태 API 이름을 전 Task에서 통일.
- Scope: 계정·점수·편집기·교사 기능은 포함하지 않음.
