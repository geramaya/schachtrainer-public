import { Chess } from 'chess.js'
import type { Arrow, Side } from '../content/types.ts'
import type { Analysis, AnalysisLine } from '../engine/service.ts'
import { toGermanSan } from '../chess/notation.ts'
import { MATE_CP } from './texts.ts'
import { evalLabel } from './evalbar.ts'

/** Evaluation from White's side: cp in centipawns, mate = moves to mate (+n White mates, -n Black mates). */
export interface Score { cp: number | null; mate: number | null }

/** Engine scores come from the side to move; the display always shows White's side. */
export function whiteScore(s: Score, turn: Side): Score {
  const k = turn === 'white' ? 1 : -1
  return { cp: s.cp === null ? null : s.cp * k, mate: s.mate === null ? null : s.mate * k }
}

export const scoreLabel = (s: Score): string => evalLabel(s.cp ?? 0, s.mate)

/** Single number for the evaluation bar: mate saturates the bar. */
export function barCp(s: Score | null): number {
  if (!s) return 0
  if (s.mate !== null) return s.mate > 0 ? MATE_CP : -MATE_CP
  return s.cp ?? 0
}

export interface PvMove { num: string | null; san: string; uci: string; fen: string }

/** The principal variation as German SAN with move numbers, each with the position after it; stops at the first illegal move or after `max` plies. */
export function pvMoves(fen: string, pv: string[], max = 12): PvMove[] {
  const chess = new Chess(fen)
  const out: PvMove[] = []
  let ply = (chess.moveNumber() - 1) * 2 + (chess.turn() === 'b' ? 1 : 0)
  for (const uci of pv.slice(0, max)) {
    const number = Math.floor(ply / 2) + 1
    const num = ply % 2 === 0 ? `${number}.` : out.length === 0 ? `${number}…` : null
    let san: string
    try {
      san = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san
    } catch {
      break
    }
    out.push({ num, san: toGermanSan(san), uci, fen: chess.fen() })
    ply++
  }
  return out
}

export interface LiveLine { label: string; score: Score; moves: PvMove[]; uci: string }
export interface LiveSummary { depth: number; best: Score | null; lines: LiveLine[] }

/** Analysis of `fen` as lines from White's side with ready-made labels and SAN. */
export function summarize(a: Analysis, fen: string, maxPlies = 12): LiveSummary {
  const turn: Side = fen.split(' ')[1] === 'b' ? 'black' : 'white'
  const lines = a.lines.map((l) => {
    const score = whiteScore(l, turn)
    return { label: scoreLabel(score), score, moves: pvMoves(fen, l.pv, maxPlies), uci: l.uci }
  })
  return { depth: a.depth, best: lines[0]?.score ?? null, lines }
}

const arrowOf = (l: Pick<AnalysisLine, 'uci'>, brush: Arrow['brush']): Arrow => ({ orig: l.uci.slice(0, 2), dest: l.uci.slice(2, 4), brush })

/** Lichess style: best move strong, second line pale. */
export function engineArrows(lines: Pick<AnalysisLine, 'uci'>[]): Arrow[] {
  return [lines[0] && arrowOf(lines[0], 'ceval'), lines[1] && arrowOf(lines[1], 'cevalPale')].filter((a): a is Arrow => !!a)
}

/** What the engine field reports to its view: bar value, arrows and why there may be none. */
export interface EngineView { score: Score | null; arrows: Arrow[]; access: 'on' | 'off' | 'locked' | 'busy' }
export const EMPTY_VIEW: EngineView = { score: null, arrows: [], access: 'off' }

/** A position without legal moves: checkmate is a win for the side that is not to move (shown as plain "#"), stalemate is 0. */
export function endedScore(fen: string): Score {
  const chess = new Chess(fen)
  if (!chess.isCheckmate()) return { cp: 0, mate: null }
  return { cp: chess.turn() === 'w' ? -MATE_CP : MATE_CP, mate: null }
}

/** Score for the bar: a finished position shows its own result, an engine error shows nothing, otherwise the newest value (or the last one while the next computes). */
export function shownScore(s: { fen: string; ended: boolean; error: string; best: Score | null; held: Score | null }): Score | null {
  if (s.ended) return endedScore(s.fen)
  if (s.error) return null
  return s.best ?? s.held
}
