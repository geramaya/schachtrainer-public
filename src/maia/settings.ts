import { LEVEL_MAX, LEVEL_MIN } from './encode.ts'

/** Settings of the opponent in free games (stored in the progress settings, so they are part of backup and import). */
export interface OpponentSettings {
  opponent: 'stockfish' | 'maia'
  /** Maia level, 1100-1900 in steps of 100 */
  maiaElo: number
  /** Maia always plays its most probable move instead of sampling */
  maiaGreedy: boolean
}
export const MAIA_STEP = 100
export const DEFAULT_MAIA_ELO = 1500

export function parseOpponent(v: unknown): Partial<OpponentSettings> {
  if (typeof v !== 'object' || v === null) return {}
  const r = v as Record<string, unknown>
  const out: Partial<OpponentSettings> = {}
  if (r.opponent === 'stockfish' || r.opponent === 'maia') out.opponent = r.opponent
  if (typeof r.maiaElo === 'number' && Number.isFinite(r.maiaElo)) out.maiaElo = Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, Math.round(r.maiaElo / MAIA_STEP) * MAIA_STEP))
  if (typeof r.maiaGreedy === 'boolean') out.maiaGreedy = r.maiaGreedy
  return out
}
