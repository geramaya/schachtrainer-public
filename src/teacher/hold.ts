import type { Rating } from './judge.ts'

/** When the game stops after a move: at Fehler and Patzer, only at Patzer (default) or never. */
export type HoldMode = 'both' | 'blunder' | 'never'
export const HOLD_MODES: { id: HoldMode; label: string }[] = [{ id: 'both', label: 'Fehler + Patzer' }, { id: 'blunder', label: 'nur Patzer' }, { id: 'never', label: 'nie' }]
export const DEFAULT_HOLD: HoldMode = 'blunder'

export const parseHold = (v: unknown): HoldMode | undefined => (HOLD_MODES.some((m) => m.id === v) ? (v as HoldMode) : undefined)

export function holds(rating: Rating, mode: HoldMode): boolean {
  if (mode === 'never') return false
  return rating === 'patzer' || (mode === 'both' && rating === 'fehler')
}
