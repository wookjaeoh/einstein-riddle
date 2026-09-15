# Click Pick-Place and Hand Cursor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 클릭으로 카드를 집고 다시 클릭해 놓으며, PC에서 오른손 펼침/움켜쥠 커서를 쓴다.

**Architecture:** `drag-drop.js`를 클릭 토글 픽업 + pointermove 고스트로 재작성. SVG 커서를 `assets/cursors/`에 두고 CSS로 적용.

**Tech Stack:** Vanilla JS, CSS cursors, Node tests.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-15-click-pick-place-hand-cursor.md`
- 1클릭 집기, 슬롯/풀 클릭 놓기, 빈곳/Esc 취소
- `onDrop` API 유지, 잠금 시 무시
- PC 커스텀 손 커서; 터치에서는 커서 무시
- Commit: Einstein Dev / dev@local; sync run-tests.html

---

### Task 1: 픽&플레이스 + 커서

**Files:** `js/drag-drop.js`, `css/styles.css`, `assets/cursors/hand-open.svg`, `assets/cursors/hand-grab.svg`, `tests/run-tests.mjs`, `tests/run-tests.html`, README 한 줄

- [ ] TDD: 클릭 집기 → 슬롯 클릭 놓기; Esc/빈곳 취소; locked면 집기 안 됨
- [ ] 구현 픽&플레이스
- [ ] SVG 커서 + CSS
- [ ] GREEN + commit `feat: click-to-pick cards with hand cursors`
- [ ] 배포 푸시 (GitHub/Vercel)

---
