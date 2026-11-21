import type { AnalysisLine } from '../engine/service.ts'
import { applyUci } from '../chess/game.ts'
import { toGermanSan } from '../chess/notation.ts'
import { severityOf, scoreCp, toWhiteCp } from '../train/review.ts'
import { winPercent } from '../analysis/accuracy.ts'
import { lossCategory } from '../analysis/category.ts'
import type { Category } from '../analysis/category.ts'
import { fmtScore } from '../coach/texts.ts'
import type { Side } from '../content/types.ts'
import { detectFacts, explainBest } from './facts.ts'
import type { Fact } from './facts.ts'
import { PRAISE_BEST, PRAISE_EXCELLENT, PRAISE_GOOD, factSentence, pick } from './blocks.ts'

/** Both lines from the point of view of the side that moves; each pv starts with the move itself. */
export interface MoveEvals { best: AnalysisLine; played: AnalysisLine }
export type Rating = 'best' | 'excellent' | 'gut' | 'ungenau' | 'fehler' | 'patzer'
export interface Judgement {
  rating: Rating
  lossCp: number
  facts: Fact[]
  /** what the teacher says right after the move (never names the better move for fehler/patzer) */
  text: string
  /** shown on request ("Besten Zug zeigen"): the better move and why */
  reveal: string
  bestWhy: string | null
  /** the engine's best move (uci, English SAN) */
  betterUci: string
  betterSan: string
}

/** Loss in centipawns; mate scores count as ±10000, and between two mates of the same side every move of distance counts 50 cp (a slower own mate never worse than "ungenau"). */
const MATE_STEP_CP = 50
export function lossOf(best: AnalysisLine, played: AnalysisLine): number {
  if (best.mate !== null && played.mate !== null && Math.sign(best.mate) === Math.sign(played.mate)) {
    const steps = (Math.abs(played.mate) - Math.abs(best.mate)) * Math.sign(best.mate)
    const loss = Math.max(0, steps) * MATE_STEP_CP
    return best.mate > 0 ? Math.min(loss, 99) : loss
  }
  return Math.max(0, scoreCp(best) - scoreCp(played))
}

const RATING_OF: Record<Category, Rating> = { best: 'best', excellent: 'excellent', good: 'gut', inaccuracy: 'ungenau', mistake: 'fehler', blunder: 'patzer', brilliant: 'best', great: 'best', book: 'best', miss: 'fehler' }
const sameMate = (a: AnalysisLine, b: AnalysisLine): boolean => a.mate !== null && b.mate !== null && Math.sign(a.mate) === Math.sign(b.mate)

/**
 * The teacher rates like the analysis: by lost Expected Points (category.ts: excellent <= 0.02, good <= 0.05, inaccuracy <= 0.10,
 * mistake <= 0.20, blunder above). Between two mates of the same side the distance still counts 50 cp per move (lossOf), where Expected Points
 * cannot tell them apart. The categories that need the game around the move (brilliant, great, book, miss) are not decided here.
 */
function ratingOf(uci: string, ev: MoveEvals, lossCp: number): Rating {
  if (ev.best.uci === uci) return 'best'
  if (sameMate(ev.best, ev.played)) return severityOf(lossCp) ?? 'gut'
  const loss = winPercent(scoreCp(ev.best)) / 100 - winPercent(scoreCp(ev.played)) / 100
  return RATING_OF[lossCategory(Math.max(0, loss), false)]
}

/** How much the best move would have brought, in pawn units; null for mate scores (centipawns mean nothing there). Never names the move. */
function gainSentence(ev: MoveEvals, lossCp: number): string | null {
  if (ev.best.mate !== null || ev.played.mate !== null || lossCp < 5) return null
  return `Der beste Zug hätte dir etwa ${(lossCp / 100).toFixed(1).replace('.', ',')} Bauerneinheiten mehr gebracht.`
}

export function judgeMove(fenBefore: string, uci: string, ev: MoveEvals): Judgement {
  const mover: Side = fenBefore.split(' ')[1] === 'b' ? 'black' : 'white'
  const lossCp = lossOf(ev.best, ev.played)
  const rating = ratingOf(uci, ev, lossCp)
  const seed = `${fenBefore}|${uci}`
  const shown = (l: AnalysisLine) => fmtScore(toWhiteCp(scoreCp(l), mover))
  const san = toGermanSan(applyUci(fenBefore, uci)?.san ?? uci)
  const betterSan = applyUci(fenBefore, ev.best.uci)?.san ?? ev.best.uci
  const better = toGermanSan(betterSan)
  const bestWhy = explainBest(fenBefore, ev.best)
  const facts = rating === 'ungenau' || rating === 'fehler' || rating === 'patzer' ? detectFacts(fenBefore, ev.played, ev.best) : []
  const stockfish = `Stockfish sieht nach ${san} ${shown(ev.played)}`
  const reveal = `Besser war ${better}${bestWhy ? `: ${bestWhy}` : ` (${shown(ev.best)}).`}`
  const fact = facts[0] ? factSentence(facts[0], seed) : null

  let text: string
  if (rating === 'best') text = [pick(seed, PRAISE_BEST), bestWhy].filter(Boolean).join(' ')
  else if (rating === 'excellent') text = pick(seed, PRAISE_EXCELLENT)
  else if (rating === 'gut') text = pick(seed, PRAISE_GOOD)
  else {
    const gain = rating !== 'ungenau' || lossCp >= 10 ? gainSentence(ev, lossCp) : null
    text = [fact ?? `${stockfish}.`, gain].filter(Boolean).join(' ')
  }
  return { rating, lossCp, facts, text, reveal, bestWhy, betterUci: ev.best.uci, betterSan }
}
