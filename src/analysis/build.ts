import type { Side } from '../content/types.ts'
import { gameFens } from '../train/review.ts'
import type { PositionEvals } from '../train/review.ts'
import { gameAccuracy, moveAccuracy, volatilityWeights, winPercent } from './accuracy.ts'
import { CATEGORIES, CLASSIC_SIGN, classifyMove } from './category.ts'
import type { Category } from './category.ts'
import { isRecapture, sacrificesMaterial } from './nag.ts'
import type { Ev, Nag } from './nag.ts'

export interface SecondLine { uci: string; ev: Ev; pv: string[] }
/** What the engine said about one position (before the move that follows): best line and, if there was one, the second line. */
export interface PositionLines { best: { uci: string; pv: string[] }; second: SecondLine | null }
export interface AnalysedMove { cat: Category | null; /** centipawns lost against the best move, >= 0 */ lossCp: number }

/** Version of the classification rules (category.ts); a stored analysis of an older version is classified again when opened. */
export const ANALYSIS_VERSION = 2

/** Result of a full analysis; stored with the game so it is never computed twice. `lines` is null for positions without engine data (PGN import, finished positions). */
export interface GameAnalysis {
  version: number
  source: 'engine' | 'pgn'
  depth: number
  /** n+1 positions, white view; null = unknown (the start position of an imported PGN) */
  positions: (Ev | null)[]
  /** n moves */
  moves: AnalysedMove[]
  lines: (PositionLines | null)[]
  /** the first this many moves are book moves (opening tree); null = not known */
  bookPlies: number | null
}

const turnOf = (fen: string): Side => (fen.split(' ')[1] === 'b' ? 'black' : 'white')
const flip = (s: Side): Side => (s === 'white' ? 'black' : 'white')
/** The side that makes ply `i` (0-based) of a game from `startFen`. */
export const moverAt = (startFen: string, i: number): Side => (i % 2 === 0 ? turnOf(startFen) : flip(turnOf(startFen)))
const pov = (cp: number, side: Side): number => (side === 'white' ? cp : -cp)

/** The classical sign of a category for PGN (!!, !, ?!, ?, ??); null for the others. */
export const nagOf = (m: AnalysedMove): Nag | null => (m.cat ? CLASSIC_SIGN[m.cat] ?? null : null)

/** Classifies every move from the stored evaluations and lines (no engine needed). */
export function classifyMoves(startFen: string, ucis: string[], positions: (Ev | null)[], lines: (PositionLines | null)[], bookPlies: number | null): AnalysedMove[] {
  const fens = gameFens(startFen, ucis)
  let prev: Category | null = null
  return ucis.slice(0, fens.length - 1).map((uci, i) => {
    const mover = moverAt(startFen, i)
    const before = positions[i]
    const after = positions[i + 1]
    const l = lines[i]
    if (!before || !after) { prev = null; return { cat: null, lossCp: 0 } }
    const lossCp = Math.max(0, pov(before.cp, mover) - pov(after.cp, mover))
    const pv = !l ? [] : uci === l.best.uci ? l.best.pv : uci === l.second?.uci ? l.second.pv : []
    const cat = classifyMove({
      mover, before, after, playedUci: uci, bestUci: l?.best.uci ?? null, second: l?.second ?? null,
      sacrifice: pv.length > 0 && sacrificesMaterial(fens[i]!, pv, mover), recapture: i > 0 && isRecapture(fens[i - 1]!, ucis[i - 1]!, uci),
      book: bookPlies !== null && i < bookPlies, prevCategory: prev,
    })
    prev = cat
    return { cat, lossCp }
  })
}

/** Turns the engine results of a game (multipv 2) into the stored analysis with move categories. */
export function buildAnalysis(startFen: string, ucis: string[], ev: PositionEvals, depth: number, bookPlies: number | null = null): GameAnalysis {
  const fens = gameFens(startFen, ucis)
  const detail = ev.detail ?? []
  const positions: (Ev | null)[] = fens.map((_, i) => (ev.whiteCp[i] === undefined ? null : { cp: ev.whiteCp[i]!, mate: detail[i]?.mate ?? null }))
  const lines: (PositionLines | null)[] = fens.map((_, i) => {
    const best = ev.best[i]
    const d = detail[i]
    if (!best) return null
    return { best: { uci: best, pv: d?.pv ?? [best] }, second: d?.second ? { uci: d.second.uci, ev: { cp: d.second.whiteCp, mate: d.second.mate }, pv: d.second.pv } : null }
  })
  return { version: ANALYSIS_VERSION, source: 'engine', depth, positions, moves: classifyMoves(startFen, ucis, positions, lines, bookPlies), lines, bookPlies }
}

const CAT_OF_SIGN: Record<string, Category> = { '!!': 'brilliant', '!': 'great', '?!': 'inaccuracy', '?': 'mistake', '??': 'blunder' }
/** The category of a classical sign (a PGN file knows nothing else). */
export const categoryOfSign = (n: Nag | null): Category | null => (n ? CAT_OF_SIGN[n] ?? null : null)

/**
 * An analysis in the current form: an older engine analysis is classified again from its stored evaluations and lines (no engine run),
 * an old one from a PGN file keeps its signs as categories.
 */
export function normalizeAnalysis(a: GameAnalysis, startFen: string, ucis: string[]): GameAnalysis {
  if (a.version === ANALYSIS_VERSION) return a
  const bookPlies = a.bookPlies ?? null
  if (a.source === 'engine') return { ...a, version: ANALYSIS_VERSION, bookPlies, moves: classifyMoves(startFen, ucis, a.positions, a.lines, bookPlies) }
  const legacy = a.moves as unknown as { nag?: Nag | null; cat?: Category | null; lossCp: number }[]
  return { ...a, version: ANALYSIS_VERSION, bookPlies, moves: legacy.map((m) => ({ cat: m.cat ?? categoryOfSign(m.nag ?? null), lossCp: m.lossCp })) }
}

export type CategoryCounts = Record<Category, number>
export interface SideSummary { accuracy: number | null; counts: CategoryCounts }
export interface Summary { white: SideSummary; black: SideSummary }

const noCounts = (): CategoryCounts => Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as CategoryCounts

/** Accuracy (see accuracy.ts) and the number of moves per category and side. */
export function summarize(a: GameAnalysis, startFen: string): Summary {
  const known = a.positions.find((p) => p !== null)
  const wins = a.positions.map((p) => winPercent((p ?? known)?.cp ?? 0))
  const weights = volatilityWeights(wins)
  const out: Record<Side, { moves: { acc: number; weight: number }[]; counts: CategoryCounts }> = { white: { moves: [], counts: noCounts() }, black: { moves: [], counts: noCounts() } }
  a.moves.forEach((m, i) => {
    const mover = moverAt(startFen, i)
    if (m.cat) out[mover].counts[m.cat]++
    const [before, after] = [a.positions[i], a.positions[i + 1]]
    if (!before || !after) return
    const w = (cp: number) => winPercent(pov(cp, mover))
    out[mover].moves.push({ acc: moveAccuracy(w(before.cp), w(after.cp)), weight: weights[i] ?? 1 })
  })
  return { white: { accuracy: gameAccuracy(out.white.moves), counts: out.white.counts }, black: { accuracy: gameAccuracy(out.black.moves), counts: out.black.counts } }
}
