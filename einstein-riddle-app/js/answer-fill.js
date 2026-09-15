export function shouldContinueReveal(session, currentGeneration) {
  return session === currentGeneration;
}

export function buildAnswerFillQueue(placement, answer, categories) {
  const queue = [];
  for (const category of categories) {
    const row = answer[category] ?? [];
    for (let houseIndex = 0; houseIndex < row.length; houseIndex++) {
      if (placement[category]?.[houseIndex] === row[houseIndex]) continue;
      queue.push({ category, houseIndex, value: row[houseIndex] });
    }
  }
  return queue;
}
