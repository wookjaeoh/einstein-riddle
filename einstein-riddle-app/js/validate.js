import { CATEGORIES } from "./puzzle-data.js";

export function isComplete(placement) {
  for (const cat of CATEGORIES) {
    const row = placement[cat];
    if (!row || row.length !== 5) return false;
    for (const v of row) {
      if (v == null || v === "") return false;
    }
  }
  return true;
}

export function countWrong(placement, answer) {
  let n = 0;
  for (const cat of CATEGORIES) {
    for (let i = 0; i < 5; i++) {
      if (placement[cat][i] !== answer[cat][i]) n++;
    }
  }
  return n;
}

export function grade(placement, answer) {
  const complete = isComplete(placement);
  if (!complete) {
    return { complete: false, wrongCount: null, solved: false };
  }
  const wrongCount = countWrong(placement, answer);
  return { complete: true, wrongCount, solved: wrongCount === 0 };
}
