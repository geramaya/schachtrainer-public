import type { Variante } from './types.ts'

export type Modus = 'vorfuehren' | 'gefuehrt' | 'kopf'
export type Seite = 'white' | 'black'

/** Ply (0-based index into the line) played by the learner: white on even plies, black on odd ones. */
export const isOwnPly = (side: Seite, ply: number): boolean => (side === 'white') === (ply % 2 === 0)

/** First own ply at or after `from`, or null when the line ends before. */
export function nextOwnPly(side: Seite, v: Variante, from: number): number | null {
  for (let i = from; i < v.zuege.length; i++) if (isOwnPly(side, i)) return i
  return null
}

export type MoveCheck = { ok: true } | { ok: false; erwartet: { san: string; uci: string } }

export function checkMove(v: Variante, ply: number, uci: string): MoveCheck {
  const z = v.zuege[ply]!
  return uci === z.uci ? { ok: true } : { ok: false, erwartet: { san: z.san, uci: z.uci } }
}
