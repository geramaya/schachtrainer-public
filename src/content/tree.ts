import type { Candidate, ContentBundle, Opening, TreeNode } from './types.ts'
import type { OpeningOverlays } from '../store/overlays.ts'

const NO_TREE: Record<string, TreeNode> = {}

export const treeFor = (b: ContentBundle, openingId: string): Record<string, TreeNode> => b.trees[openingId] ?? NO_TREE

/** Move the user should play: overlay choice (if a known candidate) before active; null if no node or opponent to move. */
export function expectedMove(b: ContentBundle, openingId: string, key: string, ov: OpeningOverlays): Candidate | null {
  const node = treeFor(b, openingId)[key]
  if (!node || !node.ownMove) return null
  const chosen = node.candidates.find((c) => c.uci === ov[openingId]?.[key])
  return chosen ?? node.candidates[node.active] ?? null
}

export function knownReplies(b: ContentBundle, openingId: string, key: string): Candidate[] {
  return treeFor(b, openingId)[key]?.replies ?? []
}

export const openingOfVariation = (b: ContentBundle, variationId: string): Opening | undefined =>
  b.openings.find((o) => o.variations.some((v) => v.id === variationId))

/** Node at `key` in the tree of the variation's opening. */
export function nodeOfVariation(b: ContentBundle, variationId: string, key: string): TreeNode | undefined {
  const o = openingOfVariation(b, variationId)
  return o ? treeFor(b, o.id)[key] : undefined
}

/** Node at `key` in any tree, an own node before an answer node (the fen is the same everywhere). */
export function findNode(b: ContentBundle, key: string): TreeNode | undefined {
  const all = Object.values(b.trees).flatMap((t) => t[key] ?? [])
  return all.find((n) => n.ownMove) ?? all[0]
}
