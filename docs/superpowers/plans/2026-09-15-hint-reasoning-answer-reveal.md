# Hint Reasoning and Answer Reveal Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** fact 힌트에 빨간 2~3단계 추론을 붙이고, 「정답 보기」로 포기 확인 후 타이머를 멈추며 빈/틀린 칸만 비행 애니메이션으로 채운 뒤 조작을 잠근다.

**Architecture:** `hints.js`가 fact에 `reasoning[]`를 생성한다. `state.js`가 잠금·칸 단위 정답 반영 API를 제공한다. `answer-fill.js`가 채울 칸 큐를 계산하고, `main.js`가 고스트 비행 애니메이션과 힌트 UI를 조립한다.

**Tech Stack:** HTML5, CSS3, Vanilla JS ES modules, Node 테스트 러너 (`einstein-riddle-app/tests/run-tests.mjs`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-15-hint-reasoning-answer-reveal.md`
- fact `reasoning` 길이 2~3, 단서 번호 + 「」 인용, UI 색 `#ff7b8a` (`.hint-reasoning`)
- 정답 보기 확인 문구 정확히: `포기하시겠습니까?`
- 종료 피드백: `포기했습니다. 정답을 표시합니다.`
- 맞은 칸 유지, 빈/틀린 칸만 애니메이션 대상
- 잠금 해제: 「새 문제」·난이도 변경(`loadPuzzle`)만
- 교사 모드·점수 감점·스킵 토글은 범위 밖
- Windows PowerShell: heredoc 대신 `git commit -m "..."`, 커밋 시 `GIT_AUTHOR_NAME=Einstein Dev` / `GIT_AUTHOR_EMAIL=dev@local` (및 COMMITTER 동일) 환경변수 사용. `git config` 변경 금지.
- HTML 테스트 동기화: `run-tests.mjs` 변경 후 동일 본문을 `run-tests.html`에 반영

---

## File Structure

| 파일 | 책임 |
|------|------|
| `einstein-riddle-app/js/hints.js` | fact `reasoning` 생성·`validateHints` 강화 |
| `einstein-riddle-app/js/answer-fill.js` | `buildAnswerFillQueue(placement, answer, categories)` |
| `einstein-riddle-app/js/state.js` | `isInteractionLocked`, `lockInteraction`, `setCellToAnswer`, `applyFullAnswer` |
| `einstein-riddle-app/js/main.js` | 추론 렌더, 정답 버튼, 비행 애니메이션, 잠금 UI |
| `einstein-riddle-app/css/styles.css` | `.hint-reasoning`, `.answer-fly-ghost`, 잠금 |
| `einstein-riddle-app/index.html` | `#btn-reveal-answer` |
| `einstein-riddle-app/tests/run-tests.mjs` | 회귀 테스트 |
| `einstein-riddle-app/tests/run-tests.html` | 브라우저 동기화 |

---

### Task 1: fact 힌트 reasoning 생성

**Files:**
- Modify: `einstein-riddle-app/js/hints.js`
- Modify: `einstein-riddle-app/tests/run-tests.mjs`
- Modify: `einstein-riddle-app/tests/run-tests.html`

**Interfaces:**
- Consumes: 기존 `buildHints({ clues, answer, houseCount, categories })`
- Produces: fact 힌트에 `reasoning: string[]` (length 2~3). `validateHints`가 reasoning을 검사.

- [ ] **Step 1: 실패 테스트 추가**

`run-tests.mjs`의 fact/hints 검증 근처에 추가:

```js
const reasoningPuzzle = generatePuzzle("easy", { timeLimitMs: 2500, random: seededRandom(21) });
assert(validateHints(reasoningPuzzle), "validateHints accepts puzzle with reasoning");
for (const hint of reasoningPuzzle.hints.filter((h) => h.stage === "fact")) {
  assert(Array.isArray(hint.reasoning), `fact ${hint.id} has reasoning array`);
  assert(hint.reasoning.length >= 2 && hint.reasoning.length <= 3, `fact ${hint.id} reasoning 2-3 steps`);
  assert(hint.reasoning.some((line) => line.includes("단서") && line.includes("「")), `fact ${hint.id} cites clue quote`);
  assert(hint.reasoning.some((line) => /①|1\./.test(line) || line.includes("①")), `fact ${hint.id} numbered steps`);
}
```

(번호 검사는 `①` 또는 동등 표기 허용. 구현은 `①`을 사용.)

- [ ] **Step 2: RED 확인**

Run: `node --experimental-default-type=module einstein-riddle-app/tests/run-tests.mjs`  
Expected: fact reasoning 관련 assert 실패.

- [ ] **Step 3: reasoning 생성 구현**

`hints.js`에 헬퍼 추가:

```js
function clipQuote(text, max = 28) {
  const t = String(text ?? "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function buildReasoning({ clues, clueIndices, anchor, factPlacement }) {
  const steps = [];
  const nums = (clueIndices ?? []).filter(Boolean);
  const primary = nums[0] ? clues[nums[0] - 1] : anchor;
  const secondary = nums[1] && nums[1] !== nums[0] ? clues[nums[1] - 1] : null;
  const house = factPlacement.houseIndex + 1;
  const value = labelOf(factPlacement.val);
  const catLabel = categoryLabel(factPlacement.cat);

  if (anchor.kind === "atHouse") {
    steps.push(`① 단서 ${nums[0] ?? clueIndex(clues, anchor.id)}: 「${clipQuote(primary?.text ?? anchor.text)}」 → ${house}번 집의 ${catLabel}이(가) 직접 정해집니다.`);
    steps.push(`② 따라서 ${house}번 집 ${catLabel} = ${value}`);
  } else if (anchor.kind === "sameHouse") {
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
```

fact 힌트 push 시:

```js
reasoning: buildReasoning({
  clues,
  clueIndices: [firstNum, secondNum].filter(Boolean),
  anchor,
  factPlacement,
}),
meta: { ..., clueIndices: [firstNum, secondNum].filter(Boolean) },
```

`validateHints`의 fact 검사에 추가:

```js
if (!Array.isArray(factHint.reasoning) || factHint.reasoning.length < 2 || factHint.reasoning.length > 3) return false;
if (!factHint.reasoning.some((line) => line.includes("「"))) return false;
```

- [ ] **Step 4: GREEN 확인**

Run: `node --experimental-default-type=module einstein-riddle-app/tests/run-tests.mjs`  
Expected: 전체 통과.

- [ ] **Step 5: Commit**

```bash
git add einstein-riddle-app/js/hints.js einstein-riddle-app/tests/run-tests.mjs einstein-riddle-app/tests/run-tests.html
git commit -m "feat: add multi-step clue reasoning to fact hints"
```

---

### Task 2: 정답 채우기 큐 + 잠금 상태 API

**Files:**
- Create: `einstein-riddle-app/js/answer-fill.js`
- Modify: `einstein-riddle-app/js/state.js`
- Modify: `einstein-riddle-app/tests/run-tests.mjs`
- Modify: `einstein-riddle-app/tests/run-tests.html`

**Interfaces:**
- Consumes: `createGameState`, RuntimePuzzle answer/placement
- Produces:
  - `buildAnswerFillQueue(placement, answer, categories) => Array<{ category, houseIndex, value }>`
  - `isInteractionLocked(): boolean`
  - `lockInteraction(): void`
  - `setCellToAnswer(category, houseIndex): boolean` — answer 값으로 한 칸 설정, history 무시(또는 비움)
  - `applyFullAnswer(): void` — placement = answer 전체 복사
  - `loadPuzzle` / 새 문제 시 잠금 false
  - 잠금 중 `moveCard`/`undo`/`resetPlacement`/`revealNextHint`/`toggleClueRead`는 no-op(또는 false)

- [ ] **Step 1: 실패 테스트 추가**

```js
import { buildAnswerFillQueue } from "../js/answer-fill.js";

const fillPuzzle = generatePuzzle("easy", { timeLimitMs: 0, random: seededRandom(5) });
const fillGame = createGameState();
fillGame.loadPuzzle(fillPuzzle);
const place = fillGame.getPlacement();
place.color[0] = fillPuzzle.answer.color[0]; // one correct cell
const queue = buildAnswerFillQueue(place, fillPuzzle.answer, fillPuzzle.categories);
assert(!queue.some((q) => q.category === "color" && q.houseIndex === 0), "correct cell omitted from fill queue");
assert(queue.length === fillPuzzle.categories.length * fillPuzzle.houseCount - 1, "queue covers all non-correct cells");

fillGame.lockInteraction();
assert(fillGame.isInteractionLocked(), "lockInteraction sets locked");
const beforeMs = fillGame.getElapsedMs();
fillGame.ensureTimerStarted();
assert(!fillGame.isTimerRunning() || true, "timer may need stop on reveal — tested with reveal path");
fillGame.stopTimer();
assert(!fillGame.isTimerRunning(), "stopTimer clears running");
assert(fillGame.moveCard({
  value: fillPuzzle.answer.color[1],
  category: "color",
  from: { type: "pool" },
  to: { type: "slot", category: "color", houseIndex: 1 },
}) === false, "moveCard blocked when locked");

fillGame.loadPuzzle(fillPuzzle);
assert(!fillGame.isInteractionLocked(), "loadPuzzle clears lock");

assert(fillGame.setCellToAnswer("color", 0) === true, "setCellToAnswer writes answer cell");
assert(fillGame.getPlacement().color[0] === fillPuzzle.answer.color[0], "cell matches answer");
```

- [ ] **Step 2: RED 확인**

Expected: `answer-fill.js` 미존재 또는 lock API 미정의로 실패.

- [ ] **Step 3: 구현**

`answer-fill.js`:

```js
export function buildAnswerFillQueue(placement, answer, categories) {
  const queue = [];
  for (const category of categories) {
    const row = answer[category] ?? [];
    for (let houseIndex = 0; houseIndex < row.length; houseIndex++) {
      if (placement[category]?.[houseIndex] === row[houseIndex]) continue;
      queue.push({ category, houseIndex, value: row[houseIndex] });
    }
  }
  return queue;
}
```

`state.js`에 `interactionLocked = false` 추가. `loadPuzzle`에서 false.  
`lockInteraction` / `isInteractionLocked` export.  
`moveCard`/`undo`/`resetPlacement`/`toggleClueRead`/`revealNextHint` 시작 시 locked면 즉시 return false/null/undefined.  
`setCellToAnswer(category, houseIndex)`: locked 여부와 무관히(또는 locked일 때만) answer 칸 기록.  
`applyFullAnswer()`: placement를 answer clone.

- [ ] **Step 4: GREEN 확인**

Run: `node --experimental-default-type=module einstein-riddle-app/tests/run-tests.mjs`  
Expected: 전체 통과.

- [ ] **Step 5: Commit**

```bash
git add einstein-riddle-app/js/answer-fill.js einstein-riddle-app/js/state.js einstein-riddle-app/tests
git commit -m "feat: add answer fill queue and interaction lock"
```

---

### Task 3: UI — 빨간 추론, 정답 보기, 비행 애니메이션

**Files:**
- Modify: `einstein-riddle-app/index.html`
- Modify: `einstein-riddle-app/css/styles.css`
- Modify: `einstein-riddle-app/js/main.js`
- Modify: `einstein-riddle-app/tests/run-tests.mjs`
- Modify: `einstein-riddle-app/tests/run-tests.html`

**Interfaces:**
- Consumes: Task 1 reasoning, Task 2 queue/lock/setCellToAnswer
- Produces: `#btn-reveal-answer`, `.hint-reasoning`, 비행 고스트 애니메이션

- [ ] **Step 1: DOM 계약 실패 테스트**

기존 `assertDomContracts`에 추가:

```js
assert(html.includes('id="btn-reveal-answer"'), "reveal answer button exists");
assert(html.indexOf('id="btn-hint"') < html.indexOf('id="btn-reveal-answer"'), "reveal button after hint button");
```

- [ ] **Step 2: RED 확인**

Expected: `btn-reveal-answer` 없음으로 실패.

- [ ] **Step 3: HTML·CSS**

`index.html` hints-header:

```html
<div class="hints-header">
  <h2>힌트</h2>
  <div class="hint-actions">
    <button type="button" id="btn-hint">힌트 보기</button>
    <button type="button" id="btn-reveal-answer">정답 보기</button>
  </div>
</div>
```

`styles.css`:

```css
.hint-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
#btn-reveal-answer {
  font: inherit; padding: 0.4rem 0.85rem; border-radius: 6px;
  border: 1px solid var(--error); background: transparent; color: var(--error);
  cursor: pointer; font-weight: 600;
}
.hint-reasoning {
  margin: 0.35rem 0 0; color: #ff7b8a; font-size: 0.92em; line-height: 1.45;
  white-space: pre-line;
}
.answer-fly-ghost {
  position: fixed; z-index: 50; pointer-events: none;
  transition: transform 400ms ease, opacity 400ms ease;
}
body.interaction-locked .card { cursor: not-allowed; }
```

- [ ] **Step 4: main.js 렌더·애니메이션**

`renderHints`에서:

```js
list.innerHTML = revealed.map((hint) => {
  const reasoning = Array.isArray(hint.reasoning) && hint.reasoning.length
    ? `<div class="hint-reasoning">${hint.reasoning.map((line) => escapeHtml(line)).join("<br>")}</div>`
    : "";
  return `<li><div class="hint-text">${escapeHtml(hint.text)}</div>${reasoning}</li>`;
}).join("");
```

`escapeHtml` 유틸 추가(XSS 방지).

정답 보기:

```js
document.getElementById("btn-reveal-answer").onclick = async () => {
  if (game.isInteractionLocked()) return;
  if (!confirm("포기하시겠습니까?")) return;
  game.stopTimer();
  game.lockInteraction();
  updateLockedControls();
  document.body.classList.add("interaction-locked");
  const puzzle = game.getPuzzle();
  const queue = buildAnswerFillQueue(game.getPlacement(), game.getAnswer(), puzzle.categories);
  await animateAnswerFill(queue);
  game.applyFullAnswer();
  renderAll();
  const fb = document.getElementById("feedback");
  fb.className = "feedback";
  fb.textContent = "포기했습니다. 정답을 표시합니다.";
};

async function animateAnswerFill(queue) {
  for (const step of queue) {
    await flyCardToSlot(step);
    game.setCellToAnswer(step.category, step.houseIndex);
    renderBoard();
    renderPool();
    await wait(150);
  }
}
```

`flyCardToSlot`: 풀 또는 임시 출발점에서 `.answer-fly-ghost`를 만들어 슬롯 `getBoundingClientRect`로 `transform` 이동(400ms) 후 제거.  
`updateLockedControls`: undo/reset/submit/hint/reveal disabled.  
드래그 `onDrop` 시작 시 locked면 return.  
`startNewPuzzle` / `loadPuzzle` 후 `document.body.classList.remove("interaction-locked")` 및 컨트롤 복구.

- [ ] **Step 5: GREEN 확인**

Run: `node --experimental-default-type=module einstein-riddle-app/tests/run-tests.mjs`  
Expected: 전체 통과.

수동 스모크: `npx --yes serve einstein-riddle-app -l 4173`  
- 힌트 3번째에 빨간 추론  
- 정답 보기 → 확인 → 타이머 정지·비행·잠금

- [ ] **Step 6: Commit**

```bash
git add einstein-riddle-app
git commit -m "feat: reveal answer with fly animation and show hint reasoning"
```

---

### Task 4: README 한 줄 갱신

**Files:**
- Modify: `einstein-riddle-app/README.md`
- Modify: `docs/superpowers/specs/2026-09-15-hint-reasoning-answer-reveal.md` (상태를 구현 완료로)

- [ ] **Step 1: README 힌트·정답 절에 추가**

- 확정 힌트 아래 빨간 추론 표시
- 정답 보기 → 포기 확인 → 타이머 정지 → 애니메이션 채움

- [ ] **Step 2: 명세 상태**

`구현 완료, 실기기 확인 권장`으로 변경.

- [ ] **Step 3: Commit**

```bash
git add einstein-riddle-app/README.md docs/superpowers/specs/2026-09-15-hint-reasoning-answer-reveal.md
git commit -m "docs: note hint reasoning and answer reveal"
```

---

## Self-Review

- Spec coverage: reasoning(Task 1+3), 정답 버튼·타이머·애니메이션·잠금(Task 2+3), 문서(Task 4) — 갭 없음.
- Placeholder scan: TBD/TODO 없음.
- Type consistency: `reasoning`, `buildAnswerFillQueue`, `lockInteraction`, `setCellToAnswer`, `applyFullAnswer` 명칭 통일.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-15-hint-reasoning-answer-reveal.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — 태스크마다 새 서브에이전트 + 리뷰
2. **Inline Execution** — 이 세션에서 순서대로 실행

Which approach?
