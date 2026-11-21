export interface Run {
  cells: ('ok' | 'miss' | 'help')[]; streak: number; best: number
  /** Help used in this run: hints and solutions shown (once per card), position keys skipped (once per card) and still waiting for the catch-up round. */
  hints: number; solutions: number; skipped: string[]; queue: string[]
}

export const newRun = (): Run => ({ cells: [], streak: 0, best: 0, hints: 0, solutions: 0, skipped: [], queue: [] })

/** One answered card: `firstTry` = right on the first attempt. A miss resets the streak without penalty elsewhere. */
export function answerCard(r: Run, firstTry: boolean): Run {
  const streak = firstTry ? r.streak + 1 : 0
  return { ...r, cells: [...r.cells, firstTry ? 'ok' : 'miss'], streak, best: Math.max(r.best, streak) }
}

/** A card answered correctly, but with a hint: not first try, the streak ends. */
export const answerHelped = (r: Run): Run => ({ ...r, cells: [...r.cells, 'help'], streak: 0 })

export const noteHint = (r: Run): Run => ({ ...r, hints: r.hints + 1 })
export const noteSolution = (r: Run): Run => ({ ...r, solutions: r.solutions + 1 })

/** Skipping is allowed once per card (position key) and run. */
export const canSkip = (r: Run, key: string): boolean => !r.skipped.includes(key)
export const skipCard = (r: Run, key: string): Run => ({ ...r, skipped: [...r.skipped, key], queue: [...r.queue, key] })
/** Next skipped card for the catch-up round at the end of the run; null = none left. */
export const nextSkipped = (r: Run): { run: Run; key: string | null } => ({ run: { ...r, queue: r.queue.slice(1) }, key: r.queue[0] ?? null })

export function runResult(r: Run): { total: number; firstTry: number; retry: number; passed: boolean; hints: number; solutions: number; skipped: number } {
  const total = r.cells.length
  const firstTry = r.cells.filter((c) => c === 'ok').length
  return { total, firstTry, retry: total - firstTry, passed: total > 0 && firstTry / total >= 0.8, hints: r.hints, solutions: r.solutions, skipped: r.skipped.length }
}
