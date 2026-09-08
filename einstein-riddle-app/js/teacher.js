import { CATEGORIES, HOUSES, LABELS, labelOf } from "./puzzle-data.js";

export const TEACHER_PASSWORD = "teacher2026";

export function bindTeacherPanel({ getPlacement, getAnswer }) {
  const panel = document.getElementById("teacher-panel");
  const btn = document.getElementById("btn-teacher");
  const unlock = document.getElementById("btn-teacher-unlock");
  const pw = document.getElementById("teacher-pw");
  const err = document.getElementById("teacher-error");
  const body = document.getElementById("teacher-body");
  const login = document.getElementById("teacher-login");
  let unlocked = false;

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
    unlocked = true;
    renderAnswer();
  });

  function renderAnswer() {
    const answer = getAnswer();
    if (!answer) return;

    const answerBoard = document.getElementById("answer-board");
    let html = "<h3>정답</h3><table border='1' cellpadding='4'><tr><th></th>";
    HOUSES.forEach((h) => {
      html += `<th>${h}번</th>`;
    });
    html += "</tr>";
    CATEGORIES.forEach((cat) => {
      html += `<tr><th>${LABELS[cat]}</th>`;
      answer[cat].forEach((v) => {
        html += `<td>${labelOf(v)}</td>`;
      });
      html += "</tr>";
    });
    html += "</table>";

    const placement = getPlacement();
    let wrong = 0;
    CATEGORIES.forEach((cat) => {
      for (let i = 0; i < 5; i++) {
        if (placement[cat][i] !== answer[cat][i]) wrong++;
      }
    });
    html += `<p>현재 화면 기준 틀린 칸(비교): ${wrong}</p>`;
    answerBoard.innerHTML = html;
  }

  return {
    refresh() {
      if (unlocked) renderAnswer();
    },
  };
}
