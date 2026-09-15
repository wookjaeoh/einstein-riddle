import { getProfile, getSessionPin, openLoginModal, roleLabel } from "./auth.js";

const DIFFICULTY_LABELS = {
  easy: "쉬움",
  normal: "보통",
  hard: "어려움",
  expert: "매우 어려움",
};

function setOpen(id, open) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle("hidden", !open);
  el.setAttribute("aria-hidden", open ? "false" : "true");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function fetchRankings(difficulty) {
  const res = await fetch(`/api/rankings?difficulty=${encodeURIComponent(difficulty)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "fetch_failed");
    err.code = data.error || "fetch_failed";
    throw err;
  }
  return data;
}

export async function submitRanking(payload) {
  const res = await fetch("/api/rankings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "submit_failed");
    err.code = data.error || "submit_failed";
    throw err;
  }
  return data;
}

export function renderRankingList(entries, formatMs) {
  const list = document.getElementById("ranking-list");
  if (!list) return;
  if (!entries?.length) {
    list.innerHTML = `<li class="ranking-empty">아직 기록이 없습니다.</li>`;
    return;
  }
  list.innerHTML = entries
    .map(
      (entry, index) =>
        `<li class="ranking-row"><span class="ranking-rank">${index + 1}위</span>` +
        `<span class="ranking-time">${escapeHtml(formatMs(entry.timeMs))}</span>` +
        `<span class="ranking-school">${escapeHtml(entry.school || "—")}</span>` +
        `<span class="ranking-role">${escapeHtml(roleLabel(entry.role))}</span>` +
        `<span class="ranking-name">${escapeHtml(entry.name)}</span></li>`,
    )
    .join("");
}

export async function openRankingList({ difficulty, statusMessage, formatMs }) {
  const title = document.getElementById("ranking-title");
  const status = document.getElementById("ranking-status");
  if (title) {
    title.textContent = `랭킹 · ${DIFFICULTY_LABELS[difficulty] ?? difficulty}`;
  }
  if (status) status.textContent = statusMessage ?? "불러오는 중…";
  setOpen("celebrate-modal", false);
  setOpen("school-modal", false);
  setOpen("ranking-modal", true);

  try {
    const data = await fetchRankings(difficulty);
    renderRankingList(data.entries ?? [], formatMs);
    if (status && !statusMessage) status.textContent = "";
    else if (status && statusMessage) status.textContent = statusMessage;
  } catch {
    renderRankingList([], formatMs);
    if (status) {
      status.textContent = statusMessage
        ? `${statusMessage} (목록을 불러오지 못했습니다.)`
        : "랭킹을 불러오지 못했습니다. 서버·Redis 설정을 확인해 주세요.";
    }
  }
}

async function registerFlow({ elapsedMs, difficulty, formatMs, school }) {
  const profile = getProfile();
  const pin = getSessionPin();
  if (!profile || !pin) {
    openLoginModal({
      onSuccess: () => {
        void continueRegisterAfterAuth({ elapsedMs, difficulty, formatMs });
      },
    });
    return;
  }

  try {
    const data = await submitRanking({
      pin,
      name: profile.name,
      role: profile.role,
      school: school ?? "",
      timeMs: elapsedMs,
      difficulty,
    });
    const message =
      data.status === "not_improved"
        ? data.message || "이미 더 좋은 기록이 있습니다"
        : data.status === "saved"
          ? "기록이 등록되었습니다."
          : "";
    if (data.entries) {
      const title = document.getElementById("ranking-title");
      const status = document.getElementById("ranking-status");
      if (title) title.textContent = `랭킹 · ${DIFFICULTY_LABELS[difficulty] ?? difficulty}`;
      if (status) status.textContent = message;
      renderRankingList(data.entries, formatMs);
      setOpen("celebrate-modal", false);
      setOpen("school-modal", false);
      setOpen("ranking-modal", true);
    } else {
      await openRankingList({ difficulty, statusMessage: message, formatMs });
    }
  } catch (error) {
    const msg =
      error.code === "invalid_pin"
        ? "암호가 만료되었습니다. 다시 로그인해 주세요."
        : error.code === "school_required"
          ? "학교명을 입력해 주세요."
          : "기록 등록에 실패했습니다. 잠시 후 다시 시도해 주세요.";
    await openRankingList({ difficulty, statusMessage: msg, formatMs });
  }
}

async function continueRegisterAfterAuth({ elapsedMs, difficulty, formatMs }) {
  const profile = getProfile();
  if (!profile) return;
  if (profile.role === "student" || profile.role === "teacher") {
    openSchoolModal({ elapsedMs, difficulty, formatMs });
    return;
  }
  await registerFlow({ elapsedMs, difficulty, formatMs, school: "" });
}

function openSchoolModal({ elapsedMs, difficulty, formatMs }) {
  const input = document.getElementById("school-input");
  const status = document.getElementById("school-status");
  if (status) status.textContent = "";
  if (input) input.value = "";
  setOpen("celebrate-modal", false);
  setOpen("school-modal", true);
  input?.focus();

  const confirm = document.getElementById("school-confirm");
  const cancel = document.getElementById("school-cancel");
  const backdrop = document.querySelector("[data-school-cancel]");

  const cleanup = () => {
    confirm?.removeEventListener("click", onConfirm);
    cancel?.removeEventListener("click", onCancel);
    backdrop?.removeEventListener("click", onCancel);
  };

  const onCancel = () => {
    cleanup();
    setOpen("school-modal", false);
    void openRankingList({
      difficulty,
      statusMessage: "학교명 입력을 취소했습니다.",
      formatMs,
    });
  };

  const onConfirm = () => {
    const school = String(input?.value ?? "").trim();
    if (!school) {
      if (status) status.textContent = "학교명을 입력해 주세요.";
      return;
    }
    cleanup();
    void registerFlow({ elapsedMs, difficulty, formatMs, school });
  };

  confirm?.addEventListener("click", onConfirm);
  cancel?.addEventListener("click", onCancel);
  backdrop?.addEventListener("click", onCancel);
}

export function openCelebrateRegister({ elapsedMs, difficulty, formatMs }) {
  const msg = document.getElementById("celebrate-message");
  if (msg) {
    msg.innerHTML =
      `정답입니다! 소요 시간 <strong>${escapeHtml(formatMs(elapsedMs))}</strong><br />` +
      `랭킹에 등록하시겠습니까?`;
  }
  setOpen("ranking-modal", false);
  setOpen("school-modal", false);
  setOpen("celebrate-modal", true);

  const yes = document.getElementById("celebrate-yes");
  const no = document.getElementById("celebrate-no");
  const backdrop = document.querySelector("[data-celebrate-cancel]");

  const cleanup = () => {
    yes?.removeEventListener("click", onYes);
    no?.removeEventListener("click", onNo);
    backdrop?.removeEventListener("click", onNo);
  };

  const onNo = () => {
    cleanup();
    void openRankingList({ difficulty, formatMs });
  };

  const onYes = () => {
    cleanup();
    const profile = getProfile();
    const pin = getSessionPin();
    if (!profile || !pin) {
      setOpen("celebrate-modal", false);
      openLoginModal({
        onSuccess: () => {
          void continueRegisterAfterAuth({ elapsedMs, difficulty, formatMs });
        },
      });
      return;
    }
    if (profile.role === "student" || profile.role === "teacher") {
      openSchoolModal({ elapsedMs, difficulty, formatMs });
      return;
    }
    void registerFlow({ elapsedMs, difficulty, formatMs, school: "" });
  };

  yes?.addEventListener("click", onYes);
  no?.addEventListener("click", onNo);
  backdrop?.addEventListener("click", onNo);
}

export function bindRankingUi({ getDifficulty, formatMs }) {
  document.getElementById("btn-ranking")?.addEventListener("click", () => {
    void openRankingList({ difficulty: getDifficulty(), formatMs });
  });
  document.getElementById("ranking-close")?.addEventListener("click", () => {
    setOpen("ranking-modal", false);
  });
  document.querySelector("[data-ranking-cancel]")?.addEventListener("click", () => {
    setOpen("ranking-modal", false);
  });
}
