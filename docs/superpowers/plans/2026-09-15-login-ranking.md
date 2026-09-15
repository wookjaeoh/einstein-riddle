# Login and Shared Ranking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 인트로 로그인(이름·구분·4자리 PIN)과 Vercel/Upstash 기반 난이도별 공유 최고기록 랭킹을 추가한다.

**Architecture:** 순수 랭킹 로직은 `lib/ranking-logic.mjs`에 두고 테스트·API가 공유한다. Vercel Serverless(`api/login.js`, `api/rankings.js`)가 PIN·Redis를 담당하고, 프론트는 `js/auth.js`·`js/rankings.js`가 모달·세션·API 호출을 맡으며 `main.js`가 제출/툴바를 연결한다.

**Tech Stack:** HTML/CSS/Vanilla JS ES modules, Vercel Serverless (Node), Upstash Redis REST (`fetch`), Node test runner `einstein-riddle-app/tests/run-tests.mjs`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-15-login-ranking-design.md`
- 비로그인 플레이 가능, 기록 등록만 로그인 필요
- 로그인 필드 순서: 이름 → 구분(학생/교사/일반) → 암호 4자리 (학교명 없음)
- 정답 시: 축하 + 「랭킹에 등록하시겠습니까?」 + 예/아니오; 아니오=등록 없이 랭킹 조회; 예=학생·교사는 학교명 후 POST
- 동일 신원+난이도 = 최고기록 1건만 (`not_improved` 시 메시지: `이미 더 좋은 기록이 있습니다`)
- Redis 키: `rankings:{difficulty}`, 상위 50, `timeMs` 오름차순
- Env: `LOGIN_PIN`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`
- Windows PowerShell: `git commit -m "..."` (heredoc 금지). 커밋 시 `GIT_AUTHOR_NAME=Einstein Dev` / `GIT_AUTHOR_EMAIL=dev@local` (COMMITTER 동일). `git config` 변경 금지
- `run-tests.mjs` 변경 후 `run-tests.html` 동기화
- UI 톤: 기존 `.giveup-modal` 계열(네이비 + 주황)

---

## File Structure

| 파일 | 책임 |
|------|------|
| `einstein-riddle-app/lib/ranking-logic.mjs` | 신원 키, upsert 최고기록, 정렬·trim |
| `einstein-riddle-app/lib/pin.mjs` | PIN 형식·환경변수 비교 |
| `einstein-riddle-app/lib/redis.mjs` | Upstash REST get/set JSON |
| `einstein-riddle-app/api/login.js` | `POST` PIN 검증 |
| `einstein-riddle-app/api/rankings.js` | `GET` 목록 / `POST` 등록 |
| `einstein-riddle-app/js/auth.js` | sessionStorage 프로필, 로그인 모달 |
| `einstein-riddle-app/js/rankings.js` | 축하/학교명/랭킹 모달, API fetch |
| `einstein-riddle-app/js/main.js` | 버튼·제출 분기 연결 |
| `einstein-riddle-app/index.html` | 로그인·랭킹·축하 모달 DOM |
| `einstein-riddle-app/css/styles.css` | 모달·버튼 스타일 |
| `einstein-riddle-app/tests/run-tests.mjs` | 로직·DOM 계약 테스트 |
| `einstein-riddle-app/README.md` | env·배포 한 줄 |

---

### Task 1: 랭킹 순수 로직 (최고기록 upsert)

**Files:**
- Create: `einstein-riddle-app/lib/ranking-logic.mjs`
- Modify: `einstein-riddle-app/tests/run-tests.mjs`
- Modify: `einstein-riddle-app/tests/run-tests.html`

**Interfaces:**
- Produces:
  - `normalizeField(s: string): string` — trim + 연속 공백 축소
  - `identityKey({ name, role, school, difficulty }): string`
  - `upsertBestEntry(entries: Entry[], incoming: Entry): { status: "saved"|"not_improved", entries: Entry[], message?: string }`
  - `MAX_ENTRIES = 50`
  - Entry shape: `{ id, name, role, school, timeMs, difficulty, createdAt }`

- [ ] **Step 1: 실패 테스트 추가**

`run-tests.mjs` 상단 import에 추가하고, DOM 테스트 뒤에 블록 추가:

