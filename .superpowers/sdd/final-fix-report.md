# 최종 Important 리뷰 수정 보고서

**일시:** 2026-09-08  
**기준 HEAD:** 1e8312b  
**상태:** 완료

## 수정 요약

### 1) 교사 패널 배치 비교값 갱신

| 파일 | 변경 |
|------|------|
| `js/main.js` | `renderAll()` 마지막에 `teacherPanel?.refresh?.()` 호출 — 카드 이동·Undo·초기화·단서 선택·새 문제 후 일관 갱신 |
| `js/main.js` | `startNewPuzzle()`의 중복 `teacherPanel.refresh()` 제거 (`renderAll`이 처리) |

**설계:**
- `bindTeacherPanel.refresh()`는 내부 `unlocked`일 때만 `renderAnswer()` 실행 → 잠금 상태에서는 no-op
- `renderAll` → DOM 재렌더 → `refresh` 순서로 무한 재귀 없음 (`refresh`는 `answer-board` innerHTML만 갱신)

### 2) drag-drop pointer 취소 cleanup

| 파일 | 변경 |
|------|------|
| `js/drag-drop.js` | `createDragDrop()` 추출 — 테스트·바인딩 분리 |
| `js/drag-drop.js` | `cleanupDrag({ commitDrop, event })` — ghost 제거, dragging/drop-target 클래스 정리, capture 해제 |
| `js/drag-drop.js` | `pointercancel`(window) + `lostpointercapture`(active card) 경로에서 `commitDrop: false`로 cleanup |
| `js/drag-drop.js` | `pointerup`만 `commitDrop: true` → 유효 drop target일 때 `onDrop` 호출 |

**취소 동작:**
- ghost DOM 제거, `.dragging` / `.drop-target` 클래스 제거
- `onDrop` 미호출 → 게임 상태·배치 유지
- `lostpointercapture`는 드래그 시작 카드에 등록 (capture 상실 시 신뢰성 높음)
- `dragging = null`을 cleanup 초반에 설정해 이중 cleanup 방지

## 테스트

### run-tests.mjs

```text
node --experimental-default-type=module einstein-riddle-app/tests/run-tests.mjs
```

- **39 passed, 0 failed**
- `testTeacherRefreshOnPlacementChange` — 빈 배치(25)·정답 일치(0)·1칸 오류(1) 비교값 갱신
- `testDragCancelCleanup` — fake DOM으로 `pointercancel`·`lostpointercapture` 후 ghost/dragging/onDrop 검증

### run-tests.html

- `testTeacherPlacementRefresh` — placement 변경 후 refresh 비교값
- `testDragPointerCancel` — 브라우저 DOM에서 cancel cleanup

### 린트

- 수정 파일 IDE lint 오류 0

## 수동 검증 근거

| 시나리오 | 기대 | 자동 검증 |
|----------|------|-----------|
| 카드 드래그 중 ESC/시스템 cancel | ghost·dragging 잔류 없음, 배치 불변 | `testDragCancelCleanup` |
| capture 상실 (탭 전환 등) | 동일 cleanup | `lostpointercapture` 테스트 |
| 교사 잠금 해제 후 카드 이동 | "틀린 칸(비교)" 숫자 변경 | placement refresh 테스트 |
| 교사 잠금 상태 | refresh no-op | `teacher.js` unlocked 가드 (기존) |

## 커밋

```text
fix: refresh teacher comparison and cancel pointer drag
```

## 남은 우려사항

- `renderAll()` 호출마다 교사 패널이 unlocked이면 answer 테이블 전체를 다시 그림 — 성능 영향은 미미하나, 대규모 UI 확장 시 diff 갱신 고려 가능
- `lostpointercapture`와 `pointercancel`이 동일 세션에서 연속 발생할 수 있으나, cleanup 초반 `dragging = null`로 두 번째 호출은 no-op
- 브라우저 실제 터치·펜 제스처 cancel은 환경별 이벤트 순서 차이 가능 — `createDragDrop` 단위 테스트와 run-tests.html으로 핵심 경로는 커버, 실기기 스모크는 권장

---

## 2026-09-15 whole-branch Important 수정

### 변경

- `drag-drop.js`에 `isLocked` 옵션을 추가하고 `pointerdown` 시작 시 잠금이면 즉시 반환
- `main.js`에서 `isLocked: () => game.isInteractionLocked()` 연결
- `hints.js`의 관련 단서를 직접 값 언급(우선)과 정답상 같은 집 값 언급(차선)으로 순위화
- 추론의 첫 인용이 가능한 경우 사실 값을 직접 언급하는 단서가 되도록 관련 단서 선택 정렬
- Node 및 브라우저 테스트에 잠금 드래그와 직접 단서 인용 회귀 검증 동기화

### TDD 및 검증

- RED: `169 passed, 2 failed` — 잠금 중 카드 복제, 직접 값 단서 미인용 재현
- GREEN: `171 passed, 0 failed`
- 명령: `node --experimental-default-type=module einstein-riddle-app/tests/run-tests.mjs`
- 수정 파일 IDE lint 오류 없음
