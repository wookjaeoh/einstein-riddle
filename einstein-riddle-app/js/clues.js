export function renderClues({ container, clues, readIds = new Set(), onToggleRead }) {
  container.innerHTML = "<h2>단서</h2>";
  clues.forEach((clue, i) => {
    const read = readIds.has(clue.id);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "clue-item" + (read ? " read" : "");
    btn.dataset.read = read ? "true" : "false";
    btn.setAttribute("aria-pressed", read ? "true" : "false");
    btn.textContent = `${read ? "✓ " : ""}${i + 1}. ${clue.text}`;
    btn.addEventListener("click", () => onToggleRead?.(clue.id));
    container.appendChild(btn);
  });
}
