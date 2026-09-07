# 아인슈타인 추론 게임 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 고2 수업용으로, 단서를 보고 5채 집에 속성 카드를 드래그해 배치·제출하는 아인슈타인형 추론 웹앱을 HTML/CSS/JS만으로 만든다. 난이도별로 **알고리즘이 새 문제(유일해)** 를 생성해 반복 풀이가 가능하다.

**Architecture:** `einstein-riddle-app/` 정적 단일 페이지. `generate.js`+`solver.js`가 난이도별 단서 수 목표로 퍼즐을 만들고, `state.js`가 현재 판·배치·Undo·타이머를 보관, `validate.js`가 **현재 정답** 대비 틀린 칸 수만 채점. 폴백 고전 세트는 `puzzle-data.js`. ES module + 로컬 정적 서버.

**Tech Stack:** HTML5, CSS3, Vanilla JS (ES modules). 테스트는 `tests/run-tests.html`의 간단 assert. 빌드 도구·프레임워크 없음.

## Global Constraints

- 대상: 고등학교 2학년; UI·단서 문구는 한국어.
- 속성 카테고리: 색, 국적, 음료, 음식, 동물 (흡연 속성 사용 금지).
- 학생 제출 피드백: 틀린 칸 개수만 (위치·정답 비공개).
- 교사 모드: 같은 PC, 비밀번호 기본 `teacher2026`, **현재 생성 판** 정답 표시.
- MVP: 단서 하이라이트, Undo/초기화, 경과 타이머, 터치 드래그, **「새 문제」알고리즘 생성**. 칸 정답 힌트·단서 편집기·제한시간 강제·집 개수 가변 없음.
- 난이도: 집 5채 고정. 쉬움 목표 단서 **12~15**, 어려움 **8~11**. 유일해 필수. 실패 시 최대 20회 재시도 후 폴백.
- 「새 문제」/난이도 변경: 확인 후 재생성, 배치·Undo 초기화, **타이머 리셋**. 초기화(배치만)는 타이머·문제 유지.
- 드롭 규칙: 찬 슬롯이면 맞바꿈; 화면 밖 드롭은 원위치.
- 접근성: 집 번호 + 색 이름 병기.
- 명세: `docs/superpowers/specs/2026-09-07-einstein-riddle-design.md`

---

## File Structure

| 경로 | 책임 |
|------|------|
| `einstein-riddle-app/index.html` | 화면 뼈대·스크립트 진입 |
| `einstein-riddle-app/css/styles.css` | 레이아웃·그리드·드래그·반응형 |
| `einstein-riddle-app/js/puzzle-data.js` | 값·라벨·폴백 퍼즐·`DIFFICULTY_TARGETS` |
| `einstein-riddle-app/js/solver.js` | 단서 집합 해 개수 계산 |
| `einstein-riddle-app/js/generate.js` | 난이도별 퍼즐 생성 |
| `einstein-riddle-app/js/state.js` | 현재 퍼즐·배치·Undo·타이머 |
| `einstein-riddle-app/js/validate.js` | `grade(placement, answer)` |
| `einstein-riddle-app/js/drag-drop.js` | 포인터 드래그 |
| `einstein-riddle-app/js/clues.js` | 단서 목록·하이라이트 |
| `einstein-riddle-app/js/teacher.js` | 교사 패널(현재 answer) |
| `einstein-riddle-app/js/main.js` | 조립·「새 문제」 |
| `einstein-riddle-app/README.md` | 실행·교사 안내 |
| `einstein-riddle-app/tests/run-tests.html` | validate/state/solver/generate 테스트 |

---

### Task 1: 폴더 뼈대 + README + 테스트 하네스

**Files:**
- Create: `einstein-riddle-app/index.html`
- Create: `einstein-riddle-app/css/styles.css`
- Create: `einstein-riddle-app/js/.gitkeep` (이후 파일로 대체)
- Create: `einstein-riddle-app/README.md`
- Create: `einstein-riddle-app/tests/run-tests.html`

**Interfaces:**
- Consumes: 없음
- Produces: 실행 가능한 빈 페이지 골격, 테스트 페이지 골격

- [ ] **Step 1: 디렉터리와 README 작성**

`einstein-riddle-app/README.md`:

```markdown
# 아인슈타인 추론 게임 (수업용)

고2 대상. 단서를 읽고 5채 집에 색·국적·음료·음식·동물을 배치하는 추론 웹앱.

## 실행 방법

프로젝트 폴더에서:

```bash
npx --yes serve .
```

브라우저에서 안내된 주소로 `index.html`을 연다.  
(`file://` 직접 열기는 ES module 때문에 실패할 수 있음)

## 교사 모드

화면의 「교사」→ 비밀번호 `teacher2026` (학생 유인물에는 적지 말 것)

## 출처

