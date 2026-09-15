export function createDragDrop({
  boardEl,
  poolEl,
  onDrop,
  rootEl,
  targetDocument = document,
  targetWindow = window,
  isLocked = () => false,
}) {
  let dragging = null; // { value, category, el, pointerId }
  let ghost = null;

  function clearTargets() {
    targetDocument.querySelectorAll(".drop-target").forEach((el) => el.classList.remove("drop-target"));
  }

  function placeGhost(x, y) {
    if (!ghost) return;
    ghost.style.transform = `translate(${x - 40}px, ${y - 20}px)`;
  }

  function cleanupDrag({ commitDrop = false, event = null } = {}) {
    if (!dragging) return;
    const { value, category, el, pointerId } = dragging;
    dragging = null;
    clearTargets();
    el.removeEventListener("lostpointercapture", onLostPointerCapture);
    if (pointerId != null) {
      try {
        el.releasePointerCapture?.(pointerId);
      } catch {
        // capture may already be released
      }
    }
    ghost?.remove();
    ghost = null;
    el.classList.remove("dragging");

    if (!commitDrop || !event) return;

    const dropTarget = targetDocument.elementFromPoint(event.clientX, event.clientY);
    const slot = dropTarget?.closest?.(".slot");
    let to = null;
    if (slot && slot.dataset.category === category) {
      to = {
        type: "slot",
        houseIndex: Number(slot.dataset.houseIndex),
        category,
      };
    } else if (dropTarget?.closest?.("#pool")) {
      to = { type: "pool" };
    }
    if (!to) return;
    onDrop({ value, category, to });
  }

  function onLostPointerCapture(e) {
    if (!dragging || e.pointerId !== dragging.pointerId) return;
    cleanupDrag({ commitDrop: false });
  }

  function onPointerDown(e) {
    if (isLocked()) return;
    const card = e.target.closest(".card");
    if (!card || !card.dataset.value) return;
    e.preventDefault();
    dragging = {
      value: card.dataset.value,
      category: card.dataset.category,
      el: card,
      pointerId: e.pointerId,
    };
    card.classList.add("dragging");
    ghost = card.cloneNode(true);
    ghost.style.position = "fixed";
    ghost.style.pointerEvents = "none";
    ghost.style.zIndex = "9999";
    ghost.style.left = "0";
    ghost.style.top = "0";
    targetDocument.body.appendChild(ghost);
    placeGhost(e.clientX, e.clientY);
    card.addEventListener("lostpointercapture", onLostPointerCapture);
    card.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    if (!dragging) return;
    placeGhost(e.clientX, e.clientY);
    clearTargets();
    const el = targetDocument.elementFromPoint(e.clientX, e.clientY);
    const slot = el?.closest?.(".slot");
    if (slot && slot.dataset.category === dragging.category) {
      slot.classList.add("drop-target");
    } else if (el?.closest?.("#pool")) {
      poolEl.classList.add("drop-target");
    }
  }

  function onPointerUp(e) {
    if (!dragging || e.pointerId !== dragging.pointerId) return;
    cleanupDrag({ commitDrop: true, event: e });
  }

  function onPointerCancel(e) {
    if (!dragging || e.pointerId !== dragging.pointerId) return;
    cleanupDrag({ commitDrop: false });
  }

  function bind() {
    rootEl.addEventListener("pointerdown", onPointerDown);
    targetWindow.addEventListener("pointermove", onPointerMove);
    targetWindow.addEventListener("pointerup", onPointerUp);
    targetWindow.addEventListener("pointercancel", onPointerCancel);
  }

  return {
    bind,
    handlePointerDown: onPointerDown,
    handlePointerMove: onPointerMove,
    handlePointerUp: onPointerUp,
    handlePointerCancel: onPointerCancel,
    isDragging: () => dragging !== null,
    hasGhost: () => ghost !== null,
  };
}

export function bindDragDrop({ boardEl, poolEl, onDrop, isLocked }) {
  const controller = createDragDrop({
    boardEl,
    poolEl,
    onDrop,
    isLocked,
    rootEl: document.getElementById("app"),
  });
  controller.bind();
}
