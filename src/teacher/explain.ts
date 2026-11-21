import type { Rating } from './judge.ts'

/** When the better move is explained without asking: after Fehler and Patzer (default), only after a Patzer, or only on the button "Warum? Besseren Zug zeigen". Always counts as a help. */
export type ExplainMode = 'both' | 'blunder' | 'button'
export const EXPLAIN_MODES: { id: ExplainMode; label: string }[] = [{ id: 'both', label: 'Fehler + Patzer' }, { id: 'blunder', label: 'nur Patzer' }, { id: 'button', label: 'auf Knopfdruck' }]
export const DEFAULT_EXPLAIN: ExplainMode = 'both'

export const parseExplain = (v: unknown): ExplainMode | undefined => (EXPLAIN_MODES.some((m) => m.id === v) ? (v as ExplainMode) : undefined)

export function autoExplain(rating: Rating, mode: ExplainMode): boolean {
  if (mode === 'button') return false
  return rating === 'patzer' || (mode === 'both' && rating === 'fehler')
}
