import { Chess } from 'chess.js'
import type { Side } from '../content/types.ts'

export type GameStatus =
  | { over: false }
  | { over: true; reason: 'matt' | 'patt' | 'wiederholung' | '50-zuege' | 'material'; winner: Side | null }

/** Replays the UCI moves from `startFen` (so repetitions are counted) and reports whether the game is over. */
export function gameStatus(startFen: string, ucis: string[]): GameStatus {
  const chess = new Chess(startFen)
  for (const u of ucis) chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] })
  if (chess.isCheckmate()) return { over: true, reason: 'matt', winner: chess.turn() === 'w' ? 'black' : 'white' }
  if (chess.isStalemate()) return { over: true, reason: 'patt', winner: null }
  if (chess.isInsufficientMaterial()) return { over: true, reason: 'material', winner: null }
  if (chess.isThreefoldRepetition()) return { over: true, reason: 'wiederholung', winner: null }
  if (chess.isDrawByFiftyMoves()) return { over: true, reason: '50-zuege', winner: null }
  return { over: false }
}

export function isValidFen(fen: string): boolean {
  try { new Chess(fen); return true } catch { return false }
}

const REASON = { matt: 'Schachmatt', patt: 'Patt', wiederholung: 'dreifache Stellungswiederholung', '50-zuege': '50-Züge-Regel', material: 'zu wenig Material' }

/** Result line for a finished game, from the point of view of the human player. */
export function describeResult(s: Extract<GameStatus, { over: true }>, userSide: Side): string {
  if (s.winner === null) return `Remis (${REASON[s.reason]})`
  return `${s.winner === userSide ? 'Du hast gewonnen' : 'Die Engine hat gewonnen'} (${REASON[s.reason]})`
}
