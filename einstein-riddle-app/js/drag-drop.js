export function bindDragDrop({ boardEl, poolEl, onDrop }) {
  let dragging = null; // { value, category, el }
  let ghost = null;

  function clearTargets() {
    document.querySelectorAll(".drop-target").forEach((el) => el.classList.remove("drop-target"));
  }

  function placeGhost(x, y) {
    if (!ghost) return;
    ghost.style.transform = `translate(${x - 40}px, ${y - 20}px)`;
  }

  function onPointerDown(e) {
    const card = e.target.closest(".card");
    if (!card || !card.dataset.value) return;
    e.preventDefault();
    dragging = {
      value: card.dataset.value,
      category: card.dataset.category,
      el: card,
    };
    card.classList.add("dragging");
    ghost = card.cloneNode(true);
    ghost.style.position = "fixed";
    ghost.style.pointerEvents = "none";
    ghost.style.zIndex = "9999";
    ghost.style.left = "0";
    ghost.style.top = "0";
    document.body.appendChild(ghost);
    placeGhost(e.clientX, e.clientY);
    card.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    if (!dragging) return;
    placeGhost(e.clientX, e.clientY);
    clearTargets();
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const slot = el?.closest?.(".slot");
    if (slot && slot.dataset.category === dragging.category) {
      slot.classList.add("drop-target");
    } else if (el?.closest?.("#pool")) {
      poolEl.classList.add("drop-target");
    }
  }

  function onPointerUp(e) {
    if (!dragging) return;
    const { value, category, el } = dragging;
    clearTargets();
    ghost?.remove();
    ghost = null;
    el.classList.remove("dragging");

    const target = document.elementFromPoint(e.clientX, e.clientY);
    const slot = target?.closest?.(".slot");
    let to = null;
    if (slot && slot.dataset.category === category) {
      to = {
        type: "slot",
        houseIndex: Number(slot.dataset.houseIndex),
        category,
      };
    } else if (target?.closest?.("#pool")) {
      to = { type: "pool" };
    }

    dragging = null;
    if (!to) return; // snap back via re-render
    onDrop({ value, category, to });
  }

  const root = document.getElementById("app");
  root.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
}
