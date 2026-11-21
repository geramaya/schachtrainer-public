import type { ContentBundle } from '../content/types.ts'
import { nodeOfVariation, openingOfVariation } from '../content/tree.ts'
import type { Progress } from '../store/progress.ts'
import { applyDeviationId, applyPuzzleId } from './pipeline.ts'
import { planTraining } from './plan.ts'
import type { TrainingPlan } from './plan.ts'
import { trainableCards } from './srs.ts'

/** Puzzle pools are keyed by variation id or "<opening id>/allgemein". */
const openingOfPool = (b: ContentBundle, key: string): string | undefined => (key.includes('/') ? key.split('/')[0] : openingOfVariation(b, key)?.id)

/** The ten-minute plan from the bundle and the stored progress. */
export function trainingPlanFor(b: ContentBundle, p: Progress, now: number): TrainingPlan {
  const puzzles = Object.entries(b.puzzles).flatMap(([key, list]) => {
    const openingId = openingOfPool(b, key)
    return openingId ? list.map((z) => ({ id: z.id, openingId, rating: z.rating })) : []
  })
  const deviations = b.deviations.flatMap((d) => {
    const openingId = openingOfVariation(b, d.variationId)?.id
    return openingId && nodeOfVariation(b, d.variationId, d.key) ? [{ id: applyDeviationId(d.variationId, d.key, d.replyUci), variationId: d.variationId, openingId }] : []
  })
  const done = new Set([...puzzles.filter((z) => p.applied.includes(applyPuzzleId(z.id))).map((z) => z.id), ...deviations.filter((d) => p.applied.includes(d.id)).map((d) => d.id)])
  return planTraining({ now, cards: trainableCards(Object.values(p.cards)), lastVariationId: p.settings.lastCourse?.variationId, puzzles, deviations, done })
}
