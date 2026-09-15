export function createDragDrop({
  boardEl,
  poolEl,
  onDrop,
  rootEl,
  targetDocument = document,
  targetWindow = window,
  isLocked = () => false,
}) {
  let holding = null; // { value, category, el }
  let ghost = null;
  let lastPointer = { x: 0, y: 0 };

  function clearTargets() {
    targetDocument.querySelectorAll(".drop-target").forEach((el) => el.classList.remove("drop-target"));
  }

  function placeGhost(x, y) {
    if (!ghost) return;
    ghost.style.transform = `translate(${x - 28}px, ${y - 16}px)`;
  }

  function setHoldingUi(on) {
    targetDocument.body?.classList?.toggle?.("holding-card", on);
  }

  function clearHolding() {
    if (!holding) return;
    clearTargets();
    holding.el.classList.remove("picked", "dragging");
    ghost?.remove();
    ghost = null;
    holding = null;
    setHoldingUi(false);
  }

  function pickCard(card, clientX, clientY) {
    holding = {
      value: card.dataset.value,
      category: card.dataset.category,
      el: card,
    };
    card.classList.add("picked", "dragging");
    ghost = card.cloneNode(true);
    ghost.classList.add("card-ghost");
    ghost.classList.remove("picked", "dragging");
    ghost.style.position = "fixed";
    ghost.style.pointerEvents = "none";
    ghost.style.zIndex = "9999";
    ghost.style.left = "0";
    ghost.style.top = "0";
    targetDocument.body.appendChild(ghost);
    lastPointer = { x: clientX, y: clientY };
    placeGhost(clientX, clientY);
    setHoldingUi(true);
  }

  function resolveDropTarget(clientX, clientY, eventTarget) {
    const fromPoint = targetDocument.elementFromPoint?.(clientX, clientY);
    const probe = fromPoint || eventTarget;
    const slot = probe?.closest?.(".slot");
    if (slot && slot.dataset.category === holding.category) {
      return {
        type: "slot",
        houseIndex: Number(slot.dataset.houseIndex),
        category: holding.category,
      };
    }
    if (probe?.closest?.("#pool") || probe === poolEl) {
      return { type: "pool" };
    }
    return null;
  }

  function updateDropHighlight(clientX, clientY) {
    clearTargets();
    if (!holding) return;
    const el = targetDocument.elementFromPoint?.(clientX, clientY);
    const slot = el?.closest?.(".slot");
    if (slot && slot.dataset.category === holding.category) {
      slot.classList.add("drop-target");
    } else if (el?.closest?.("#pool")) {
      poolEl.classList.add("drop-target");
    }
  }

  function onClick(e) {
    if (isLocked()) {
      if (holding) clearHolding();
      return;
    }

    if (!holding) {
      const card = e.target.closest?.(".card");
      if (!card || !card.dataset.value) return;
      e.preventDefault?.();
      pickCard(card, e.clientX ?? lastPointer.x, e.clientY ?? lastPointer.y);
      return;
    }

    e.preventDefault?.();
    const to = resolveDropTarget(e.clientX ?? lastPointer.x, e.clientY ?? lastPointer.y, e.target);
    const { value, category } = holding;
    if (to) {
      clearHolding();
      onDrop({ value, category, to });
      return;
    }

    const otherCard = e.target.closest?.(".card");
    if (otherCard && otherCard !== holding.el && otherCard.dataset.value) {
      clearHolding();
      pickCard(otherCard, e.clientX ?? lastPointer.x, e.clientY ?? lastPointer.y);
      return;
    }

    clearHolding();
  }

  function onPointerMove(e) {
    lastPointer = { x: e.clientX, y: e.clientY };
    if (!holding) return;
    placeGhost(e.clientX, e.clientY);
    updateDropHighlight(e.clientX, e.clientY);
  }

  function onKeyDown(e) {
    if (e.key === "Escape" && holding) {
      clearHolding();
    }
  }

  function bind() {
    rootEl.addEventListener("click", onClick);
    targetWindow.addEventListener("pointermove", onPointerMove);
    targetWindow.addEventListener("keydown", onKeyDown);
  }

  return {
    bind,
    handleClick: onClick,
    handlePointerMove: onPointerMove,
    handleKeyDown: onKeyDown,
    /** @deprecated alias — holding state */
    isDragging: () => holding !== null,
    isHolding: () => holding !== null,
    hasGhost: () => ghost !== null,
    clearHolding,
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
  return controller;
}
