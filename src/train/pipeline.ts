import type { ContentBundle, Deviation, Explanation, Puzzle, Question } from '../content/types.ts'
import { nodeOfVariation, openingOfVariation } from '../content/tree.ts'
import { explanationAtKey } from './lesson.ts'
import { cardScope, lineKeys } from './scope.ts'
import type { Card } from './srs.ts'
import { isNew } from './srs.ts'
import type { Progress } from '../store/progress.ts'

export type StageState = 'keine' | 'leer' | 'begonnen' | 'fertig'
export type StageId = 'lernen' | 'verstehen' | 'festigen' | 'anwenden'
export type VariationStages = Record<StageId, StageState>

/** `keine`: the stage has no content (total 0) and does not count towards progress. */
export const stageState = (done: number, total: number): StageState => (total === 0 ? 'keine' : done === 0 ? 'leer' : done >= total ? 'fertig' : 'begonnen')

/** Share of variations that finished each stage (bars on the tiles); variations whose stage has no content are not counted. */
export function openingProgress(list: VariationStages[]): Record<StageId, { done: number; total: number }> {
  const stages: StageId[] = ['lernen', 'verstehen', 'festigen', 'anwenden']
  return Object.fromEntries(stages.map((s) => [s, { done: list.filter((v) => v[s] === 'fertig').length, total: list.filter((v) => v[s] !== 'keine').length }])) as Record<StageId, { done: number; total: number }>
}

export const applyDeviationId = (variationId: string, key: string, replyUci: string): string => `d:${variationId}:${key}:${replyUci}`
export const applySparringId = (variationId: string): string => `s:${variationId}`

/** Puzzles of a variation: its own pool, else the pool of its opening (`<openingId>/allgemein`). */
export function puzzlesOf(b: ContentBundle, variationId: string): Puzzle[] {
  const own = b.puzzles[variationId]
  if (own?.length) return own
  const openingId = openingOfVariation(b, variationId)?.id
  return (openingId && b.puzzles[`${openingId}/allgemein`]) || []
}

export const applyPuzzleId = (puzzleId: string): string => `p:${puzzleId}`
const MIN_PUZZLES = 3

/** What a variation offers, derived from the bundle alone. Costly (replays the line), so computed once per bundle and variation. */
interface VariationContent { keyExplanations: Explanation[]; questions: Question[]; deviations: Deviation[]; puzzles: Puzzle[] }
const contentCache = new WeakMap<ContentBundle, Map<string, VariationContent>>()
function contentOf(b: ContentBundle, variationId: string): VariationContent {
  const perBundle = contentCache.get(b) ?? new Map<string, VariationContent>()
  contentCache.set(b, perBundle)
  let c = perBundle.get(variationId)
  if (!c) {
    const openingId = openingOfVariation(b, variationId)?.id
    c = {
      keyExplanations: lineKeys(b, variationId).flatMap((k) => explanationAtKey(b.explanations, k, openingId) ?? []),
      questions: b.questions.filter((q) => q.variationId === variationId),
      deviations: b.deviations.filter((d) => d.variationId === variationId && nodeOfVariation(b, variationId, d.key)),
      puzzles: puzzlesOf(b, variationId),
    }
    perBundle.set(variationId, c)
  }
  return c
}

/** Stage state of one variation: content from the (cached) bundle derivation, progress read fresh on every call. */
export function variationStages(b: ContentBundle, p: Progress, variationId: string, now: number = Date.now()): VariationStages {
  const { keyExplanations, questions, deviations, puzzles } = contentOf(b, variationId)
  const rated = keyExplanations.filter((e) => p.feedback[e.id]).length
  const understood = questions.filter((q) => p.understood.includes(q.id)).length
  const scope = cardScope(b, variationId, p.overlays)
  const cards = [...scope].flatMap((id) => p.cards[id] ?? [])
  const practised = cards.filter((c) => !isNew(c)).length
  const festigen: StageState = scope.size === 0 ? 'keine' : cards.length > 0 && cards.every((c) => c.reps > 0 && c.due > now) ? 'fertig' : practised > 0 ? 'begonnen' : 'leer'
  const devDone = deviations.filter((d) => p.applied.includes(applyDeviationId(variationId, d.key, d.replyUci))).length
  const puzDone = puzzles.filter((z) => p.applied.includes(applyPuzzleId(z.id))).length
  const puzNeeded = Math.min(MIN_PUZZLES, puzzles.length)
  const sparred = p.applied.includes(applySparringId(variationId))
  const hasContent = deviations.length + puzzles.length > 0
  const complete = devDone === deviations.length && puzDone >= puzNeeded
  // a finished sparring game is the apply proof of a variation that has no deviations or puzzles; otherwise it counts as begun
  const anwenden: StageState = !hasContent ? (sparred ? 'fertig' : 'keine')
    : complete ? 'fertig' : devDone + puzDone + (sparred ? 1 : 0) === 0 ? 'leer' : 'begonnen'
  return { lernen: stageState(rated, keyExplanations.length), verstehen: stageState(understood, questions.length), festigen, anwenden }
}

/** Earliest due time after `now` among practised cards. */
export function earliestFuture(cards: Card[], now: number): number | undefined {
  const times = cards.filter((c) => !isNew(c) && c.due > now).map((c) => c.due)
  return times.length ? Math.min(...times) : undefined
}

/** Adds an id to a progress list once; returns the same array when it is already there. */
export const markOnce = (list: string[], id: string): string[] => (list.includes(id) ? list : [...list, id])