```js
import {
  normalizeField,
  identityKey,
  upsertBestEntry,
  MAX_ENTRIES,
} from "../lib/ranking-logic.mjs";

function testRankingLogic() {
  assert(normalizeField("  홍  길동 ") === "홍 길동", "normalize collapses spaces");
  const keyA = identityKey({ name: "홍길동", role: "student", school: "광주고", difficulty: "normal" });
  const keyB = identityKey({ name: " 홍길동 ", role: "student", school: " 광주고 ", difficulty: "normal" });
  assert(keyA === keyB, "identityKey ignores surrounding spaces");

  const base = [];
  const first = {
    id: "1",
    name: "홍길동",
    role: "student",
    school: "광주고",
    timeMs: 90000,
    difficulty: "normal",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  let r = upsertBestEntry(base, first);
  assert(r.status === "saved" && r.entries.length === 1, "first insert saved");

  r = upsertBestEntry(r.entries, { ...first, id: "2", timeMs: 80000, createdAt: "2026-01-02T00:00:00.000Z" });
  assert(r.status === "saved" && r.entries.length === 1 && r.entries[0].timeMs === 80000, "faster replaces");

  r = upsertBestEntry(r.entries, { ...first, id: "3", timeMs: 85000 });
  assert(r.status === "not_improved" && r.entries[0].timeMs === 80000, "slower rejected");
  assert(r.message === "이미 더 좋은 기록이 있습니다", "not_improved Korean message");

  const gen = { id: "g1", name: "손님", role: "general", school: "", timeMs: 1000, difficulty: "easy", createdAt: "2026-01-01T00:00:00.000Z" };
  r = upsertBestEntry([], gen);
  assert(r.entries[0].school === "", "general empty school");

  const many = Array.from({ length: 55 }, (_, i) => ({
    id: String(i),
    name: `n${i}`,
    role: "general",
    school: "",
    timeMs: 1000 + i,
    difficulty: "easy",
    createdAt: "2026-01-01T00:00:00.000Z",
  }));
  r = upsertBestEntry(many.slice(0, 50), many[50]);
  assert(r.entries.length <= MAX_ENTRIES, "trimmed to MAX_ENTRIES");
  assert(r.entries[0].timeMs <= r.entries[r.entries.length - 1].timeMs, "sorted ascending by timeMs");
}
testRankingLogic();
```

- [ ] **Step 2: RED 확인**

Run: `node --experimental-default-type=module einstein-riddle-app/tests/run-tests.mjs`  
Expected: FAIL — `ranking-logic.mjs` 없음 또는 export 없음.

- [ ] **Step 3: 구현**

`einstein-riddle-app/lib/ranking-logic.mjs`:

```js
export const MAX_ENTRIES = 50;

export function normalizeField(s) {
  return String(s ?? "").trim().replace(/\s+/g, " ");
}

export function identityKey({ name, role, school, difficulty }) {
  return [
    normalizeField(name),
    String(role ?? ""),
    normalizeField(school ?? ""),
    String(difficulty ?? ""),
  ].join("|");
}

export function upsertBestEntry(entries, incoming) {
  const list = Array.isArray(entries) ? entries.map((e) => ({ ...e })) : [];
  const key = identityKey(incoming);
  const idx = list.findIndex((e) => identityKey(e) === key);
  if (idx >= 0) {
    if (incoming.timeMs >= list[idx].timeMs) {
      list.sort((a, b) => a.timeMs - b.timeMs);
      return {
        status: "not_improved",
        entries: list.slice(0, MAX_ENTRIES),
        message: "이미 더 좋은 기록이 있습니다",
      };
    }
    list[idx] = { ...incoming };
  } else {
    list.push({ ...incoming });
  }
  list.sort((a, b) => a.timeMs - b.timeMs);
  return { status: "saved", entries: list.slice(0, MAX_ENTRIES) };
}
```

- [ ] **Step 4: GREEN 확인**

Run: `node --experimental-default-type=module einstein-riddle-app/tests/run-tests.mjs`  
Expected: ranking 관련 ok, 전체 failed = 0.

- [ ] **Step 5: `run-tests.html` 동기화 후 커밋**

기존 프로젝트 관례대로 `run-tests.mjs` 본문을 `run-tests.html`의 module 스크립트에 반영.

