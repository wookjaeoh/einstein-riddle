import { generatePuzzle } from "../js/generate.js";
import { answerSatisfiesClues, isUniqueSolution } from "../js/solver.js";

for (const difficulty of ["easy", "hard"]) {
  const rows = [];
  for (let run = 1; run <= 10; run++) {
    const started = Date.now();
    const puzzle = generatePuzzle(difficulty);
    const elapsedMs = Date.now() - started;
    const row = {
      run,
      elapsedMs,
      clueCount: puzzle.clues.length,
      fallback: puzzle.meta.usedFallback,
      unique: isUniqueSolution(puzzle.clues),
      answerSatisfies: answerSatisfiesClues(puzzle.answer, puzzle.clues),
    };
    rows.push(row);
    console.log(
      `${difficulty} ${run}: ${elapsedMs}ms, clues=${row.clueCount}, ` +
      `fallback=${row.fallback}, unique=${row.unique}, satisfies=${row.answerSatisfies}`,
    );
  }

  const times = rows.map(({ elapsedMs }) => elapsedMs);
  console.log(
    `${difficulty} summary: avg=${(times.reduce((sum, ms) => sum + ms, 0) / times.length).toFixed(1)}ms, ` +
    `max=${Math.max(...times)}ms, fallbacks=${rows.filter(({ fallback }) => fallback).length}, ` +
    `clues=${rows.map(({ clueCount }) => clueCount).join(",")}`,
  );

  if (rows.some(({ elapsedMs, unique, answerSatisfies }) => elapsedMs >= 2100 || !unique || !answerSatisfies)) {
    process.exitCode = 1;
  }
}
