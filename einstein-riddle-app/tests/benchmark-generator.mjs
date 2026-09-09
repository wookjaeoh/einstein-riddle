import { generatePuzzle } from "../js/generate.js";
import { answerSatisfiesClues, isUniqueSolution } from "../js/solver.js";

function puzzleSolverOptions(puzzle) {
  return {
    houseCount: puzzle.houseCount,
    categories: puzzle.categories,
    values: puzzle.values,
  };
}

for (const difficulty of ["easy", "normal", "hard", "expert"]) {
  const rows = [];
  for (let run = 1; run <= 10; run++) {
    const started = Date.now();
    const puzzle = generatePuzzle(difficulty);
    const elapsedMs = Date.now() - started;
    const solverOpts = puzzleSolverOptions(puzzle);
    const row = {
      run,
      elapsedMs,
      clueCount: puzzle.clues.length,
      fallback: puzzle.meta.usedFallback,
      unique: isUniqueSolution(puzzle.clues, solverOpts),
      answerSatisfies: answerSatisfiesClues(puzzle.answer, puzzle.clues, solverOpts),
      houseCount: puzzle.houseCount,
      hintStages: puzzle.hints?.map((hint) => hint.stage).join(","),
    };
    rows.push(row);
    console.log(
      `${difficulty} ${run}: ${elapsedMs}ms, houses=${row.houseCount}, clues=${row.clueCount}, ` +
        `fallback=${row.fallback}, unique=${row.unique}, satisfies=${row.answerSatisfies}, hints=${row.hintStages}`,
    );
  }

  const times = rows.map(({ elapsedMs }) => elapsedMs);
  const nonFallback = rows.filter(({ fallback }) => !fallback);
  console.log(
    `${difficulty} summary: avg=${(times.reduce((sum, ms) => sum + ms, 0) / times.length).toFixed(1)}ms, ` +
      `max=${Math.max(...times)}ms, fallbacks=${rows.filter(({ fallback }) => fallback).length}, ` +
      `clues=${rows.map(({ clueCount }) => clueCount).join(",")}`,
  );
  if (difficulty === "hard" && nonFallback.length) {
    console.log(`hard non-fallback clue counts: ${nonFallback.map(({ clueCount }) => clueCount).join(",")}`);
  }
  if (difficulty === "expert" && nonFallback.length) {
    console.log(`expert non-fallback clue counts: ${nonFallback.map(({ clueCount }) => clueCount).join(",")}`);
  }

  if (
    rows.some(
      ({ elapsedMs, unique, answerSatisfies, fallback }) =>
        (!fallback && elapsedMs >= 2100) || !unique || !answerSatisfies,
    )
  ) {
    process.exitCode = 1;
  }
}
