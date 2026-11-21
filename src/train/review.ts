import { Chess } from 'chess.js'
import type { AnalysisLine, Engine } from '../engine/service.ts'
import type { ContentBundle, Side } from '../content/types.ts'
import type { OpeningOverlays } from '../store/overlays.ts'
import { expectedMove, knownReplies, treeFor } from '../content/tree.ts'
import { applyUci } from '../chess/game.ts'
import { gameStatus } from '../chess/status.ts'
import { positionKey } from '../chess/position.ts'
import type { Card } from './srs.ts'
import { cardKey } from './card-id.ts'

import { MATE_CP } from '../coach/texts.ts'
const THRESHOLDS = { ungenau: 50, fehler: 100, patzer: 200 }
const DRAW_MARGIN_CP = 50

export type Severity = 'ungenau' | 'fehler' | 'patzer'

/** Engine scores are from the side to move; the classification works on the white side. */
export const toWhiteCp = (cp: number, sideToMove: Side): number => (sideToMove === 'white' ? cp : -cp)

/** Score of an analysis line from the side to move: mate = plus/minus 10000 (mate 0 = the side to move is mated). */
export function scoreCp(l: Pick<AnalysisLine, 'cp' | 'mate'>): number {
  if (l.mate !== null) return l.mate > 0 ? MATE_CP : -MATE_CP
  return l.cp ?? 0
}

/** Severity of a centipawn loss; null below the "ungenau" threshold. */
export const severityOf = (lossCp: number): Severity | null =>
  lossCp >= THRESHOLDS.patzer ? 'patzer' : lossCp >= THRESHOLDS.fehler ? 'fehler' : lossCp >= THRESHOLDS.ungenau ? 'ungenau' : null

/**
 * evalsWhiteCp[i] = evaluation (white side) after ply i; `startCp` = evaluation before ply 0.
 * Returns every move of `userSide` that lost at least 50 cp; ply = 0-based index of that move.
 */
export function classify(evalsWhiteCp: number[], userSide: Side, startCp = 0, firstMover: Side = 'white'): { ply: number; lossCp: number; severity: Severity }[] {
  const out: { ply: number; lossCp: number; severity: Severity }[] = []
  evalsWhiteCp.forEach((after, ply) => {
    const mover: Side = (ply % 2 === 0) === (firstMover === 'white') ? 'white' : 'black'
    if (mover !== userSide) return
    const before = ply === 0 ? startCp : evalsWhiteCp[ply - 1]!
    const lossCp = userSide === 'white' ? before - after : after - before
    const severity = severityOf(lossCp)
    if (severity) out.push({ ply, lossCp, severity })
  })
  return out
}

/** First 0-based ply that leaves the book: an own move other than expectedMove, an opponent move not among the known replies, or any move from a position without a node. `openingId` = the opening whose tree is followed. `startFen` defaults to the initial position. */
export function bookExit(ucis: string[], b: ContentBundle, openingId: string, ov: OpeningOverlays, startFen: string = new Chess().fen()): number | null {
  let fen = startFen
  for (let i = 0; i < ucis.length; i++) {
    const key = positionKey(fen)
    const node = treeFor(b, openingId)[key]
    if (!node) return i
    const uci = ucis[i]!
    const inBook = node.ownMove ? expectedMove(b, openingId, key, ov)?.uci === uci : knownReplies(b, openingId, key).some((r) => r.uci === uci)
    const next = inBook ? applyUci(fen, uci) : null
    if (!next) return i
    fen = next.fen
  }
  return null
}

/** The engine accepts a draw offer when it sees the position as roughly equal. */
export const drawAccepted = (cpSideToMove: number): boolean => Math.abs(cpSideToMove) <= DRAW_MARGIN_CP

/** Start position plus the position after every legal move; stops silently at the first illegal one. */
export function gameFens(startFen: string, ucis: string[]): string[] {
  const fens = [startFen]
  for (const u of ucis) {
    const next = applyUci(fens[fens.length - 1]!, u)
    if (!next) break
    fens.push(next.fen)
  }
  return fens
}

