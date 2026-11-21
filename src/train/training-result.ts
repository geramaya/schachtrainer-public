import { TASK_SECONDS } from './plan.ts'
import type { PlanTask } from './plan.ts'
import type { Pose } from './hero.ts'

/** Estimated seconds of the tasks from `index` on (the rest time of the progress bar). */
export const restSeconds = (tasks: PlanTask[], index: number): number => tasks.slice(index).reduce((n, t) => n + TASK_SECONDS[t.kind], 0)

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export interface TrainingStats { cards: number; puzzlesSolved: number; deviationsPunished: number }

/** Result line without the time (that is shown as its own figure); puzzles and deviations only appear if the plan offered them. */
export function trainingSummary(s: TrainingStats & { puzzlesOffered: number; deviationsOffered: number }): string {
  const parts = [`${s.cards} ${s.cards === 1 ? 'Karte' : 'Karten'}`]
  if (s.puzzlesOffered) parts.push(`${s.puzzlesSolved} Rätsel gelöst`)
  if (s.deviationsOffered) parts.push(`${s.deviationsPunished} ${s.deviationsPunished === 1 ? 'Abweichung' : 'Abweichungen'} bestraft`)
  return parts.join(', ')
}

/** Closing remark of Ferro: cheers when at least 80 percent of the cards were right at the first try (same rule as the drill run). */
export function trainingBubble(s: TrainingStats & { firstTry: number }): { text: string; pose: Pose } {
  const good = s.cards > 0 && s.firstTry / s.cards >= 0.8
  return good
    ? { text: 'Sauber gemacht. Davon will ich morgen mehr sehen.', pose: 'h3' }
    : { text: 'Ein paar Karten waren zäh. Die kommen bald wieder, keine Sorge.', pose: 'h1' }
}