```powershell
$env:GIT_AUTHOR_NAME="Einstein Dev"; $env:GIT_AUTHOR_EMAIL="dev@local"
$env:GIT_COMMITTER_NAME="Einstein Dev"; $env:GIT_COMMITTER_EMAIL="dev@local"
git add einstein-riddle-app/lib/ranking-logic.mjs einstein-riddle-app/tests/run-tests.mjs einstein-riddle-app/tests/run-tests.html
git commit -m "feat: add ranking best-score upsert logic"
```

---

### Task 2: PIN 검증 헬퍼

**Files:**
- Create: `einstein-riddle-app/lib/pin.mjs`
- Modify: `einstein-riddle-app/tests/run-tests.mjs`
- Modify: `einstein-riddle-app/tests/run-tests.html`

**Interfaces:**
- Produces:
  - `isValidPinFormat(pin: string): boolean` — `/^\d{4}$/`
  - `checkPin(pin: string, expected: string | undefined): { ok: true } | { ok: false, error: "invalid_pin"|"misconfigured" }`

- [ ] **Step 1: 실패 테스트**

```js
import { isValidPinFormat, checkPin } from "../lib/pin.mjs";

function testPin() {
  assert(isValidPinFormat("1234"), "4 digits ok");
  assert(!isValidPinFormat("12a4"), "non-digit rejected");
  assert(!isValidPinFormat("123"), "short rejected");
  assert(checkPin("1234", "1234").ok === true, "matching pin ok");
  assert(checkPin("9999", "1234").error === "invalid_pin", "wrong pin");
  assert(checkPin("1234", undefined).error === "misconfigured", "missing env");
}
testPin();
```

- [ ] **Step 2: RED**

Run: same test command. Expected: FAIL missing `pin.mjs`.

- [ ] **Step 3: 구현**

```js
export function isValidPinFormat(pin) {
  return /^\d{4}$/.test(String(pin ?? ""));
}

export function checkPin(pin, expected) {
  if (!expected || !isValidPinFormat(expected)) {
    return { ok: false, error: "misconfigured" };
  }
  if (!isValidPinFormat(pin) || String(pin) !== String(expected)) {
    return { ok: false, error: "invalid_pin" };
  }
  return { ok: true };
}
```

- [ ] **Step 4: GREEN + 커밋**

```powershell
# env GIT_* 동일
git add einstein-riddle-app/lib/pin.mjs einstein-riddle-app/tests/run-tests.mjs einstein-riddle-app/tests/run-tests.html
git commit -m "feat: add login PIN validation helper"
```

---

### Task 3: Redis REST 헬퍼 + login API

**Files:**
- Create: `einstein-riddle-app/lib/redis.mjs`
- Create: `einstein-riddle-app/api/login.js`

**Interfaces:**
- Produces:
  - `redisGetJson(key): Promise<any|null>`
  - `redisSetJson(key, value): Promise<void>`
  - `api/login.js` default export `(req, res)` — POST only, body `{ pin }`, uses `process.env.LOGIN_PIN`

- [ ] **Step 1: `lib/redis.mjs` 작성**

Upstash REST (패키지 없이 `fetch`):

```js
function creds() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    const err = new Error("redis_misconfigured");
    err.code = "redis_misconfigured";
    throw err;
  }
  return { url: url.replace(/\/$/, ""), token };
}

export async function redisGetJson(key) {
  const { url, token } = creds();
  const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`redis_get_${res.status}`);
  const data = await res.json();
  if (data.result == null) return null;
  try {
    return typeof data.result === "string" ? JSON.parse(data.result) : data.result;
  } catch {
    return null;
  }
}

export async function redisSetJson(key, value) {
  const { url, token } = creds();
  const res = await fetch(`${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(value))}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`redis_set_${res.status}`);
}
```

(Upstash `SET` 경로가 환경에 따라 다르면 공식 REST `pipeline` POST `[["SET", key, json]]` 형태로 바꿔도 됨. 구현 시 Upstash 대시보드 예시와 맞출 것.)

- [ ] **Step 2: `api/login.js` 작성**

```js
import { checkPin } from "../lib/pin.mjs";

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(e); }
    });
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
    return;
  }
  try {
    const body = await readJson(req);
    const result = checkPin(body.pin, process.env.LOGIN_PIN);
    if (!result.ok) {
      res.statusCode = result.error === "misconfigured" ? 503 : 401;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: result.error }));
      return;
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true }));
  } catch {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: false, error: "bad_request" }));
  }
}
```

- [ ] **Step 3: 로컬 스모크 (선택)**

`LOGIN_PIN=1234`로 Vercel CLI `vercel dev --cwd einstein-riddle-app` 후:

```powershell
Invoke-RestMethod -Method POST -Uri http://localhost:3000/api/login -ContentType "application/json" -Body '{"pin":"1234"}'
```

Expected: `{ ok: true }`

- [ ] **Step 4: 커밋**

```powershell
git add einstein-riddle-app/lib/redis.mjs einstein-riddle-app/api/login.js
git commit -m "feat: add login API and Redis helper"
```

---

### Task 4: rankings API (GET/POST)

**Files:**
- Create: `einstein-riddle-app/api/rankings.js`
- Modify: `einstein-riddle-app/tests/run-tests.mjs` (요청 검증용 순수 함수를 `lib/ranking-api.mjs`로 분리해도 됨)

**Interfaces:**
- Produces: `GET ?difficulty=` → `{ difficulty, entries }`  
  `POST` body → pin + profile + timeMs → `upsertBestEntry` → Redis set → `{ status, entries, message? }`
- Consumes: `checkPin`, `redisGetJson`/`redisSetJson`, `upsertBestEntry`, `normalizeField`

- [ ] **Step 1: 요청 정규화 헬퍼 테스트 + 구현 (`lib/ranking-api.mjs`)**

```js
const ROLES = new Set(["student", "teacher", "general"]);
const DIFFS = new Set(["easy", "normal", "hard", "expert"]);

