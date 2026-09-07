export function renderClues({ container, clues, selectedId, onSelect }) {
  container.innerHTML = "<h2>단서</h2>";
  clues.forEach((clue, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "clue-item" + (clue.id === selectedId ? " active" : "");
    btn.textContent = `${i + 1}. ${clue.text}`;
    btn.addEventListener("click", () => onSelect(clue.id === selectedId ? null : clue.id));
    container.appendChild(btn);
  });
}

export function applyHighlight(clueId, clues) {
  document.querySelectorAll(".highlight").forEach((el) => el.classList.remove("highlight"));
  if (!clueId) return;
  const clue = clues.find((c) => c.id === clueId);
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
      document.querySelectorAll(`#pool .card[data-category="${cat}"]`).forEach((card) => {
        if (clue.values.includes(card.dataset.value)) card.classList.add("highlight");
      });
    });
  }
}
