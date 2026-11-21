import { Chess } from 'chess.js'
import type { Square } from 'chess.js'

export type PromotionPiece = 'q' | 'r' | 'b' | 'n'

/** Legal moves in chessground `dests` format (origin square -> target squares). */
export function legalDests(fen: string): Map<string, string[]> {
  const dests = new Map<string, string[]>()
  for (const m of new Chess(fen).moves({ verbose: true })) {
    const list = dests.get(m.from)
    if (list) list.push(m.to)
    else dests.set(m.from, [m.to])
  }
  return dests
}

export function toUci(from: string, to: string, promotion?: PromotionPiece): string {
  return from + to + (promotion ?? '')
}

/** True if from->to is a pawn move to the last rank, i.e. a piece choice is needed. */
export function needsPromotion(fen: string, from: string, to: string): boolean {
  return new Chess(fen)
    .moves({ square: from as Square, verbose: true })
    .some((m) => m.to === to && m.promotion !== undefined)
}

/** Plays a UCI move; null if illegal or malformed. san is English SAN (use toGermanSan for display). */
export function applyUci(fen: string, uci: string): { fen: string; san: string } | null {
  try {
    const chess = new Chess(fen)
    const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
    return { fen: chess.fen(), san: m.san }
  } catch {
    return null
  }
}

/** True if the side to move is in check. */
export function isCheck(fen: string): boolean {
  return new Chess(fen).inCheck()
}