export function normalizeRankingPost(body) {
  const name = normalizeField(body?.name);
  const role = String(body?.role ?? "");
  const difficulty = String(body?.difficulty ?? "");
  const timeMs = Number(body?.timeMs);
  let school = normalizeField(body?.school ?? "");
  if (!name) return { error: "name_required" };
  if (!ROLES.has(role)) return { error: "role_invalid" };
  if (!DIFFS.has(difficulty)) return { error: "difficulty_invalid" };
  if (!Number.isFinite(timeMs) || timeMs <= 0 || !Number.isInteger(timeMs)) return { error: "time_invalid" };
  if (role === "general") school = "";
  else if (!school) return { error: "school_required" };
  return { value: { name, role, school, difficulty, timeMs, pin: body?.pin } };
}
```

테스트:

```js
import { normalizeRankingPost } from "../lib/ranking-api.mjs";
assert(normalizeRankingPost({ name: "A", role: "student", school: "", difficulty: "easy", timeMs: 1 }).error === "school_required", "student needs school");
assert(normalizeRankingPost({ name: "A", role: "general", school: "X", difficulty: "easy", timeMs: 1 }).value.school === "", "general clears school");
```

- [ ] **Step 2: `api/rankings.js` 구현**

- CORS + OPTIONS
- GET: `difficulty` 쿼리 검증 → `redisGetJson("rankings:"+diff)` → 배열 보장 → JSON
- POST: pin check → normalize → `id`는 `crypto.randomUUID()` → upsert → set → 응답
- Redis 오류: 503 `{ error: "redis_unavailable" }`

- [ ] **Step 3: GREEN 테스트 + 커밋**

```powershell
git add einstein-riddle-app/lib/ranking-api.mjs einstein-riddle-app/api/rankings.js einstein-riddle-app/tests/run-tests.mjs einstein-riddle-app/tests/run-tests.html
git commit -m "feat: add shared rankings API"
```

---

### Task 5: 로그인 UI + 세션 (`auth.js`)

**Files:**
- Create: `einstein-riddle-app/js/auth.js`
- Modify: `einstein-riddle-app/index.html`
- Modify: `einstein-riddle-app/css/styles.css`
- Modify: `einstein-riddle-app/js/main.js` (바인딩만 최소)
- Modify: `einstein-riddle-app/tests/run-tests.mjs` (DOM ids)

**Interfaces:**
- Produces:
  - `getProfile(): { name, role } | null`
  - `setProfile(p)`, `clearProfile()`
  - `openLoginModal({ onSuccess?: () => void })`
  - `bindAuthUi({ onProfileChange })`
  - sessionStorage key: `einstein.auth.v1`
  - role values: `student` | `teacher` | `general` (표시: 학생/교사/일반)

- [ ] **Step 1: DOM 계약 테스트 추가**

```js
assert(html.includes('id="btn-intro-login"'), "intro login button");
assert(html.includes('id="login-modal"'), "login modal");
assert(html.includes('id="login-name"'), "login name field");
assert(html.includes('id="login-role"'), "login role field");
assert(html.includes('id="login-pin"'), "login pin field");
assert(html.includes('id="login-status"'), "login status");
```

- [ ] **Step 2: RED → HTML에 인트로 로그인 버튼 + 모달 마크업**

`#btn-intro-start` 아래:

