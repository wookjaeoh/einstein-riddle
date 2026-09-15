export function isComplete(placement, categories = Object.keys(placement)) {
  for (const cat of categories) {
    const row = placement[cat];
    if (!row || !row.length) return false;
    for (const v of row) {
      if (v == null || v === "") return false;
    }
  }
  return true;
}

export function countWrong(placement, answer, categories = Object.keys(answer)) {
  let n = 0;
  for (const cat of categories) {
    const len = answer[cat]?.length ?? 0;
    for (let i = 0; i < len; i++) {
      if (placement[cat]?.[i] !== answer[cat][i]) n++;
    }
  }
  return n;
}

export function grade(placement, answer, categories = Object.keys(answer)) {
  const complete = isComplete(placement, categories);
  if (!complete) {
    return { complete: false, wrongCount: null, solved: false };
  }
  const wrongCount = countWrong(placement, answer, categories);
  return { complete: true, wrongCount, solved: wrongCount === 0 };
}
