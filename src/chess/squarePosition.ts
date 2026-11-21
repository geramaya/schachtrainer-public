import type { Side } from '../content/types.ts'

/** Top-left corner of a square as percentages of the board edge, for overlays on the chessground board. */
export function squarePercent(square: string, orientation: Side): { left: number; top: number } {
  const file = square.charCodeAt(0) - 97
  const rank = Number(square[1]) - 1
  const white = orientation === 'white'
  return { left: (white ? file : 7 - file) * 12.5, top: (white ? 7 - rank : rank) * 12.5 }
}
