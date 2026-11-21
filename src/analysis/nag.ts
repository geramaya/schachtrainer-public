import { Chess } from 'chess.js'
import type { Side } from '../content/types.ts'
import { MATE_CP } from '../coach/texts.ts'

/**
 * PGN NAGs, position signs and the material proof used by the move categories (category.ts).
 * Position signs (centipawns, white view, a mate counts +-10000): = below 30, ⩲/⩱ 30..89, ±/∓ 90..200, +−/−+ above 200 cp or mate.
 */
export type Nag = '!!' | '!' | '!?' | '?!' | '?' | '??'
export type Sign = '=' | '⩲' | '⩱' | '±' | '∓' | '+−' | '−+'

export const NAG_CODE: Record<Nag, number> = { '!': 1, '?': 2, '!!': 3, '??': 4, '!?': 5, '?!': 6 }
export const SIGN_CODE: Record<Sign, number> = { '=': 10, '⩲': 14, '⩱': 15, '±': 16, '∓': 17, '+−': 18, '−+': 19 }
export const nagFromCode = (n: number): Nag | null => (Object.entries(NAG_CODE).find(([, c]) => c === n)?.[0] as Nag | undefined) ?? null
export const signFromCode = (n: number): Sign | null => (Object.entries(SIGN_CODE).find(([, c]) => c === n)?.[0] as Sign | undefined) ?? null

/** Evaluation of a position from the white point of view; `mate` = signed distance (white), null without mate. */
export interface Ev { cp: number; mate: number | null }

export function positionSign(e: Ev): Sign {
  const cp = e.mate !== null ? Math.sign(e.mate) * MATE_CP : e.cp
  const a = Math.abs(cp)
  if (a < 30) return '='
  if (a < 90) return cp > 0 ? '⩲' : '⩱'
  if (a <= 200) return cp > 0 ? '±' : '∓'
  return cp > 0 ? '+−' : '−+'
}

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
const material = (c: Chess, side: Side): number => {
  let sum = 0
  for (const p of c.board().flat()) if (p) sum += (p.color === (side === 'white' ? 'w' : 'b') ? 1 : -1) * VALUE[p.type]!
  return sum
}
const SACRIFICE_NET = -2
const MAX_PLIES = 8

/**
 * Material change of `mover` along the line (pv, first move = the played move): play it up to the first quiet position (at least two plies,
 * the last move neither a capture nor a check) and compare the balance (pawn units) with the start. `plies` = how far the line was played.
 * null if the line ends before it settles.
 */
export function settleMaterial(fenBefore: string, pv: string[], mover: Side): { delta: number; plies: number } | null {
  const c = new Chess(fenBefore)
  const start = material(c, mover)
  for (let k = 0; k < Math.min(pv.length, MAX_PLIES); k++) {
    const u = pv[k]!
    let m
    try { m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }) } catch { return null }
    if (k >= 1 && !m.isCapture() && !c.inCheck()) return { delta: material(c, mover) - start, plies: k + 1 }
  }
  return null
}

export const materialAfterQuiet = (fenBefore: string, pv: string[], mover: Side): number | null => settleMaterial(fenBefore, pv, mover)?.delta ?? null

/** A net loss of >= 2 pawn units after the quiet position counts as a sacrifice proven by the line. */
export function sacrificesMaterial(fenBefore: string, pv: string[], mover: Side): boolean {
  const d = materialAfterQuiet(fenBefore, pv, mover)
  return d !== null && d <= SACRIFICE_NET
}

/** True if `uci` captures on the square where the move `prevUci` (played from `fenBeforePrev`) just captured: a recapture, usually forced. */
export function isRecapture(fenBeforePrev: string, prevUci: string, uci: string): boolean {
  try {
    const c = new Chess(fenBeforePrev)
    const prev = c.move({ from: prevUci.slice(0, 2), to: prevUci.slice(2, 4), promotion: prevUci[4] })
    if (!prev.isCapture()) return false
    const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
    return m.isCapture() && m.to === prev.to
  } catch {
    return false
  }
}