/** Engine detail of one position (multipv 2), white view: mate distance of the best line (signed, null without mate), its line, and the second line. */
export interface PositionDetail { mate: number | null; pv: string[]; second: { uci: string; whiteCp: number; mate: number | null; pv: string[] } | null }
export interface PositionEvals { whiteCp: number[]; best: (string | null)[]; /** only with multipv >= 2 */ detail?: PositionDetail[] }

const whiteMate = (l: Pick<AnalysisLine, 'mate'>, side: Side): number | null => (l.mate === null ? null : side === 'white' ? l.mate : -l.mate)

/** White-side score of a finished position (mate against the side to move, or a draw); null while the game goes on. */
function terminalCp(fen: string): number | null {
  const s = gameStatus(fen, [])
  if (!s.over) return null
  return s.winner === null ? 0 : s.winner === 'white' ? MATE_CP : -MATE_CP
}

/** Analyses every position one after the other (the engine runs one job at a time). Terminal positions are not sent to the engine (it crashes on them). */
export async function evaluatePositions(
  engine: Engine, fens: string[], depth: number, opts: { onProgress?: (done: number, total: number) => void; isCancelled?: () => boolean; multipv?: number } = {},
): Promise<PositionEvals> {
  const whiteCp: number[] = []
  const best: (string | null)[] = []
  const detail: PositionDetail[] = []
  const multipv = opts.multipv ?? 1
  for (const fen of fens) {
    if (opts.isCancelled?.()) throw new Error('analysis cancelled')
    const end = terminalCp(fen)
    if (end !== null) {
      whiteCp.push(end); best.push(null); detail.push({ mate: null, pv: [], second: null })
    } else {
      const a = await engine.analyse(fen, multipv > 1 ? { depth, multipv } : { depth })
      const side: Side = fen.split(' ')[1] === 'b' ? 'black' : 'white'
      const [top, next] = [a.lines[0]!, a.lines[1]]
      whiteCp.push(toWhiteCp(scoreCp(top), side))
      best.push(a.bestUci)
      detail.push({ mate: whiteMate(top, side), pv: top.pv, second: next ? { uci: next.uci, whiteCp: toWhiteCp(scoreCp(next), side), mate: whiteMate(next, side), pv: next.pv } : null })
    }
    opts.onProgress?.(whiteCp.length, fens.length)
  }
  return multipv > 1 ? { whiteCp, best, detail } : { whiteCp, best }
}

export interface ReviewError {
  ply: number; uci: string; san: string; lossCp: number; severity: Severity
  fenBefore: string; betterUci: string; betterSan: string
}

/** The user's mistakes with the engine's better move. ev covers positions 0..n: ev.whiteCp[0] is the baseline, ev.whiteCp[i+1] the evaluation after ply i. */
export function reviewErrors(startFen: string, ucis: string[], ev: PositionEvals, userSide: Side): ReviewError[] {
  const fens = gameFens(startFen, ucis)
  const firstMover: Side = startFen.split(' ')[1] === 'b' ? 'black' : 'white'
  const out: ReviewError[] = []
  for (const c of classify(ev.whiteCp.slice(1, fens.length), userSide, ev.whiteCp[0] ?? 0, firstMover)) {
    const betterUci = ev.best[c.ply]
    const fenBefore = fens[c.ply]!
    const played = applyUci(fenBefore, ucis[c.ply]!)
    const better = betterUci ? applyUci(fenBefore, betterUci) : null
    if (!betterUci || !played || !better) continue
    out.push({ ...c, uci: ucis[c.ply]!, san: played.san, fenBefore, betterUci, betterSan: better.san })
  }
  return out
}

/** New training cards (position + best move) for the mistakes; positions that already have a card keep it. */
export function cardsFromErrors(errors: ReviewError[], variationId: string, openingId: string, contentVersion: string, existing: Record<string, Card>): Card[] {
  const out = new Map<string, Card>()
  for (const e of errors) {
    const key = positionKey(e.fenBefore)
    if (existing[cardKey(openingId, key)] || out.has(key)) continue
    out.set(key, { openingId, key, expectedUci: e.betterUci, variationId, due: 0, intervalDays: 0, ease: 2.5, reps: 0, lapses: 0, contentVersion, origin: 'partie' })
  }
  return [...out.values()]
}