고전 얼룩말/아인슈타인형 논리 퍼즐을 수업용으로 한국어 각색. 음식 카테고리로 흡연 속성을 대체함.
```

- [ ] **Step 2: 최소 `index.html` 작성**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>아인슈타인 추론 게임</title>
  <link rel="stylesheet" href="css/styles.css" />
</head>
<body>
  <header class="top-bar">
    <h1>아인슈타인 추론 게임</h1>
    <p class="tagline">단서를 읽고 다섯 채의 집을 맞혀 보세요</p>
  </header>
  <main id="app">
    <p>로딩 중…</p>
  </main>
  <script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 3: 최소 CSS**

```css
:root {
  --bg: #f3f6f4;
  --ink: #1a2e28;
  --accent: #0d6e5a;
  --line: #c5d4ce;
  --warn: #b33b2e;
  --ok: #1b6b3a;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: "Pretendard", "Noto Sans KR", sans-serif;
  background: linear-gradient(160deg, #e8f2ee 0%, #f7f3ea 55%, #eef1f5 100%);
  color: var(--ink);
  min-height: 100vh;
}
.top-bar { padding: 1rem 1.25rem 0.5rem; }
.top-bar h1 { margin: 0; font-size: clamp(1.4rem, 3vw, 2rem); }
.tagline { margin: 0.25rem 0 0; opacity: 0.8; }
#app { padding: 0.75rem 1.25rem 2rem; }
```

- [ ] **Step 4: 테스트 하네스**

`einstein-riddle-app/tests/run-tests.html`:

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>Einstein tests</title>
</head>
<body>
  <h1>Tests</h1>
  <pre id="out"></pre>
  <script type="module">
    const out = document.getElementById("out");
    let failed = 0;
    function assert(cond, msg) {
      if (!cond) {
        failed++;
        out.textContent += "FAIL: " + msg + "\n";
      } else {
        out.textContent += "ok: " + msg + "\n";
      }
    }
    window.__assert = assert;
    window.__done = () => {
      out.textContent += failed === 0 ? "\nALL PASSED\n" : `\n${failed} FAILED\n`;
    };
    out.textContent = "harness ready — add imports in later tasks\n";
    window.__done();
  </script>
</body>
</html>
```

- [ ] **Step 5: 로컬 서버로 index 확인**

Run: `npx --yes serve "einstein-riddle-app"`  
Expected: 브라우저에 제목 「아인슈타인 추론 게임」과 「로딩 중…」 (main.js 없으면 콘솔 404 — Task 2 이후 해소). 우선 HTML/CSS만 보이면 Step 2~3까지 성공으로 본다.  
임시로 `js/main.js`에 `console.log("main stub");` 한 줄 넣어 404를 없앤다.

```js
// einstein-riddle-app/js/main.js
console.log("main stub");
document.getElementById("app").innerHTML = "<p>스캐폴드 OK</p>";
```

- [ ] **Step 6: Commit (git 사용 시)**

```bash
git add einstein-riddle-app
git commit -m "chore: scaffold einstein riddle app shell"
```

git 저장소가 없으면 이 Step은 건너뛴다.

---

### Task 2: `puzzle-data.js` — 퍼즐 데이터

**Files:**
- Create: `einstein-riddle-app/js/puzzle-data.js`
- Modify: `einstein-riddle-app/tests/run-tests.html`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `CATEGORIES: string[]`
  - `HOUSES: number[]` → `[1,2,3,4,5]`
  - `VALUES: Record<category, string[]>`
  - `FALLBACK_ANSWER`, `FALLBACK_CLUES` (고전 1세트 — 생성 실패 시)
  - `DIFFICULTY_TARGETS: { easy: { min: 12, max: 15 }, hard: { min: 8, max: 11 } }`
  - `LABELS`, `labelOf(id)`
  - (호환용) `ANSWER`/`CLUES`는 폴백과 동일 별칭 가능

정답 폴백(고전 각색, 음식=담배 대체):

| 집 | 색 | 국적 | 음료 | 음식 | 동물 |
|----|----|------|------|------|------|
| 1 | 노랑 | 노르웨이 | 물 | 김밥 | 고양이 |
| 2 | 파랑 | 덴마크 | 차 | 라면 | 말 |
| 3 | 빨강 | 영국 | 우유 | 치킨 | 새 |
| 4 | 초록 | 독일 | 커피 | 햄버거 | 물고기 |
| 5 | 하양 | 스웨덴 | 맥주 | 피자 | 개 |

- [ ] **Step 1: `puzzle-data.js` 작성**

```js
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
  { id: "c1", text: "영국 사람은 빨간 집에 산다.", categories: ["nation", "color"], values: ["england", "red"] },
  { id: "c2", text: "스웨덴 사람은 개를 기른다.", categories: ["nation", "animal"], values: ["sweden", "dog"] },
  { id: "c3", text: "덴마크 사람은 차를 마신다.", categories: ["nation", "drink"], values: ["denmark", "tea"] },
  { id: "c4", text: "초록 집은 하얀 집의 왼쪽(바로 옆)에 있다.", houseIds: [4, 5], categories: ["color"], values: ["green", "white"] },
  { id: "c5", text: "초록 집에 사는 사람은 커피를 마신다.", categories: ["color", "drink"], values: ["green", "coffee"] },
  { id: "c6", text: "치킨을 먹는 사람은 새를 기른다.", categories: ["food", "animal"], values: ["chicken", "bird"] },
  { id: "c7", text: "노란 집에 사는 사람은 김밥을 먹는다.", categories: ["color", "food"], values: ["yellow", "gimbap"] },
  { id: "c8", text: "가운데(3번) 집에 사는 사람은 우유를 마신다.", houseIds: [3], categories: ["drink"], values: ["milk"] },
  { id: "c9", text: "노르웨이 사람은 1번 집에 산다.", houseIds: [1], categories: ["nation"], values: ["norway"] },
  { id: "c10", text: "라면을 먹는 사람은 고양이를 기르는 사람의 옆집에 산다.", categories: ["food", "animal"], values: ["ramen", "cat"] },
  { id: "c11", text: "말을 기르는 사람은 김밥을 먹는 사람의 옆집에 산다.", categories: ["animal", "food"], values: ["horse", "gimbap"] },
  { id: "c12", text: "피자를 먹는 사람은 맥주를 마신다.", categories: ["food", "drink"], values: ["pizza", "beer"] },
  { id: "c13", text: "독일 사람은 햄버거를 먹는다.", categories: ["nation", "food"], values: ["germany", "burger"] },
  { id: "c14", text: "노르웨이 사람은 파란 집 옆집에 산다.", houseIds: [1, 2], categories: ["nation", "color"], values: ["norway", "blue"] },
  { id: "c15", text: "라면을 먹는 사람은 물을 마시는 사람의 옆집에 산다.", categories: ["food", "drink"], values: ["ramen", "water"] },
];

export const CLUES = FALLBACK_CLUES;

export const DIFFICULTY_TARGETS = {
  easy: { min: 12, max: 15 },
  hard: { min: 8, max: 11 },
};

export function labelOf(id) {
  return LABELS[id] ?? id;
}
```

> **Note:** 예전 `clueIdsEasy` / `clueIdsHard` 고정 숨김 방식은 **폐기**. 난이도는 Task 11 생성기가 단서 개수로 처리한다. 폴백 테스트는 `FALLBACK_CLUES.length === 15`만 검증.

- [ ] **Step 2: 데이터 무결성 테스트 추가**

`run-tests.html` — 폴백 무결성:

```html
<script type="module">
  import {
    CATEGORIES, VALUES, FALLBACK_ANSWER, FALLBACK_CLUES, HOUSES, DIFFICULTY_TARGETS,
  } from "../js/puzzle-data.js";

  const out = document.getElementById("out");
  let failed = 0;
  function assert(cond, msg) {
    out.textContent += (cond ? "ok: " : "FAIL: ") + msg + "\n";
    if (!cond) failed++;
  }

  assert(HOUSES.length === 5, "5 houses");
  assert(CATEGORIES.length === 5, "5 categories");
  for (const cat of CATEGORIES) {
    assert(VALUES[cat].length === 5, cat + " has 5 values");
    assert(FALLBACK_ANSWER[cat].length === 5, cat + " answer length");
    assert(new Set(FALLBACK_ANSWER[cat]).size === 5, cat + " answer unique");
  }
  assert(FALLBACK_CLUES.length === 15, "fallback 15 clues");
  assert(DIFFICULTY_TARGETS.easy.min === 12, "easy min");
  assert(DIFFICULTY_TARGETS.hard.max === 11, "hard max");

  out.textContent += failed === 0 ? "\nALL PASSED\n" : `\n${failed} FAILED\n`;
</script>
```

- [ ] **Step 3: 테스트 실행**

Run: `npx --yes serve einstein-riddle-app` 후 `/tests/run-tests.html` 열기  
Expected: `ALL PASSED`

- [ ] **Step 4: Commit**

```bash
git add einstein-riddle-app/js/puzzle-data.js einstein-riddle-app/tests/run-tests.html
git commit -m "feat: add puzzle values, fallback set, difficulty targets"
```

---

### Task 3: `validate.js` — 채점

**Files:**
- Create: `einstein-riddle-app/js/validate.js`
- Modify: `einstein-riddle-app/tests/run-tests.html`

**Interfaces:**
- Consumes: `CATEGORIES` (선택), 호출부가 넘기는 `answer`
- Produces:
  - `countWrong(placement, answer): number`
  - `isComplete(placement): boolean`
  - `grade(placement, answer): { complete, wrongCount, solved }`

- [ ] **Step 1: 실패하는 테스트를 run-tests에 추가 (validate import 후 assert)**

```js
  import { countWrong, isComplete, grade } from "../js/validate.js";
  import { FALLBACK_ANSWER, CATEGORIES } from "../js/puzzle-data.js";

  const empty = Object.fromEntries(CATEGORIES.map((c) => [c, [null, null, null, null, null]]));
  assert(isComplete(empty) === false, "empty incomplete");
  assert(countWrong(FALLBACK_ANSWER, FALLBACK_ANSWER) === 0, "answer has 0 wrong");
  assert(grade(FALLBACK_ANSWER, FALLBACK_ANSWER).solved === true, "answer solved");

  const oneWrong = structuredClone(FALLBACK_ANSWER);
  oneWrong.animal[3] = "dog";
  assert(countWrong(oneWrong, FALLBACK_ANSWER) >= 1, "tampered answer has wrong cells");
```

- [ ] **Step 2: 테스트 실행 — FAIL 확인**

Expected: validate.js 없음 → 모듈 로드 실패 또는 FAIL

- [ ] **Step 3: `validate.js` 구현**

```js
import { CATEGORIES } from "./puzzle-data.js";

export function isComplete(placement) {
  for (const cat of CATEGORIES) {
    const row = placement[cat];
    if (!row || row.length !== 5) return false;
    for (const v of row) {
      if (v == null || v === "") return false;
    }
  }
  return true;
}

export function countWrong(placement, answer) {
  let n = 0;
  for (const cat of CATEGORIES) {
    for (let i = 0; i < 5; i++) {
      if (placement[cat][i] !== answer[cat][i]) n++;
    }
  }
  return n;
}

export function grade(placement, answer) {
  const complete = isComplete(placement);
  if (!complete) {
    return { complete: false, wrongCount: null, solved: false };
  }
  const wrongCount = countWrong(placement, answer);
  return { complete: true, wrongCount, solved: wrongCount === 0 };
}
```

- [ ] **Step 4: 테스트 재실행 — ALL PASSED**

- [ ] **Step 5: Commit**

```bash
git add einstein-riddle-app/js/validate.js einstein-riddle-app/tests/run-tests.html
git commit -m "feat: add placement grading against current answer"
```

---

### Task 4: `state.js` — 배치·Undo·타이머·현재 퍼즐

**Files:**
- Create: `einstein-riddle-app/js/state.js`
- Modify: `einstein-riddle-app/tests/run-tests.html`

**Interfaces:**
- Consumes: `CATEGORIES`, `VALUES`, `FALLBACK_ANSWER`, `FALLBACK_CLUES` from puzzle-data
- Produces: `createGameState()` → 객체:
  - `loadPuzzle({ answer, clues, difficulty })` — 배치·히스토리 비움, 타이머 리셋
  - `getAnswer()`, `getClues()`, `getPlacement()`, `getDifficulty()`
  - `resetPlacement({ keepTimer })`
  - `moveCard({ value, category, from, to })`
  - `undo()`, `canUndo()`
  - `ensureTimerStarted()`, `stopTimer()`, `getElapsedMs()`, `isTimerRunning()`
  - ~~`getActiveClueIds` / `setDifficulty`만으로 단서 숨김~~ → 난이도 변경은 main에서 재생성 후 `loadPuzzle`

- [ ] **Step 1: 테스트에 state 시나리오 추가**

```js
  import { createGameState } from "../js/state.js";
  import { FALLBACK_ANSWER, FALLBACK_CLUES } from "../js/puzzle-data.js";

  const g = createGameState();
  g.loadPuzzle({ answer: FALLBACK_ANSWER, clues: FALLBACK_CLUES, difficulty: "easy" });
  assert(g.getDifficulty() === "easy", "default easy");
  assert(g.getClues().length === 15, "fallback 15 clues");
  assert(g.getAnswer().nation[0] === "norway", "fallback norway house1");

  const placed = g.moveCard({
    value: "norway",
    category: "nation",
    from: { type: "pool" },
    to: { type: "slot", houseIndex: 0, category: "nation" },
  });
  assert(placed === true, "move to empty slot");
  assert(g.getPlacement().nation[0] === "norway", "norway in house1");
  assert(g.canUndo() === true, "can undo");
  g.undo();
  assert(g.getPlacement().nation[0] == null, "undone");
```

- [ ] **Step 2: FAIL 확인 후 `state.js` 구현**

초기 구현은 Task 4 본문의 `createGameState`를 쓰되, 다음을 **반드시** 포함한다:

```js
  let answer = null;
  let clues = [];
  let difficulty = "easy";

  // loadPuzzle({ answer, clues, difficulty }) {
  //   this.answer = clone answer; this.clues = [...clues];
  //   placement = empty; history = []; timer reset;
  // }
  // getAnswer / getClues
```

`setDifficulty`만으로 단서를 숨기지 않는다. `moveCard`·Undo·타이머 로직은 기존 계획 본문(권장 최종 타이머)을 따른다.

> 구현 시 기존 계획에 있던 `clueIdsEasy`/`clueIdsHard` import·`getActiveClueIds`는 **삭제**한다.

- [ ] **Step 3: 테스트 ALL PASSED**

- [ ] **Step 4: Commit**

```bash
git add einstein-riddle-app/js/state.js einstein-riddle-app/tests/run-tests.html
git commit -m "feat: game state holds current generated puzzle"
```

---

### Task 4b: (참고) 아래 구 버전 state 스케치는 `loadPuzzle`로 대체됨

구 계획의 `setDifficulty`→`getActiveClueIds` 코드 블록이 파일 하단에 남아 있으면 **따르지 말고** 위 Interfaces를 따른다.

---

### Task 5: `index.html` UI 골격 + 그리드 CSS

**Files:**
- Modify: `einstein-riddle-app/index.html`
- Modify: `einstein-riddle-app/css/styles.css`
- Modify: `einstein-riddle-app/js/main.js`

**Interfaces:**
- Consumes: state, puzzle-data labels
- Produces: DOM 구조 — `#toolbar`(난이도·**새 문제**·타이머 등), `#clues`, `#board`, `#pool`, `#feedback`, `#teacher-panel`

- [ ] **Step 1: `index.html` main 영역 마크업으로 교체**

```html
  <main id="app">
    <section class="toolbar" id="toolbar">
      <label>난이도
        <select id="difficulty">
          <option value="easy">쉬움</option>
          <option value="hard">어려움</option>
        </select>
      </label>
      <button type="button" id="btn-new">새 문제</button>
      <div class="timer" id="timer" aria-live="polite">00:00</div>
      <button type="button" id="btn-undo" disabled>되돌리기</button>
      <button type="button" id="btn-reset">초기화</button>
      <button type="button" id="btn-submit" class="primary">제출</button>
      <button type="button" id="btn-teacher">교사</button>
    </section>

    <p class="help" id="help-easy">카드를 집의 칸으로 끌어다 놓고, 단서를 눌러 관련 칸을 강조해 보세요.</p>

    <div class="layout">
      <aside id="clues" class="clues" aria-label="단서 목록"></aside>
      <section class="play">
        <div id="board" class="board" aria-label="다섯 채의 집"></div>
        <div id="pool" class="pool" aria-label="카드 풀"></div>
      </section>
    </div>

    <p id="feedback" class="feedback" role="status"></p>

    <section id="teacher-panel" class="teacher-panel hidden" aria-hidden="true">
      <h2>교사 패널</h2>
      <div id="teacher-login">
        <input type="password" id="teacher-pw" placeholder="비밀번호" />
        <button type="button" id="btn-teacher-unlock">열기</button>
        <p id="teacher-error" class="error"></p>
      </div>
      <div id="teacher-body" class="hidden">
        <div id="answer-board"></div>
        <div id="compare"></div>
      </div>
    </section>
  </main>
```

- [ ] **Step 2: 보드·풀·툴바 CSS 추가** (`styles.css`에 append)

```css
.toolbar {
  display: flex; flex-wrap: wrap; gap: 0.5rem 0.75rem; align-items: center;
  margin-bottom: 0.75rem;
}
.toolbar .primary {
  background: var(--accent); color: #fff; border: none; padding: 0.45rem 0.9rem;
  border-radius: 6px; cursor: pointer; font-weight: 600;
}
.toolbar button, .toolbar select {
  font: inherit; padding: 0.4rem 0.7rem; border-radius: 6px; border: 1px solid var(--line);
  background: #fff; cursor: pointer;
}
.timer { font-variant-numeric: tabular-nums; font-weight: 700; min-width: 4rem; }
.layout {
  display: grid; grid-template-columns: minmax(220px, 320px) 1fr; gap: 1rem;
}
@media (max-width: 900px) {
  .layout { grid-template-columns: 1fr; }
}
.clues {
  background: rgba(255,255,255,0.7); border: 1px solid var(--line);
  border-radius: 10px; padding: 0.75rem; max-height: 70vh; overflow: auto;
}
.clue-item {
  text-align: left; width: 100%; margin: 0 0 0.4rem; padding: 0.5rem 0.6rem;
  border-radius: 8px; border: 1px solid transparent; background: #fff; cursor: pointer;
}
.clue-item.active { border-color: var(--accent); background: #e7f5f0; }
.board {
  display: grid;
  grid-template-columns: 88px repeat(5, minmax(72px, 1fr));
  gap: 4px; align-items: stretch;
}
.house-head, .row-label, .slot {
  border: 1px solid var(--line); background: #fff; min-height: 52px;
  display: flex; align-items: center; justify-content: center; text-align: center;
  font-size: 0.85rem; border-radius: 8px; padding: 0.25rem;
}
.house-head { font-weight: 700; flex-direction: column; gap: 0.15rem; }
.house-swatch { width: 100%; height: 8px; border-radius: 4px; }
.slot { touch-action: none; }
.slot.drop-target { outline: 2px solid var(--accent); }
.slot.highlight, .house-head.highlight { box-shadow: 0 0 0 3px rgba(13,110,90,0.35); }
.card {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0.35rem 0.5rem; margin: 0.15rem; border-radius: 8px;
  background: #1a2e28; color: #fff; cursor: grab; user-select: none;
  touch-action: none; font-size: 0.8rem;
}
.card.dragging { opacity: 0.7; cursor: grabbing; }
.pool {
  margin-top: 0.75rem; padding: 0.75rem; border: 1px dashed var(--line);
  border-radius: 10px; background: rgba(255,255,255,0.55); min-height: 64px;
}
.feedback { min-height: 1.5rem; font-weight: 600; }
.feedback.ok { color: var(--ok); }
.feedback.bad { color: var(--warn); }
.teacher-panel {
  margin-top: 1rem; padding: 1rem; border: 2px solid var(--accent);
  border-radius: 10px; background: #fff;
}
.hidden { display: none !important; }
.error { color: var(--warn); }
.color-yellow { background: #e6c84a; }
.color-blue { background: #4a7fd4; }
.color-red { background: #d4534a; }
.color-green { background: #3f9b5f; }
.color-white { background: #f2f2f2; border: 1px solid #ccc; }
```

- [ ] **Step 3: `main.js`에 보드·풀 정적 렌더 (드래그 전)**

```js
import { CATEGORIES, HOUSES, VALUES, LABELS, labelOf } from "./puzzle-data.js";
import { createGameState } from "./state.js";

const game = createGameState();

function renderBoard() {
  const board = document.getElementById("board");
  const placement = game.getPlacement();
  let html = `<div class="row-label"></div>`;
  for (const h of HOUSES) {
    const colorId = placement.color[h - 1];
    const colorName = colorId ? labelOf(colorId) : "색 미정";
    html += `<div class="house-head" data-house="${h}">
      <span>${h}번 집</span>
      <span class="house-swatch ${colorId ? "color-" + colorId : ""}"></span>
      <small>${colorName}</small>
    </div>`;
  }
  for (const cat of CATEGORIES) {
    html += `<div class="row-label">${LABELS[cat]}</div>`;
    for (let i = 0; i < 5; i++) {
      const v = placement[cat][i];
      html += `<div class="slot" data-house-index="${i}" data-category="${cat}">
        ${v ? `<span class="card" draggable="false" data-value="${v}" data-category="${cat}">${labelOf(v)}</span>` : ""}
      </div>`;
    }
  }
  board.innerHTML = html;
}

function renderPool() {
  const pool = document.getElementById("pool");
  const placement = game.getPlacement();
  const used = new Set(CATEGORIES.flatMap((c) => placement[c].filter(Boolean)));
  let html = "";
  for (const cat of CATEGORIES) {
    for (const v of VALUES[cat]) {
      if (used.has(v)) continue;
      html += `<span class="card" data-value="${v}" data-category="${cat}">${labelOf(v)}</span>`;
    }
  }
  pool.innerHTML = html || "<span>모든 카드가 배치되었습니다</span>";
}

function renderAll() {
  renderBoard();
  renderPool();
  document.getElementById("btn-undo").disabled = !game.canUndo();
}

renderAll();
```

- [ ] **Step 4: 브라우저에서 5×5 그리드와 카드 풀이 보이는지 확인**

Expected: 집 헤더 1~5, 행 라벨 한글, 풀에 카드 25장.

- [ ] **Step 5: Commit**

```bash
git add einstein-riddle-app/index.html einstein-riddle-app/css/styles.css einstein-riddle-app/js/main.js
git commit -m "feat: render house grid and card pool"
```

---

### Task 6: `drag-drop.js` — 마우스·터치 드래그

**Files:**
- Create: `einstein-riddle-app/js/drag-drop.js`
- Modify: `einstein-riddle-app/js/main.js`

**Interfaces:**
- Consumes: `game.moveCard`, 렌더 콜백
- Produces: `bindDragDrop({ root, onMove })` — `.card` pointerdown 시작, `.slot`/`.pool`에 드롭

- [ ] **Step 1: `drag-drop.js` 구현**

```js
export function bindDragDrop({ boardEl, poolEl, onDrop }) {
  let dragging = null; // { value, category, el }
  let ghost = null;

  function clearTargets() {
    document.querySelectorAll(".drop-target").forEach((el) => el.classList.remove("drop-target"));
  }

  function placeGhost(x, y) {
    if (!ghost) return;
    ghost.style.transform = `translate(${x - 40}px, ${y - 20}px)`;
  }

  function onPointerDown(e) {
    const card = e.target.closest(".card");
    if (!card || !card.dataset.value) return;
    e.preventDefault();
    dragging = {
      value: card.dataset.value,
      category: card.dataset.category,
      el: card,
    };
    card.classList.add("dragging");
    ghost = card.cloneNode(true);
    ghost.style.position = "fixed";
    ghost.style.pointerEvents = "none";
    ghost.style.zIndex = "9999";
    ghost.style.left = "0";
    ghost.style.top = "0";
    document.body.appendChild(ghost);
    placeGhost(e.clientX, e.clientY);
    card.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    if (!dragging) return;
    placeGhost(e.clientX, e.clientY);
    clearTargets();
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const slot = el?.closest?.(".slot");
    if (slot && slot.dataset.category === dragging.category) {
      slot.classList.add("drop-target");
    } else if (el?.closest?.("#pool")) {
      poolEl.classList.add("drop-target");
    }
  }

  function onPointerUp(e) {
    if (!dragging) return;
    const { value, category, el } = dragging;
    clearTargets();
    ghost?.remove();
    ghost = null;
    el.classList.remove("dragging");

    const target = document.elementFromPoint(e.clientX, e.clientY);
    const slot = target?.closest?.(".slot");
    let to = null;
    if (slot && slot.dataset.category === category) {
      to = {
        type: "slot",
        houseIndex: Number(slot.dataset.houseIndex),
        category,
      };
    } else if (target?.closest?.("#pool")) {
      to = { type: "pool" };
    }

    dragging = null;
    if (!to) return; // snap back via re-render
    onDrop({ value, category, to });
  }

  const root = document.getElementById("app");
  root.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
}
```

- [ ] **Step 2: `main.js`에서 바인딩**

```js
import { bindDragDrop } from "./drag-drop.js";

bindDragDrop({
  boardEl: document.getElementById("board"),
  poolEl: document.getElementById("pool"),
  onDrop({ value, category, to }) {
    game.moveCard({ value, category, from: { type: "pool" }, to });
    renderAll();
  },
});
```

- [ ] **Step 3: 수동 테스트**

- PC: 국적 카드 「노르웨이」를 1번 집 국적 칸에 드롭 → 유지  
- 같은 행 다른 칸으로 드래그 → 이동/교체  
- 풀로 되돌리기  
- (가능하면) 태블릿 터치 동일  

- [ ] **Step 4: Commit**

```bash
git add einstein-riddle-app/js/drag-drop.js einstein-riddle-app/js/main.js
git commit -m "feat: add pointer drag-and-drop for cards"
```

---

### Task 7: `clues.js` — 단서 목록·하이라이트

**Files:**
- Create: `einstein-riddle-app/js/clues.js`
- Modify: `einstein-riddle-app/js/main.js`

**Interfaces:**
- Consumes: `CLUES`, `game.getActiveClueIds()`
- Produces: `renderClues({ container, activeIds, selectedId, onSelect })`, `applyHighlight(clue|null)`

- [ ] **Step 1: `clues.js` 작성**

```js
import { CLUES } from "./puzzle-data.js";

export function renderClues({ container, activeIds, selectedId, onSelect }) {
  const set = new Set(activeIds);
  container.innerHTML = "<h2>단서</h2>";
  CLUES.filter((c) => set.has(c.id)).forEach((clue, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "clue-item" + (clue.id === selectedId ? " active" : "");
    btn.textContent = `${i + 1}. ${clue.text}`;
    btn.addEventListener("click", () => onSelect(clue.id === selectedId ? null : clue.id));
    container.appendChild(btn);
  });
}

export function applyHighlight(clueId) {
  document.querySelectorAll(".highlight").forEach((el) => el.classList.remove("highlight"));
  if (!clueId) return;
  const clue = CLUES.find((c) => c.id === clueId);
  if (!clue) return;
  if (clue.houseIds) {
    clue.houseIds.forEach((h) => {
      document.querySelector(`.house-head[data-house="${h}"]`)?.classList.add("highlight");
      document.querySelectorAll(`.slot[data-house-index="${h - 1}"]`).forEach((s) => s.classList.add("highlight"));
    });
  }
  if (clue.values && clue.categories) {
    clue.categories.forEach((cat) => {
      document.querySelectorAll(`.slot[data-category="${cat}"]`).forEach((slot) => {
        const card = slot.querySelector(".card");
        if (card && clue.values.includes(card.dataset.value)) {
          slot.classList.add("highlight");
        }
      });
      // 풀의 관련 카드
      document.querySelectorAll(`#pool .card[data-category="${cat}"]`).forEach((card) => {
        if (clue.values.includes(card.dataset.value)) card.classList.add("highlight");
      });
    });
  }
}
```

- [ ] **Step 2: main에 연결 — 난이도 변경 시 단서 다시 그림, 선택 시 하이라이트**

`let selectedClueId = null;` 후 `renderAll` 안에서 `renderClues` + `applyHighlight(selectedClueId)` 호출.

난이도 `change`·「새 문제」는 **Task 10**에서 `generatePuzzle` 연결. 여기에서는 버튼 DOM만 둔다.

- [ ] **Step 3: 수동 테스트 — 단서 UI는 Task 7·10 이후**

> Task 7의 `activeIds` 필터는 `game.getClues()` 전체 렌더로 바꾼다 (생성 판 기준).

- [ ] **Step 4: Commit**

```bash
git add einstein-riddle-app/js/clues.js einstein-riddle-app/js/main.js
git commit -m "feat: render clues with highlight on select"
```

---

### Task 8: 타이머·Undo·초기화·제출

**Files:**
- Modify: `einstein-riddle-app/js/main.js`

**Interfaces:**
- Consumes: `game`, `grade` from validate

- [ ] **Step 1: 타이머 UI 갱신**

```js
import { grade } from "./validate.js";