```html
<button type="button" id="btn-intro-login" class="cta-login">로그인</button>
<p id="intro-auth-label" class="intro-auth-label" hidden></p>
```

모달(포기 모달과 형제):

```html
<div id="login-modal" class="app-modal hidden" aria-hidden="true">
  <div class="app-modal__backdrop" data-login-cancel></div>
  <div class="app-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="login-modal-title">
    <h2 id="login-modal-title" class="app-modal__title">로그인</h2>
    <label>이름 <input id="login-name" type="text" autocomplete="nickname" required /></label>
    <label>구분
      <select id="login-role">
        <option value="student">학생</option>
        <option value="teacher">교사</option>
        <option value="general">일반</option>
      </select>
    </label>
    <label>암호 <input id="login-pin" type="password" inputmode="numeric" maxlength="4" pattern="\d{4}" required /></label>
    <p id="login-status" class="app-modal__status" role="status"></p>
    <div class="app-modal__actions">
      <button type="button" id="login-confirm" class="app-modal__btn app-modal__btn--yes">확인</button>
      <button type="button" id="login-cancel" class="app-modal__btn app-modal__btn--no">취소</button>
    </div>
  </div>
</div>
```

- [ ] **Step 3: `js/auth.js` + CSS (`.cta-login`, `.app-modal`는 giveup 스타일 재사용/확장)**

확인 클릭 시:

```js
const res = await fetch("/api/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ pin }),
});
const data = await res.json();
if (!data.ok) { statusEl.textContent = data.error === "invalid_pin" ? "암호가 올바르지 않습니다." : "로그인 서버를 사용할 수 없습니다."; return; }
setProfile({ name, role });
```

PIN은 세션에 저장하지 않음. 등록 시 사용자가 다시 넣지 않도록 **등록 API에 쓸 PIN은 로그인 성공 직후 메모리 변수** `let sessionPin`에만 보관(새로고침 시 재로그인). Spec의 「단순 로그인」에 맞춤.

- [ ] **Step 4: `main.js`에서 `bindAuthUi` 호출, intro 라벨 갱신**

- [ ] **Step 5: 테스트 GREEN + 커밋**

```powershell
git commit -m "feat: add intro login modal and session profile"
```

---

### Task 6: 랭킹·정답 등록 UI (`rankings.js`)

**Files:**
- Create: `einstein-riddle-app/js/rankings.js`
- Modify: `einstein-riddle-app/index.html`
- Modify: `einstein-riddle-app/css/styles.css`
- Modify: `einstein-riddle-app/js/main.js`
- Modify: `einstein-riddle-app/tests/run-tests.mjs`

**Interfaces:**
- Produces:
  - `openCelebrateRegister({ elapsedMs, difficulty, formatMs, getProfile, getSessionPin, openLogin, onDone })`
  - `openRankingList({ difficulty, statusMessage? })`
  - `fetchRankings(difficulty)`
  - `submitRanking({ ... })`
- DOM ids: `btn-ranking`, `celebrate-modal`, `celebrate-yes`, `celebrate-no`, `school-modal`, `school-input`, `ranking-modal`, `ranking-list`, `ranking-close`, `ranking-status`

- [ ] **Step 1: DOM 계약 테스트**

```js
assert(html.includes('id="btn-ranking"'), "toolbar ranking button");
assert(html.includes('id="celebrate-modal"'), "celebrate modal");
assert(html.includes('id="ranking-modal"'), "ranking modal");
assert(html.includes('id="school-modal"'), "school modal");
```

- [ ] **Step 2: HTML — 툴바 `#btn-submit` 옆 `#btn-ranking`, 축하/학교/랭킹 모달**

축하 모달 문구:

- `정답입니다! 소요 시간 {mm:ss}`
- `랭킹에 등록하시겠습니까?`
- 버튼: 예 / 아니오 (`celebrate-yes` / `celebrate-no`)

학교 모달: 입력 + 확인/취소

랭킹 모달: `#ranking-title`(난이도 한글), `#ranking-status`, `<ol id="ranking-list">`, `#ranking-close`

