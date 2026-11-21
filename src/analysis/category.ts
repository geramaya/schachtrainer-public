import type { Side } from '../content/types.ts'
import { winPercent } from './accuracy.ts'
import type { Ev } from './nag.ts'

/**
 * Move categories after the public description of chess.com game review (own implementation, no chess.com graphics):
 * support.chess.com article 8584089 (list of the categories) and 8572705 (Classification V2, Expected Points limits).
 * The thresholds below are those limits; where the articles are vague the rule is a documented choice and uncertainty gives the lower category.
 *
 * Expected Points (EP, 0..1) = win chance / 100 from the evaluation with the Lichess curve (accuracy.ts), WITHOUT rating dependence
 * (chess.com adjusts for the player rating; we do not). The loss of a move = EP(best line before the move) - EP(position after it), mover's view.
 *
 *   Best          the engine's top move (or loss 0)
 *   Excellent     loss <= 0.02        Good  <= 0.05        Inaccuracy ?!  <= 0.10      Mistake ?  <= 0.20      Blunder ??  > 0.20
 *   Book          a move of the opening book (repertoire tree); precedence over everything else while in the book
 *   Great !       a Best/Excellent move that is the only good move (the second best line is worse by more than 0.10 EP) or that decides the zone
 *                 (EP of the best line vs the second line on different sides of 0.35 / 0.65, difference >= 0.05); not when the best line is
 *                 already > 0.90 EP, not for a forced recapture
 *   Brilliant !!  a Best/Excellent move that proves a material sacrifice in the engine line (net >= 2 pawn units), the position before is not
 *                 already clearly won (EP <= 0.65) and after the move it is at least balanced (EP >= 0.35); not for a recapture
 *   Miss          the opponent's previous move was a Mistake or Blunder, the position before this move was winning (EP > 0.65) and this move
 *                 (an Inaccuracy or worse) lets it slip to balanced (EP after 0.35..0.65); a collapse to worse than balanced keeps its loss category
 *   Zones         losing < 0.35, balanced 0.35..0.65, winning > 0.65
 */
export type Category = 'brilliant' | 'great' | 'best' | 'excellent' | 'good' | 'book' | 'inaccuracy' | 'mistake' | 'miss' | 'blunder'

/** Order of the list and the legend. */
export const CATEGORIES: readonly Category[] = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder']

export const EP_LIMIT = { excellent: 0.02, good: 0.05, inaccuracy: 0.10, mistake: 0.20 } as const
export const ZONE = { low: 0.35, high: 0.65 } as const
const ONLY_MOVE_GAP = 0.10
const TURN_GAP = 0.05
const GREAT_MAX_EP = 0.90

const pov = (cp: number, side: Side): number => (side === 'white' ? cp : -cp)
/** Expected points of a position for `side`. */
export const ep = (e: Ev, side: Side): number => winPercent(pov(e.cp, side)) / 100

export interface ClassifyInput {
  mover: Side
  /** the position before the move (best line) and after it, white view */
  before: Ev
  after: Ev
  playedUci: string
  bestUci: string | null
  second: { uci: string; ev: Ev } | null
  /** the engine line of the played move proves a material sacrifice */
  sacrifice: boolean
  /** the move takes back on the square where the opponent just took */
  recapture: boolean
  /** the move is a book move */
  book: boolean
  /** category of the opponent's previous move */
  prevCategory: Category | null
}

/** The loss category by Expected Points alone. */
export function lossCategory(loss: number, isBest: boolean): Category {
  if (isBest || loss <= 1e-9) return 'best'
  if (loss <= EP_LIMIT.excellent) return 'excellent'
  if (loss <= EP_LIMIT.good) return 'good'
  if (loss <= EP_LIMIT.inaccuracy) return 'inaccuracy'
  if (loss <= EP_LIMIT.mistake) return 'mistake'
  return 'blunder'
}

const zone = (p: number): 0 | 1 | 2 => (p < ZONE.low ? 0 : p <= ZONE.high ? 1 : 2)

/** Category of a move; null without engine data. */
export function classifyMove(i: ClassifyInput): Category | null {
  if (!i.bestUci) return null
  if (i.book) return 'book'
  const before = ep(i.before, i.mover)
  const after = ep(i.after, i.mover)
  const loss = Math.max(0, before - after)
  const level = lossCategory(loss, i.playedUci === i.bestUci)

  if ((level === 'inaccuracy' || level === 'mistake' || level === 'blunder') && (i.prevCategory === 'mistake' || i.prevCategory === 'blunder')
    && before > ZONE.high && after >= ZONE.low && after <= ZONE.high) return 'miss'

  if ((level === 'best' || level === 'excellent') && !i.recapture) {
    const second = i.second ? ep(i.second.ev, i.mover) : null
    if (i.sacrifice && before <= ZONE.high && after >= ZONE.low) return 'brilliant'
    if (second !== null && before <= GREAT_MAX_EP) {
      const gap = before - second
      if (gap > ONLY_MOVE_GAP || (gap >= TURN_GAP && zone(before) !== zone(second))) return 'great'
    }
  }
  return level
}

/** Classical sign where the category has one (for PGN NAGs); the others have no standard NAG. */
export const CLASSIC_SIGN: Partial<Record<Category, '!!' | '!' | '?!' | '?' | '??'>> = { brilliant: '!!', great: '!', inaccuracy: '?!', mistake: '?', blunder: '??' }

/** Symbol shown after the move: classical signs, own plain symbols for the rest. Colour is never the only carrier. */
export const SYMBOL: Record<Category, string> = { brilliant: '!!', great: '!', best: '★', excellent: '✓✓', good: '✓', book: '☰', inaccuracy: '?!', mistake: '?', miss: '✗', blunder: '??' }

export const NAME: Record<Category, string> = {
  brilliant: 'Brillant', great: 'Stark', best: 'Bester Zug', excellent: 'Exzellent', good: 'Gut', book: 'Buchzug',
  inaccuracy: 'Ungenau', mistake: 'Fehler', miss: 'Verpasst', blunder: 'Patzer',
}

/** One sentence per category for the legend. */
export const MEANING: Record<Category, string> = {
  brilliant: 'gutes Figurenopfer, das sich auszahlt', great: 'einziger guter Zug oder Zug, der die Partie dreht', best: 'der beste Zug der Engine',
  excellent: 'fast so gut wie der beste', good: 'solider Zug', book: 'Zug aus dem Eröffnungsbuch',
  inaccuracy: 'kleine Ungenauigkeit', mistake: 'Fehler, der spürbar kostet', miss: 'Gewinnchance nach Gegnerfehler verpasst', blunder: 'grober Patzer',
}
