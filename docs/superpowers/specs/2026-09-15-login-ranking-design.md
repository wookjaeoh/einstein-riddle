# 로그인·공유 랭킹 설계

**날짜:** 2026-09-15  
**앱:** `einstein-riddle-app` (아인슈타인 추론 게임)  
**상태:** 승인됨

## 목표

수업용 웹앱에 단순 PIN 로그인과, 기기 간에 공유되는 난이도별 최고기록 랭킹을 추가한다.

## 확정 요구사항

- 랭킹은 **모든 이용자가 공유** (서버 저장).
- 비로그인도 **게임 플레이 가능**. **기록 등록**은 로그인 필요.
- 로그인 필드: **이름** → **구분(학생/교사/일반)** → **암호 4자리**.
- 학교명은 로그인에 없고, **정답 후 등록(O) 시 학생·교사만** 입력.
- 정답 제출 시 축하 + 「랭킹에 등록하시겠습니까?」 **O / X**.
  - **O:** 등록 흐름 (학생·교사는 학교명 입력) → 랭킹 표시.
  - **X:** 등록 없이 랭킹만 표시.
- 툴바 **「랭킹」**으로 언제든 조회 가능.
- 동일 신원·동일 난이도는 **본인 최고기록 1건만** 유지.

## 비목표

- 실명 인증·개인 계정·비밀번호 재설정.
- 실시간 웹소켓 갱신(조회·등록 시 REST로 충분).
- 관리자용 랭킹 삭제 UI(필요 시 추후).

## 아키텍처

정적 프론트(기존) + Vercel Serverless API + **Upstash Redis**.

```
[브라우저] --POST /api/login--> [Vercel Function] --검증--> LOGIN_PIN env
[브라우저] --GET/POST /api/rankings--> [Vercel Function] --읽기/쓰기--> Upstash Redis
```

## 화면·흐름

### 인트로

- 「게임 시작」 아래 「로그인」.
- 로그인 성공 시 `이름 (구분)` 짧게 표시. 재로그인으로 변경 가능.
- 「게임 시작」은 비로그인 허용 → 기존처럼 방법 화면 → 게임.

### 로그인 모달

1. 이름 (필수)
2. 구분: `학생` | `교사` | `일반` (필수)
3. 암호 4자리 숫자 (필수)
4. 확인 / 취소

확인 시 `POST /api/login`으로 PIN만 검증. 성공하면 프로필을 `sessionStorage`(또는 동등 세션)에 저장.

### 게임

- 툴바에 「랭킹」 추가 → 현재 난이도 랭킹 모달(목록 + 닫기).
- 「제출」 오답: 기존처럼 틀린 칸 수만.
- 「제출」 정답: 타이머 정지 + 축하 모달.

### 정답 직후 모달

1. 축하 문구 + 소요 시간 + 「랭킹에 등록하시겠습니까?」 + **예(O) / 아니오(X)**
2. **아니오:** `GET /api/rankings` → 랭킹 모달(등록 없음).
3. **예:**
   - 비로그인 → 「로그인이 필요합니다」 → 로그인 모달 → 성공 시 등록 흐름 재개.
   - 로그인 + 학생/교사 → 학교명 입력 단계 → `POST /api/rankings`.
   - 로그인 + 일반 → 학교명 생략 → `POST /api/rankings`.
4. 등록 결과(성공·최고기록 미갱신·오류) 안내 후 랭킹 목록 + **닫기**.

### 랭킹 모달 UI

- 헤더: 현재 난이도.
- 행: `순위 | 시간 | 학교명 | 구분 | 이름` (일반·학교 없음은 학교란 `—`).
- 하단: **닫기**만. (등록은 정답 O 경로에서만)

모달 시각 톤: 기존 포기 모달과 동일 계열(네이비 + 주황 액센트).

## 데이터

### 클라이언트 세션 프로필

```json
{
  "name": "홍길동",
  "role": "student" | "teacher" | "general"
}
```

