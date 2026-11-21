import { Chess } from 'chess.js'
import { positionKey } from '../src/chess/position.ts'

/** Position after the given SAN moves from the start position. */
export function play(sans: string[]): Chess {
  const g = new Chess()
  for (const s of sans) g.move(s)
  return g
}

export const words = (line: string): string[] => line.split(' ').filter(Boolean)

export const keyAfter = (sans: string[]): string => positionKey(play(sans).fen())

const toUci = (m: { from: string; to: string; promotion?: string }): string => m.from + m.to + (m.promotion ?? '')

/** UCI of `san` played in the position after `sans` (by the side to move there). */
export function uciOf(sans: string[], san: string): string {
  return toUci(play(sans).move(san))
}

/** UCI of `san` for the side NOT to move in the position after `sans` (null-move position, no en passant). */
export function uciOfOther(sans: string[], san: string): string {
  const f = play(sans).fen().split(' ')
  f[1] = f[1] === 'w' ? 'b' : 'w'
  f[3] = '-'
  return toUci(new Chess(f.join(' ')).move(san))
}
