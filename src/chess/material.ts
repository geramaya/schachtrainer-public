import type { Side } from '../content/types.ts'

export type TakenPiece = 'p' | 'n' | 'b' | 'r' | 'q'
const POINTS: Record<TakenPiece, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 }
const START_COUNT: Record<TakenPiece, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 }
const ORDER: readonly TakenPiece[] = ['q', 'r', 'b', 'n', 'p']

export interface Material {
  /** points of White minus points of Black from the pieces on the board (pawn 1, knight/bishop 3, rook 5, queen 9) */
  diff: number
  /** pieces of the other colour each side has taken (start count minus what is left; promotions never give a negative count) */
  takenByWhite: TakenPiece[]
  takenByBlack: TakenPiece[]
}

/** Material balance of a position, like the player bars at Lichess. */
export function materialOf(fen: string): Material {
  const count: Record<Side, Record<TakenPiece, number>> = { white: { p: 0, n: 0, b: 0, r: 0, q: 0 }, black: { p: 0, n: 0, b: 0, r: 0, q: 0 } }
  for (const ch of fen.split(' ')[0]!) {
    const t = ch.toLowerCase() as TakenPiece
    if (t in POINTS) count[ch === t ? 'black' : 'white'][t]++
  }
  const points = (s: Side) => ORDER.reduce((a, t) => a + count[s][t] * POINTS[t], 0)
  const missing = (s: Side): TakenPiece[] => ORDER.flatMap((t) => Array<TakenPiece>(Math.max(0, START_COUNT[t] - count[s][t])).fill(t))
  return { diff: points('white') - points('black'), takenByWhite: missing('black'), takenByBlack: missing('white') }
}
