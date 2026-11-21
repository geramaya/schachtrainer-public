import type { Card } from './srs.ts'
import { cardId, dueCards, isNew } from './srs.ts'

/** Estimated working time per task in seconds (rough: a card is one move, a puzzle a few moves, a deviation one punishing move with its explanation). */
export const TASK_SECONDS = { card: 20, puzzle: 90, deviation: 60 }
export const TARGET_SECONDS = 600
/** Share of the target time that cards may take. */
const CARD_SHARE = 0.7

/** `source` tells where a card position comes from: the repertoire tree, or a played game (cards with origin "partie"). */
export type PlanTask = { kind: 'card'; id: string; source: 'repertoire' | 'partie' } | { kind: 'puzzle'; id: string } | { kind: 'deviation'; id: string }

export interface PlanInput {
  now: number
  targetSec?: number
  /** the trainable cards (tree cards that a variation owns, and game cards) */
  cards: Card[]
  /** variation worked on last, for the fallback with new cards */
  lastVariationId?: string
  puzzles: { id: string; openingId: string; rating: number }[]
  deviations: { id: string; variationId: string; openingId: string }[]
  /** ids of puzzles and deviations already solved (they come last) */
  done: Set<string>
}

export interface TrainingPlan { tasks: PlanTask[]; estimatedSec: number }

const cardTask = (c: Card): PlanTask => ({ kind: 'card', id: cardId(c), source: c.origin === 'partie' ? 'partie' : 'repertoire' })

/** The opening with the most due cards; ties go to the one whose card is the most overdue. */
function weakestOpening(due: Card[]): string | undefined {
  const count = new Map<string, number>()
  for (const c of due) count.set(c.openingId, (count.get(c.openingId) ?? 0) + 1)
  let best: string | undefined
  for (const c of due) if (best === undefined || count.get(c.openingId)! > count.get(best)!) best = c.openingId
  return best
}

/** Picks from `list`: preferred opening first, unsolved before solved, `rank` order inside. */
function pick<T extends { id: string; openingId: string }>(list: T[], opening: string | undefined, done: Set<string>, rank: (a: T, b: T) => number): T | undefined {
  const score = (t: T) => (t.openingId === opening ? 0 : 2) + (done.has(t.id) ? 1 : 0)
  return [...list].sort(rank).sort((a, b) => score(a) - score(b))[0] // sort is stable: ties keep the rank order
}

/**
 * Ten-minute mix: due cards (most overdue first, topped up with new cards of the last worked variation, together at most 70 percent of
 * the time), then one puzzle of the weakest opening and, when cards are due, one deviation to punish. Pure, no time or storage access.
 */
export function planTraining(i: PlanInput): TrainingPlan {
  const target = i.targetSec ?? TARGET_SECONDS
  const maxCards = Math.floor((target * CARD_SHARE) / TASK_SECONDS.card)
  const due = dueCards(i.cards, i.now)
  const news = i.cards.filter((c) => isNew(c) && c.origin === 'baum')
  const variation = i.lastVariationId && news.some((c) => c.variationId === i.lastVariationId) ? i.lastVariationId : news[0]?.variationId
  const chosen = [...due, ...news.filter((c) => c.variationId === variation)].slice(0, maxCards)

  const opening = weakestOpening(due)
    ?? i.cards.find((c) => c.variationId !== '' && c.variationId === i.lastVariationId)?.openingId
    ?? chosen[0]?.openingId
  const tasks: PlanTask[] = chosen.map(cardTask)
  const puzzle = pick(i.puzzles, opening, i.done, (a, b) => a.rating - b.rating)
  if (puzzle) tasks.push({ kind: 'puzzle', id: puzzle.id })
  const deviation = due.length > 0 ? pick(i.deviations, opening, i.done, () => 0) : undefined
  if (deviation) tasks.push({ kind: 'deviation', id: deviation.id })
  return { tasks, estimatedSec: tasks.reduce((n, t) => n + TASK_SECONDS[t.kind], 0) }
}
