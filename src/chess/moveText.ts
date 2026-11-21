import { toGermanSan } from './notation.ts'

export interface MoveCell { san: string; index: number }
export interface MoveRow { number: number; white?: MoveCell; black?: MoveCell }

/**
 * A line as table rows (number | white | black), German SAN. `index` = number of plies played after the move
 * (the `current` value of the move list); `startPly` is the 0-based ply of the first move (odd = black first, row without white).
 */
export function moveRows(sans: string[], startPly = 0): MoveRow[] {
  const out: MoveRow[] = []
  sans.forEach((san, i) => {
    const ply = startPly + i
    const number = Math.floor(ply / 2) + 1
    const cell = { san: toGermanSan(san), index: i + 1 }
    const last = out[out.length - 1]
    if (ply % 2 === 0) out.push({ number, white: cell })
    else if (last && last.number === number && !last.black) last.black = cell
    else out.push({ number, black: cell })
  })
  return out
}