난이도 라벨 맵: `easy→쉬움`, `normal→보통`, `hard→어려움`, `expert→매우 어려움`

행 렌더:

```js
`${i + 1}위  ${formatMs(e.timeMs)}  ${e.school || "—"}  ${roleLabel(e.role)}  ${e.name}`
```

- [ ] **Step 3: `rankings.js` 흐름**

- 아니오 → `openRankingList` only  
- 예 → profile 없으면 login(`onSuccess`로 재개) → role student/teacher면 school modal → `POST /api/rankings` with `getSessionPin()` → status에 따라 메시지 → list  
- `getSessionPin()` 없으면 로그인 재요청

- [ ] **Step 4: `main.js` 제출 분기**

```js
if (result.solved) {
  game.stopTimer();
  const ms = game.getElapsedMs();
  fb.textContent = `정답입니다! 소요 시간 ${formatMs(ms)}`;
  fb.classList.add("ok");
  openCelebrateRegister({
    elapsedMs: ms,
    difficulty: game.getDifficulty(),
    formatMs,
    getProfile,
    getSessionPin,
    openLogin: openLoginModal,
  });
} else {
  // existing wrong path; do not stop timer? Spec earlier stopped on submit — keep current: stopTimer already in old code for all complete submits
}
```

기존 코드는 complete면 `stopTimer` 후 정오답 분기. **유지**: 배치 완료 제출 시 타이머 정지.

- [ ] **Step 5: GREEN + 커밋**

```powershell
git commit -m "feat: add celebrate register flow and ranking modal"
```

---

### Task 7: README·vercel·배포 스모크

**Files:**
- Modify: `einstein-riddle-app/README.md`
- Modify: `einstein-riddle-app/vercel.json` (필요 시 API에 캐시 헤더 제외 — 기본 cleanUrls면 충분)

- [ ] **Step 1: README에 섹션 추가**

```markdown
## 로그인·랭킹 (Vercel)

환경 변수:
- `LOGIN_PIN` — 숫자 4자리
- `KV_REST_API_URL`, `KV_REST_API_TOKEN` — Upstash / Vercel KV

Storage: Vercel 대시보드에서 Upstash Redis 연결 후 변수 자동 주입 가능.
```

- [ ] **Step 2: 사용자/에이전트가 Vercel에 env 설정 + `vercel deploy --prod --cwd einstein-riddle-app`**

스모크:
1. 인트로 로그인 (잘못된 PIN → 오류, 맞는 PIN → 라벨)
2. 비로그인 게임 시작
3. 정답 → 아니오 → 랭킹 목록
4. 정답 → 예 → (학생) 학교명 → 목록에 본인
5. 더 느린 재등록 → 「이미 더 좋은 기록이 있습니다」
6. 툴바 랭킹 버튼

- [ ] **Step 3: 커밋·푸시**

```powershell
git add einstein-riddle-app/README.md
git commit -m "docs: document login PIN and Redis env vars"
git push origin HEAD:feature/einstein-riddle
git push origin HEAD:main
```

---

## Spec coverage checklist

| Spec 항목 | Task |
|-----------|------|
| 공유 랭킹 Redis | 3–4 |
| 비로그인 플레이 / 등록만 로그인 | 5–6 |
| 로그인 필드 이름·구분·PIN | 5 |
| 학교명 O 경로 학생·교사만 | 6 |
| 정답 O/X + X는 조회만 | 6 |
| 툴바 랭킹 | 6 |
| 최고기록 1건 | 1, 4 |
| API login/rankings | 3–4 |
| Env LOGIN_PIN / KV_* | 3, 7 |
| UI giveup 톤 | 5–6 |

## Self-review notes

- Placeholder 없음. Redis SET URL은 Upstash 변형 시 Task 3에서 pipeline으로 교체 명시.
- `sessionPin`은 spec에 명시되지 않았으나 POST에 pin이 필요해 Task 5에 메모리 보관으로 명시(세션스토리지에 PIN 저장 금지).
- `formatMs`는 `main.js` 로컬 함수 → Task 6에서 인자로 주입해 순환 의존 방지.

---

**Plan complete and saved to `docs/superpowers/plans/2026-09-15-login-ranking.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — 태스크마다 새 서브에이전트, 사이 리뷰

**2. Inline Execution** — 이 세션에서 순서대로 실행·체크포인트

**Which approach?**
