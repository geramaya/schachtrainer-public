import type { ContentBundle } from '../../src/content/types.ts'

/**
 * A build of selected openings (`--only`) must not discard the others: the rebuilt openings replace their old
 * versions, everything else of the existing bundle stays (each opening owns its tree, so the rebuilt ones replace theirs).
 * Content of the existing bundle is only available for the other openings in so far as it was built before.
 */
export function mergeIntoExisting(built: ContentBundle, existing: ContentBundle | null, rebuilt: string[]): ContentBundle {
  if (!existing) return built
  const keep = existing.openings.filter((o) => !rebuilt.includes(o.id))
  const keptVariations = new Set(keep.flatMap((o) => o.variations.map((v) => v.id)))
  const isKept = (id: string) => keep.some((o) => id.startsWith(`${o.id}/`))
  const builtIds = new Map(built.openings.map((o) => [o.id, o]))
  const order = [...existing.openings.map((o) => o.id), ...built.openings.map((o) => o.id)].filter((id, i, a) => a.indexOf(id) === i)
  const trees = { ...Object.fromEntries(Object.entries(existing.trees).filter(([id]) => keep.some((o) => o.id === id))), ...built.trees }
  return {
    schemaVersion: built.schemaVersion,
    contentVersion: built.contentVersion,
    openings: order.map((id) => builtIds.get(id) ?? keep.find((o) => o.id === id)!),
    trees,
    explanations: [...existing.explanations.filter((e) => isKept(e.id)), ...built.explanations],
    questions: [...existing.questions.filter((q) => isKept(q.id)), ...built.questions],
    deviations: [...existing.deviations.filter((d) => isKept(d.explanationId)), ...built.deviations],
    puzzles: { ...Object.fromEntries(Object.entries(existing.puzzles).filter(([id]) => keptVariations.has(id) || isKept(id))), ...built.puzzles },
  }
}
