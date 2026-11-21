import type { Category } from '../analysis/category.ts'
import type { Judgement, Rating } from './judge.ts'
import type { Side } from '../content/types.ts'
import { LABEL, SYMBOL } from './blocks.ts'
import { moodFor } from './mood.ts'
import type { FigurId, Gefuehl } from './avatar.ts'
import type { QuipCategory } from './quips.ts'
import type { AnalysisLine } from '../engine/service.ts'
import { applyUci } from '../chess/game.ts'
import { gameStatus } from '../chess/status.ts'
import { toGermanSan } from '../chess/notation.ts'
import { explainBest } from './facts.ts'
import { quipCategories } from './quip-events.ts'

/** Teacher event for an analysis category (the teacher speaks the same events as in the sparring game). */
export function quipCategoryOf(cat: Category): QuipCategory {
  switch (cat) {
    case 'brilliant': case 'great': case 'best': return 'bester_zug'
    case 'excellent': case 'good': case 'book': return 'gut'
    case 'inaccuracy': return 'ungenau'
    case 'mistake': case 'miss': return 'fehler'
    case 'blunder': return 'patzer'
  }
}

/** The avatar feeling for an analysis category; no category = neutral. */
export const gefuehlForCategory = (figur: FigurId, cat: Category | null): Gefuehl => (cat ? moodFor(figur, quipCategoryOf(cat)) : 'neutral')

export type Phase = 'Eröffnung' | 'Mittelspiel' | 'Endspiel'
/** Phase by half-move index (0-based): opening up to move 10, middlegame up to move 25, then endgame. A plain rule, not an evaluation. */
export const phaseOf = (ply: number): Phase => (ply < 20 ? 'Eröffnung' : ply < 50 ? 'Mittelspiel' : 'Endspiel')

export interface BalanceMove { ply: number; cat: Category | null; /** centipawns lost against the best move */ lossCp: number; /** shown SAN (German) */ san: string }
export interface BalanceInput { moves: BalanceMove[]; accuracy: number | null; /** "du", "Weiß" or "Schwarz" */ subject: string }

const isBlunder = (c: Category | null) => c === 'blunder'
const isMistake = (c: Category | null) => c === 'mistake' || c === 'miss'
const pawns = (cp: number) => (Math.round(cp / 10) / 10).toFixed(1).replace('.', ',')

/** Short summary of one side of a game in the teacher voice. Only numbers from the analysis: counts, phases, accuracy, the move that lost most. */
export function balance(i: BalanceInput): string[] {
  if (!i.moves.length) return []
  const you = i.subject === 'du'
  const had = you ? 'Du hattest' : `${i.subject} hatte`
  const out: string[] = []
  if (i.accuracy !== null) out.push(you ? `Deine Genauigkeit lag bei ${Math.round(i.accuracy)} %.` : `Die Genauigkeit von ${i.subject} lag bei ${Math.round(i.accuracy)} %.`)
  const blunders = i.moves.filter((m) => isBlunder(m.cat))
  const mistakes = i.moves.filter((m) => isMistake(m.cat))
  if (!blunders.length && !mistakes.length) { out.push(`${had} keinen Patzer und keinen Fehler.`); return out }
  const counts = (b: number, m: number) => [b ? `${b} Patzer` : '', m ? `${m} Fehler` : ''].filter(Boolean)
  out.push(`${had} ${counts(blunders.length, mistakes.length).join(' und ')}.`)
  const phases = (['Eröffnung', 'Mittelspiel', 'Endspiel'] as const)
    .map((p) => {
      const c = counts(blunders.filter((m) => phaseOf(m.ply) === p).length, mistakes.filter((m) => phaseOf(m.ply) === p).length)
      return c.length ? `${p}: ${c.join(', ')}` : ''
    })
    .filter(Boolean)
  out.push(`${phases.join('; ')}.`)
  const worst = [...blunders, ...mistakes].reduce((a, b) => (b.lossCp > a.lossCp ? b : a))
  out.push(`Bei Zug ${Math.floor(worst.ply / 2) + 1} (${worst.san}, ${isBlunder(worst.cat) ? 'Patzer' : 'Fehler'}) ging am meisten verloren: etwa ${pawns(worst.lossCp)} Bauern.`)
  return out
}

/** Headline, severity class and text of the speech bubble for a judged move (same look as in the sparring game). */
export function judgedCard(j: Pick<Judgement, 'rating' | 'text'> | null): { headline: string; severity: string; text: string } {
  return j ? { headline: `${SYMBOL[j.rating]} ${LABEL[j.rating]}`, severity: j.rating, text: j.text } : { headline: '', severity: '', text: '' }
}

/** Where the teacher talks: while browsing a saved game (on by default) and at the analysis board (off by default). */
export interface TalkSettings { game: boolean; board: boolean }
export const DEFAULT_TALK: TalkSettings = { game: true, board: false }
export function parseTalk(raw: unknown): TalkSettings {
  const o = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  return { game: typeof o.game === 'boolean' ? o.game : DEFAULT_TALK.game, board: typeof o.board === 'boolean' ? o.board : DEFAULT_TALK.board }
}

/** Card colour class (the rating names of the sparring game) for an analysis category. */
export function severityOfCategory(cat: Category): Rating {
  switch (cat) {
    case 'brilliant': case 'great': case 'best': return 'best'
    case 'excellent': return 'excellent'
    case 'good': case 'book': return 'gut'
    case 'inaccuracy': return 'ungenau'
    case 'mistake': case 'miss': return 'fehler'
    case 'blunder': return 'patzer'
  }
}

/** The moves of one side from the stored analysis (one entry per half-move, in order). */
export function balanceMoves(analysed: readonly { cat: Category | null; lossCp: number }[], sans: readonly string[], moverOf: (ply: number) => Side, side: Side): BalanceMove[] {
  const out: BalanceMove[] = []
  analysed.forEach((m, ply) => { if (moverOf(ply) === side) out.push({ ply, cat: m.cat, lossCp: m.lossCp, san: sans[ply] ?? '' }) })
  return out
}

/** Teacher events for a move at the analysis board: the mover is always "mine" (the teacher judges whoever moved). */
export function boardMoveCategories(fenBefore: string, uci: string, rating: Rating): QuipCategory[] {
  const after = applyUci(fenBefore, uci)
  return quipCategories({ mine: true, check: !!after?.san.endsWith('+'), status: gameStatus(fenBefore, [uci]), rating, note: null })
}

/** "Bester Zug: Sf3: reason." for a requested hint of the best move. */
export function bestMoveText(fen: string, line: AnalysisLine): string {
  const san = applyUci(fen, line.uci)?.san
  const why = explainBest(fen, line)
  return `Bester Zug: ${toGermanSan(san ?? line.uci)}${why ? `: ${why}` : '.'}`
}