function formatMs(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

setInterval(() => {
  document.getElementById("timer").textContent = formatMs(game.getElapsedMs());
}, 250);
```

- [ ] **Step 2: 버튼 핸들러**

```js
document.getElementById("btn-undo").onclick = () => {
  game.undo();
  renderAll();
};

document.getElementById("btn-reset").onclick = () => {
  if (!confirm("배치만 초기화할까요? (타이머는 유지)")) return;
  game.resetPlacement({ keepTimer: true });
  renderAll();
  document.getElementById("feedback").textContent = "";
};

document.getElementById("btn-submit").onclick = () => {
  const result = grade(game.getPlacement(), game.getAnswer());
  const fb = document.getElementById("feedback");
  fb.className = "feedback";
  if (!result.complete) {
    fb.textContent = "모든 칸에 카드를 배치한 뒤 제출해 주세요.";
    fb.classList.add("bad");
    return;
  }
  game.stopTimer();
  if (result.solved) {
    fb.textContent = `정답입니다! 소요 시간 ${formatMs(game.getElapsedMs())}`;
    fb.classList.add("ok");
  } else {
    fb.textContent = `틀린 칸 수 = ${result.wrongCount}`;
    fb.classList.add("bad");
  }
};
```

> `grade` 두 번째 인자는 **현재 판** `game.getAnswer()`. Task 10 이전에는 `loadPuzzle(폴백)`으로 정답을 넣어 둔다.

- [ ] **Step 3: 수동 테스트**

- 빈 제출 → 안내  
- 정답 배치 후 제출 → 축하 + 시간 (교사 없이 직접 ANSWER 채워 검증 가능)  
- 일부 오답 → `틀린 칸 수 = N`만, 위치 미표시  
- Undo / 초기화 / 타이머 첫 드래그 시작  

- [ ] **Step 4: Commit**

```bash
git add einstein-riddle-app/js/main.js
git commit -m "feat: wire timer, undo, reset, and submit grading"
```

---

### Task 9: `teacher.js` — 교사 패널

**Files:**
- Create: `einstein-riddle-app/js/teacher.js`
- Modify: `einstein-riddle-app/js/main.js`

**Interfaces:**
- Consumes: `ANSWER`, `LABELS`, `game.getPlacement()`
- Produces: `bindTeacherPanel({ password })`

- [ ] **Step 1: `teacher.js`**

```js
import { ANSWER, CATEGORIES, HOUSES, LABELS, labelOf } from "./puzzle-data.js";

export const TEACHER_PASSWORD = "teacher2026";

export function bindTeacherPanel({ getPlacement }) {
  const panel = document.getElementById("teacher-panel");
  const btn = document.getElementById("btn-teacher");
  const unlock = document.getElementById("btn-teacher-unlock");
  const pw = document.getElementById("teacher-pw");
  const err = document.getElementById("teacher-error");
  const body = document.getElementById("teacher-body");
  const login = document.getElementById("teacher-login");

  btn.addEventListener("click", () => {
    panel.classList.toggle("hidden");
    panel.setAttribute("aria-hidden", panel.classList.contains("hidden") ? "true" : "false");
  });

  unlock.addEventListener("click", () => {
    if (pw.value !== TEACHER_PASSWORD) {
      err.textContent = "비밀번호가 올바르지 않습니다.";
      return;
    }
    err.textContent = "";
    login.classList.add("hidden");
    body.classList.remove("hidden");
    renderAnswer(getPlacement);
  });

  function renderAnswer(getPlacementFn) {
    const answerBoard = document.getElementById("answer-board");
    let html = "<h3>정답</h3><table border='1' cellpadding='4'><tr><th></th>";
    HOUSES.forEach((h) => { html += `<th>${h}번</th>`; });
    html += "</tr>";
    CATEGORIES.forEach((cat) => {
      html += `<tr><th>${LABELS[cat]}</th>`;
      ANSWER[cat].forEach((v) => { html += `<td>${labelOf(v)}</td>`; });
      html += "</tr>";
    });
    html += "</table>";

    const placement = getPlacementFn();
    let wrong = 0;
    CATEGORIES.forEach((cat) => {
      for (let i = 0; i < 5; i++) {
        if (placement[cat][i] !== ANSWER[cat][i]) wrong++;
      }
    });
    html += `<p>현재 화면 기준 틀린 칸(비교): ${wrong}</p>`;
    answerBoard.innerHTML = html;
  }
}
```

- [ ] **Step 2: main에서 `bindTeacherPanel({ getPlacement: () => game.getPlacement() })` 호출**

- [ ] **Step 3: 수동 테스트 — 잘못된 비밀번호 거부, 성공 시 정답 표·비교 수. 학생 모드에서 정답 DOM이 로그인 전에 보이지 않음**

- [ ] **Step 4: Commit**

```bash
git add einstein-riddle-app/js/teacher.js einstein-riddle-app/js/main.js
git commit -m "feat: add password-gated teacher answer panel"
```

---

### Task 10: 솔버 + 난이도별 문제 생성 + 「새 문제」연결

**Files:**
- Create: `einstein-riddle-app/js/solver.js`
- Create: `einstein-riddle-app/js/generate.js`
- Modify: `einstein-riddle-app/js/main.js`
- Modify: `einstein-riddle-app/js/clues.js` (현재 `game.getClues()` 사용)
- Modify: `einstein-riddle-app/js/teacher.js` (`game.getAnswer()` 사용)
- Modify: `einstein-riddle-app/tests/run-tests.html`

**Interfaces:**
- Consumes: `VALUES`, `CATEGORIES`, `LABELS`, `DIFFICULTY_TARGETS`, `FALLBACK_*`
- Produces:
  - `countSolutions(clues, { limit = 2 }): number` — 0, 1, 또는 limit까지
  - `generatePuzzle(difficulty): { answer, clues, meta: { usedFallback, clueCount } }`

단서 내부 형식(생성기·솔버 공통):

```js
// { id, text, kind, ...payload, categories?, values?, houseIds? }
// kind: "sameHouse" | "atHouse" | "nextTo" | "leftOf"
// sameHouse: { a:{cat,val}, b:{cat,val} }
// atHouse: { cat, val, houseIndex }  // 0..4
// nextTo / leftOf: { a:{cat,val}, b:{cat,val} }
```

- [ ] **Step 1: `solver.js` — 백트래킹으로 해 개수 (limit=2면 유일해 판별용)**

핵심 아이디어: 카테고리별로 순열을 채워 가며 각 단서 `kind`를 만족하는지 검사. 구현은 초보가 읽기 쉽게 **카테고리 순서로 집 배정**하거나, **값→집 인덱스 맵**을 카테고리마다 완성해 나가면 된다.

최소 골격:

```js
import { CATEGORIES, VALUES } from "./puzzle-data.js";

function clueHolds(assignment, clue) {
  // assignment[cat][houseIndex] = value
  const houseOf = (cat, val) => assignment[cat].indexOf(val);
  if (clue.kind === "atHouse") {
    return assignment[clue.cat][clue.houseIndex] === clue.val;
  }
  if (clue.kind === "sameHouse") {
    return houseOf(clue.a.cat, clue.a.val) === houseOf(clue.b.cat, clue.b.val);
  }
  if (clue.kind === "nextTo") {
    return Math.abs(houseOf(clue.a.cat, clue.a.val) - houseOf(clue.b.cat, clue.b.val)) === 1;
  }
  if (clue.kind === "leftOf") {
    return houseOf(clue.a.cat, clue.a.val) + 1 === houseOf(clue.b.cat, clue.b.val);
  }
  return true;
}

export function countSolutions(clues, { limit = 2 } = {}) {
  // backtrack over CATEGORIES permutations; prune when clue fails on assigned cats
  // return number of full assignments that satisfy all clues, capped at limit
  let count = 0;
  // ... implement permute + prune ...
  return count;
}

export function isUniqueSolution(clues) {
  return countSolutions(clues, { limit: 2 }) === 1;
}
```

- [ ] **Step 2: 테스트 — 폴백 단서+정답이 유일해인지, 단서 0개는 해가 많음**

```js
  import { countSolutions, isUniqueSolution } from "../js/solver.js";
  import { FALLBACK_CLUES } from "../js/puzzle-data.js";
  // FALLBACK_CLUES를 kind 형식으로 옮겼다면:
  assert(isUniqueSolution(FALLBACK_CLUES) === true, "fallback unique");
  assert(countSolutions([], { limit: 2 }) === 2, "no clues -> at least 2");
```

> 폴백 단서를 생성기와 같은 `kind` 스키마로 `puzzle-data.js`에 맞추거나, 테스트는 **생성기로 만든 퍼즐**만 검증해도 된다: `const p = generatePuzzle("easy"); assert(isUniqueSolution(p.clues))`.

- [ ] **Step 3: `generate.js`**

```js
import {
  CATEGORIES, VALUES, LABELS, labelOf,
  DIFFICULTY_TARGETS, FALLBACK_ANSWER, FALLBACK_CLUES,
} from "./puzzle-data.js";
import { countSolutions, isUniqueSolution } from "./solver.js";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomAnswer() {
  return Object.fromEntries(
    CATEGORIES.map((c) => [c, shuffle(VALUES[c])])
  );
}

function buildCandidateClues(answer) {
  const clues = [];
  let id = 0;
  const houseOf = (cat, val) => answer[cat].indexOf(val);

  // atHouse samples
  for (const cat of CATEGORIES) {
    for (let h = 0; h < 5; h++) {
      const val = answer[cat][h];
      clues.push({
        id: `g${id++}`,
        kind: "atHouse",
        cat, val, houseIndex: h,
        houseIds: [h + 1],
        categories: [cat],
        values: [val],
        text: `${h + 1}번 집의 ${LABELS[cat]}는 ${labelOf(val)}이다.`,
      });
    }
  }
  // sameHouse: pair categories for each house
  for (let h = 0; h < 5; h++) {
    for (let i = 0; i < CATEGORIES.length; i++) {
      for (let j = i + 1; j < CATEGORIES.length; j++) {
        const ca = CATEGORIES[i], cb = CATEGORIES[j];
        const va = answer[ca][h], vb = answer[cb][h];
        clues.push({
          id: `g${id++}`,
          kind: "sameHouse",
          a: { cat: ca, val: va },
          b: { cat: cb, val: vb },
          categories: [ca, cb],
          values: [va, vb],
          text: `${labelOf(va)} 속성(이)가 있는 집은 ${labelOf(vb)} 도 갖는다.`,
        });
        // Better Korean templates per category pair can be refined in polish step
      }
    }
  }
  // nextTo / leftOf between values of different categories
  // ... for neighboring houses, emit nextTo and leftOf clues ...
  return clues;
}

export function generatePuzzle(difficulty) {
  const target = DIFFICULTY_TARGETS[difficulty] ?? DIFFICULTY_TARGETS.easy;
  const preferMax = difficulty === "easy";

  for (let attempt = 0; attempt < 20; attempt++) {
    const answer = randomAnswer();
    let pool = shuffle(buildCandidateClues(answer));
    const selected = [];

    for (const clue of pool) {
      selected.push(clue);
      if (isUniqueSolution(selected)) break;
      if (selected.length > 40) break; // safety
    }
    if (!isUniqueSolution(selected)) continue;

    // shrink toward target
    let working = [...selected];
    const order = shuffle(working.map((_, i) => i));
    for (const idx of order) {
      if (working.length <= target.min) break;
      const trial = working.filter((_, i) => i !== idx);
      if (isUniqueSolution(trial)) working = trial;
    }

    // if easy and below max, optional: keep more clues from pool that don't break uniqueness
    if (preferMax && working.length < target.max) {
      for (const clue of pool) {
        if (working.length >= target.max) break;
        if (working.some((c) => c.id === clue.id)) continue;
        const trial = [...working, clue];
        if (isUniqueSolution(trial)) working = trial;
      }
    }

    if (countSolutions(working, { limit: 2 }) !== 1) continue;

    return {
      answer,
      clues: working,
      meta: { usedFallback: false, clueCount: working.length },
    };
  }

  return {
    answer: FALLBACK_ANSWER,
    clues: FALLBACK_CLUES,
    meta: { usedFallback: true, clueCount: FALLBACK_CLUES.length },
  };
}
```

한국어 `text`는 구현 시 카테고리 쌍별로 자연스럽게 다듬는다 (예: 국적+동물 → 「스웨덴 사람은 개를 기른다」 패턴).

- [ ] **Step 4: 테스트 — easy/hard 각각 생성 3회, 유일해, hard 평균 단서 ≤ easy 경향**

```js
  import { generatePuzzle } from "../js/generate.js";
  import { isUniqueSolution } from "../js/solver.js";

  for (let i = 0; i < 3; i++) {
    const e = generatePuzzle("easy");
    assert(isUniqueSolution(e.clues) || e.meta.usedFallback, "easy unique or fallback");
    const h = generatePuzzle("hard");
    assert(isUniqueSolution(h.clues) || h.meta.usedFallback, "hard unique or fallback");
  }
```

- [ ] **Step 5: `main.js` 연결**

```js
import { generatePuzzle } from "./generate.js";

function startNewPuzzle() {
  const difficulty = document.getElementById("difficulty").value;
  const btn = document.getElementById("btn-new");
  btn.disabled = true;
  document.getElementById("feedback").textContent = "문제 만드는 중…";
  // yield to UI
  requestAnimationFrame(() => {
    const puzzle = generatePuzzle(difficulty);
    game.loadPuzzle({
      answer: puzzle.answer,
      clues: puzzle.clues,
      difficulty,
    });
    renderAll();
    btn.disabled = false;
    const fb = document.getElementById("feedback");
    fb.className = "feedback";
    fb.textContent = puzzle.meta.usedFallback
      ? "기본 문제로 시작합니다."
      : `새 문제 (단서 ${puzzle.meta.clueCount}개)`;
  });
}

document.getElementById("btn-new").onclick = () => {
  if (!confirm("새 문제를 만들까요? 진행 중 배치는 사라집니다.")) return;
  startNewPuzzle();
};

document.getElementById("difficulty").onchange = () => {
  if (!confirm("난이도를 바꾸면 새 문제가 만들어집니다. 계속할까요?")) {
    // revert select to game.getDifficulty()
    document.getElementById("difficulty").value = game.getDifficulty();
    return;
  }
  startNewPuzzle();
};

// 최초 로드
startNewPuzzle();
```

제출:

```js
const result = grade(game.getPlacement(), game.getAnswer());
```

단서 렌더: `game.getClues()` 전체를 목록으로 (activeIds 필터 불필요).

교사: `ANSWER` 상수 대신 `getAnswer()`.

- [ ] **Step 6: 수동 테스트 — 새 문제 3회, 쉬움/어려움 단서 수 경향, 교사 정답으로 클리어**

- [ ] **Step 7: Commit**

```bash
git add einstein-riddle-app/js/solver.js einstein-riddle-app/js/generate.js einstein-riddle-app/js/main.js einstein-riddle-app/js/clues.js einstein-riddle-app/js/teacher.js einstein-riddle-app/tests/run-tests.html
git commit -m "feat: generate unique puzzles by difficulty clue count"
```

---

### Task 11: 통합 다듬기 + README + 수업 전 체크리스트

**Files:**
- Modify: `einstein-riddle-app/js/main.js` (help 문구 난이도별)
- Modify: `einstein-riddle-app/README.md`
- Modify: `docs/superpowers/specs/2026-09-07-einstein-riddle-design.md` 상태 줄을 `구현 계획 승인·구현 대기` 등으로 갱신 가능

- [ ] **Step 1: 도움말 문구** — 쉬움: 조작 안내 / 어려움: "단서가 더 적습니다. 추론을 더 깊게 하세요."

- [ ] **Step 2: README에 수업 시연 스크립트 추가**

```markdown
## 5분 시연 스크립트

1. 규칙: 집 5채, 속성 5종, 단서는 모두 참.
2. 「새 문제」로 판 받기 → 단서 개수 안내.
3. 단서 하나 클릭 → 하이라이트 → 카드 배치 시연.
4. 제출 시 틀린 칸 수만 보인다는 점 안내.
5. 학생이 난이도·새 문제로 개인 반복 풀이.
```

- [ ] **Step 3: 명세 §13 수동 테스트 전부를 실행하고 README 「검증 기록」에 기록** (새 문제 쉬움/어려움 각 3회 포함)

- [ ] **Step 4: `tests/run-tests.html` 최종 ALL PASSED 확인**

- [ ] **Step 5: Commit**

```bash
git add einstein-riddle-app docs/superpowers/specs/2026-09-07-einstein-riddle-design.md
git commit -m "docs: polish README for generated puzzles and finish MVP notes"
```

---

## 초보 제작자 — 구현 중 상시 체크

- [ ] 새 기능을 넣기 전 명세 Non-goals에 있는지 확인
- [ ] 속성 문구·목표 단서 수는 `puzzle-data.js`의 VALUES/DIFFICULTY_TARGETS만 수정
- [ ] 교사 비밀번호를 학생 슬라이드에 복사하지 않음
- [ ] 한 Task 끝낼 때마다 브라우저에서 해당 동작만 확인 후 다음으로
- [ ] 생성기가 느리면 후보 단서 수·재시도 횟수부터 줄이기
- [ ] 막히면 콘솔(F12) 빨간 에러 메시지부터 읽기

---

## Spec coverage (self-review)

| 명세 | Task |
|------|------|
| 드래그 배치 | 6 |
| 틀린 칸 수만 | 3, 8 |
| 교사 같은 PC 비밀번호·현재 판 정답 | 9, 10 |
| 난이도별 알고리즘 문제 생성(단서 수) | 10 |
| Undo/초기화/타이머/터치 | 4, 6, 8 |
| 단서 하이라이트 | 7 |
| 「새 문제」버튼 | 5, 10 |
| HTML/CSS/JS·로컬 실행 | 1, 11 |
| 집 번호+색 이름 | 5 |
| 폴백 퍼즐 | 2, 10 |
| Non-goals 미포함 | 전 Task 범위 준수 |

**Placeholder scan:** 생성기 한국어 text는 Task 10에서 카테고리 쌍별로 구체화(필수).  
**타입 일관성:** `loadPuzzle({ answer, clues, difficulty })`, `grade(placement, answer)`, 단서 `kind` 스키마로 통일.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-07-einstein-riddle.md`. Two execution options:

**1. Subagent-Driven (recommended)** — 태스크마다 새 서브에이전트, 사이 리뷰, 빠른 반복  

**2. Inline Execution** — 이 세션에서 executing-plans로 체크포인트와 함께 실행  

Which approach?