학교명은 등록 시에만 입력·전송. 학생/교사 등록 후 같은 세션에서 재사용할 수 있게 선택적으로 캐시 가능.

### Redis

- 키: `rankings:{difficulty}` (`easy` | `normal` | `hard` | `expert`)
- 값: JSON 배열 (또는 동등 구조), 항목:

```json
{
  "id": "uuid",
  "name": "홍길동",
  "role": "student",
  "school": "○○고",
  "timeMs": 83000,
  "difficulty": "normal",
  "createdAt": "ISO-8601"
}
```

- `role === "general"` 이면 `school`은 빈 문자열 또는 생략.
- 정렬: `timeMs` 오름차순. 상위 최대 **50**건 유지.

### 본인 최고기록 키

동일 신원 판별:

`normalize(name) + "|" + role + "|" + normalize(school|"" ) + "|" + difficulty`

- 신규가 기존보다 **빠르면** 기존 항목 교체 후 재정렬.
- **같거나 느리면** 저장하지 않고 `status: "not_improved"` + 메시지 「이미 더 좋은 기록이 있습니다」.
- 동일 신원 없음 → 삽입.

## API

### `POST /api/login`

- Body: `{ "pin": "1234" }`
- 서버: `process.env.LOGIN_PIN`과 비교 (정확히 4자리 숫자 형식 검증).
- 200: `{ "ok": true }`
- 401: `{ "ok": false, "error": "invalid_pin" }`

프로필 필드(이름·구분)는 서버에 저장하지 않음. PIN 통과만 의미 있음.

### `GET /api/rankings?difficulty=normal`

- 200: `{ "difficulty": "normal", "entries": [ ... ] }` (정렬·최대 50)

### `POST /api/rankings`

- Body:

```json
{
  "pin": "1234",
  "name": "홍길동",
  "role": "student",
  "school": "○○고",
  "timeMs": 83000,
  "difficulty": "normal"
}
```

- 검증:
  - PIN 일치
  - `name` 비어 있지 않음
  - `role` ∈ { student, teacher, general }
  - 학생/교사: `school` 필수(공백 불가)
  - 일반: `school` 무시/공백
  - `timeMs` 양의 정수
  - `difficulty` 허용 값
- 응답:
  - 삽입/갱신: `{ "status": "saved", "entries": [...] }`
  - 미개선: `{ "status": "not_improved", "entries": [...], "message": "..." }`
  - 오류: 4xx + `{ "error": "..." }`

## 환경 변수

| 이름 | 용도 |
|------|------|
| `LOGIN_PIN` | 4자리 수업용 PIN |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` (또는 Upstash 표준 변수) | Redis 접속 |

로컬·프리뷰에서도 PIN·Redis가 없으면 API는 명확한 5xx/503과 안내 문구. **게임 플레이는 오프라인으로 유지**.

## 프론트 모듈(예상)

- `js/auth.js` — 로그인 모달, 세션 프로필
- `js/rankings.js` — API 호출, 랭킹/등록 모달 상태
- `api/login.js`, `api/rankings.js` — Vercel serverless
- `index.html` / `css/styles.css` — 버튼·모달 마크업·스타일
- `main.js` — 제출·정답 분기 연결

## 테스트

- 단위: 신원 키 정규화, 최고기록 교체/거절 로직(순수 함수로 분리 시).
- DOM 계약: 로그인 버튼, 랭킹 버튼, 관련 모달 id 존재.
- API: pin 실패, school 누락(학생), 일반 school 생략, not_improved, saved 정렬.

## 배포 체크리스트

1. Upstash Redis를 Vercel 프로젝트에 연결.
2. `LOGIN_PIN` 설정 (예: 교사만 아는 4자리).
3. `api/` 포함해 프로덕션 배포.
4. 인트로 → 로그인 → 플레이 → 정답 → O/X → 랭킹 스모크.
