import type { Variation } from './types.ts'

export interface VariationGroup { main: Variation; /** variations that are only a stage of `main` (partOf, followed to the root) */ stages: Variation[] }

/**
 * Groups variations for the opening page: one entry per main variation, its stages (partOf) listed under it.
 * partOf points from the generically named variation to the more specifically named one with the same line (or whose first part it is).
 * A stage whose target is missing, or which sits in a cycle, stays an entry of its own. Document variations first, otherwise the given order.
 */
export function groupVariations(variations: Variation[]): VariationGroup[] {
  const byId = new Map(variations.map((x) => [x.id, x]))
  const rootOf = (x: Variation): Variation | null => {
    const seen = new Set<string>([x.id])
    let cur = x
    while (cur.partOf) {
      const next = byId.get(cur.partOf)
      if (!next) return cur === x ? null : cur
      if (seen.has(next.id)) return null
      seen.add(next.id)
      cur = next
    }
    return cur
  }
  const roots = new Map<string, Variation>()
  const stageOf = new Map<string, Variation[]>()
  for (const x of variations) {
    const r = x.partOf ? rootOf(x) : x
    if (!r || r.id === x.id) { roots.set(x.id, x); continue }
    stageOf.set(r.id, [...(stageOf.get(r.id) ?? []), x])
  }
  const mains = [...roots.values()]
  const ordered = [...mains.filter((x) => x.fromDocument), ...mains.filter((x) => !x.fromDocument)]
  return ordered.map((main) => ({ main, stages: stageOf.get(main.id) ?? [] }))
}
