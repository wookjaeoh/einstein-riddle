import { normalizeField } from "./ranking-logic.mjs";

const ROLES = new Set(["student", "teacher", "general"]);
const DIFFS = new Set(["easy", "normal", "hard", "expert"]);

export function isValidDifficulty(difficulty) {
  return DIFFS.has(String(difficulty ?? ""));
}

export function normalizeRankingPost(body) {
  const name = normalizeField(body?.name);
  const role = String(body?.role ?? "");
  const difficulty = String(body?.difficulty ?? "");
  const timeMs = Number(body?.timeMs);
  let school = normalizeField(body?.school ?? "");

  if (!name) return { error: "name_required" };
  if (!ROLES.has(role)) return { error: "role_invalid" };
  if (!DIFFS.has(difficulty)) return { error: "difficulty_invalid" };
  if (!Number.isFinite(timeMs) || timeMs <= 0 || !Number.isInteger(timeMs)) {
    return { error: "time_invalid" };
  }
  if (role === "general") school = "";
  else if (!school) return { error: "school_required" };

  return {
    value: {
      name,
      role,
      school,
      difficulty,
      timeMs,
      pin: body?.pin,
    },
  };
}
