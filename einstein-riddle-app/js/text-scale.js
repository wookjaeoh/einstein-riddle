const STORAGE_KEY = "einstein-text-scale";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseStored(raw, fallback) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

export function createTextScale({
  storage = globalThis.localStorage,
  initial = 150,
  min = 100,
  max = 200,
  step = 10,
} = {}) {
  let value = initial;
  if (storage) {
    try {
      const stored = storage.getItem(STORAGE_KEY);
      if (stored != null) value = parseStored(stored, initial);
    } catch {
      value = initial;
    }
  }
  value = clamp(Math.round(value / step) * step, min, max);

  function persist() {
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, String(value));
    } catch {
      // ignore quota / private mode
    }
  }

  return {
    get() {
      return value;
    },
    canIncrease() {
      return value < max;
    },
    canDecrease() {
      return value > min;
    },
    increase() {
      if (value >= max) return value;
      value = clamp(value + step, min, max);
      persist();
      return value;
    },
    decrease() {
      if (value <= min) return value;
      value = clamp(value - step, min, max);
      persist();
      return value;
    },
    apply(root) {
      if (!root?.style?.setProperty) return;
      root.style.setProperty("--text-scale", String(value / 100));
    },
  };
}
