const STORAGE_KEY = "einstein.auth.v1";
const ROLE_LABELS = {
  student: "학생",
  teacher: "교사",
  general: "일반",
};

let sessionPin = null;
let pendingOnSuccess = null;

export function roleLabel(role) {
  return ROLE_LABELS[role] ?? role;
}

export function getProfile() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.name || !data?.role) return null;
    return { name: data.name, role: data.role };
  } catch {
    return null;
  }
}

export function setProfile(profile) {
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ name: profile.name, role: profile.role }),
  );
}

export function clearProfile() {
  sessionStorage.removeItem(STORAGE_KEY);
  sessionPin = null;
}

export function getSessionPin() {
  return sessionPin;
}

export function setSessionPin(pin) {
  sessionPin = pin;
}

function setModalOpen(open) {
  const modal = document.getElementById("login-modal");
  if (!modal) return;
  modal.classList.toggle("hidden", !open);
  modal.setAttribute("aria-hidden", open ? "false" : "true");
}

function setStatus(message) {
  const el = document.getElementById("login-status");
  if (el) el.textContent = message ?? "";
}

export function updateIntroAuthLabel() {
  const label = document.getElementById("intro-auth-label");
  if (!label) return;
  const profile = getProfile();
  if (!profile) {
    label.hidden = true;
    label.textContent = "";
    return;
  }
  label.hidden = false;
  label.textContent = `${profile.name} (${roleLabel(profile.role)})`;
}

export function openLoginModal({ onSuccess } = {}) {
  pendingOnSuccess = typeof onSuccess === "function" ? onSuccess : null;
  setStatus("");
  const nameEl = document.getElementById("login-name");
  const roleEl = document.getElementById("login-role");
  const pinEl = document.getElementById("login-pin");
  const profile = getProfile();
  if (nameEl) nameEl.value = profile?.name ?? "";
  if (roleEl) roleEl.value = profile?.role ?? "student";
  if (pinEl) pinEl.value = "";
  setModalOpen(true);
  nameEl?.focus();
}

function closeLoginModal() {
  setModalOpen(false);
  pendingOnSuccess = null;
}

async function submitLogin() {
  const name = String(document.getElementById("login-name")?.value ?? "").trim();
  const role = String(document.getElementById("login-role")?.value ?? "");
  const pin = String(document.getElementById("login-pin")?.value ?? "");
  const confirmBtn = document.getElementById("login-confirm");

  if (!name) {
    setStatus("이름을 입력해 주세요.");
    return;
  }
  if (!/^\d{4}$/.test(pin)) {
    setStatus("암호는 숫자 4자리여야 합니다.");
    return;
  }

  if (confirmBtn) confirmBtn.disabled = true;
  setStatus("확인 중…");
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const data = await res.json().catch(() => ({}));
    if (!data.ok) {
      setStatus(
        data.error === "invalid_pin"
          ? "암호가 올바르지 않습니다."
          : "로그인 서버를 사용할 수 없습니다.",
      );
      return;
    }
    setProfile({ name, role });
    setSessionPin(pin);
    updateIntroAuthLabel();
    const cb = pendingOnSuccess;
    setModalOpen(false);
    pendingOnSuccess = null;
    if (cb) cb();
  } catch {
    setStatus("네트워크 오류로 로그인에 실패했습니다.");
  } finally {
    if (confirmBtn) confirmBtn.disabled = false;
  }
}

export function bindAuthUi({ onProfileChange } = {}) {
  document.getElementById("btn-intro-login")?.addEventListener("click", () => {
    openLoginModal();
  });
  document.getElementById("login-confirm")?.addEventListener("click", () => {
    void submitLogin();
  });
  document.getElementById("login-cancel")?.addEventListener("click", () => {
    closeLoginModal();
  });
  document.querySelector("[data-login-cancel]")?.addEventListener("click", () => {
    closeLoginModal();
  });
  document.getElementById("login-pin")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void submitLogin();
    }
  });

  updateIntroAuthLabel();
  onProfileChange?.(getProfile());
}
