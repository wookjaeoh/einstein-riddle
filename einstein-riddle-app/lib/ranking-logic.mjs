export const MAX_ENTRIES = 50;

export function normalizeField(s) {
  return String(s ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

export function identityKey({ name, role, school, difficulty }) {
  return [
    normalizeField(name),
    String(role ?? ""),
    normalizeField(school ?? ""),
    String(difficulty ?? ""),
  ].join("|");
}

export function upsertBestEntry(entries, incoming) {
  const list = Array.isArray(entries) ? entries.map((e) => ({ ...e })) : [];
  const key = identityKey(incoming);
  const idx = list.findIndex((e) => identityKey(e) === key);
  if (idx >= 0) {
    if (incoming.timeMs >= list[idx].timeMs) {
      list.sort((a, b) => a.timeMs - b.timeMs);
      return {
        status: "not_improved",
        entries: list.slice(0, MAX_ENTRIES),
        message: "이미 더 좋은 기록이 있습니다",
      };
    }
    list[idx] = { ...incoming };
  } else {
    list.push({ ...incoming });
  }
  list.sort((a, b) => a.timeMs - b.timeMs);
  return { status: "saved", entries: list.slice(0, MAX_ENTRIES) };
}
