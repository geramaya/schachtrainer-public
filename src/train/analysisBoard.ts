import { Chess } from 'chess.js'
import { applyUci } from '../chess/game.ts'
import { gameFens } from './review.ts'

/** Free analysis line: both sides move; `view` = number of plies shown (0 = start position). */
export interface AnalysisBoard { startFen: string; ucis: string[]; view: number }

export const newAnalysis = (startFen: string): AnalysisBoard => ({ startFen, ucis: [], view: 0 })

export const currentFen = (a: AnalysisBoard): string => gameFens(a.startFen, a.ucis.slice(0, a.view)).at(-1)!

/** Plays a move at the shown position. Illegal: the same object comes back. From an earlier position the old continuation is cut, unless the move repeats it. */
export function playMove(a: AnalysisBoard, uci: string): AnalysisBoard {
  if (!applyUci(currentFen(a), uci)) return a
  if (a.ucis[a.view] === uci) return { ...a, view: a.view + 1 }
  return { ...a, ucis: [...a.ucis.slice(0, a.view), uci], view: a.view + 1 }
}

export const goTo = (a: AnalysisBoard, ply: number): AnalysisBoard => ({ ...a, view: Math.max(0, Math.min(a.ucis.length, ply)) })
export const goBack = (a: AnalysisBoard): AnalysisBoard => goTo(a, a.view - 1)
export const goForward = (a: AnalysisBoard): AnalysisBoard => goTo(a, a.view + 1)

/** SAN of the line and the 0-based ply it starts at (odd = Black to move first). */
export function moveLine(a: AnalysisBoard): { sans: string[]; startPly: number } {
  const chess = new Chess(a.startFen)
  const startPly = (chess.moveNumber() - 1) * 2 + (chess.turn() === 'b' ? 1 : 0)
  const sans = a.ucis.map((uci) => chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san)
  return { sans, startPly }
}

/** Normalised FEN for the analysis board, or null if chess.js refuses it or the position cannot occur (adjacent kings, side not to move in check). */
export function analysisFen(fen: string): string | null {
  let chess: Chess
  try { chess = new Chess(fen) } catch { return null }
  const kings = chess.board().flat().filter((p) => p?.type === 'k')
  if (kings.length !== 2) return null
  const [a, b] = kings.map((k) => ({ file: k!.square.charCodeAt(0), rank: Number(k!.square[1]) }))
  if (Math.abs(a!.file - b!.file) <= 1 && Math.abs(a!.rank - b!.rank) <= 1) return null
  const idle = kings.find((k) => k!.color !== chess.turn())!
  if (chess.isAttacked(idle!.square, chess.turn())) return null
  return chess.fen()
}
