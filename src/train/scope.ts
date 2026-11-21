import { Chess } from 'chess.js'
import { positionKey } from '../chess/position.ts'
import { applyUci } from '../chess/game.ts'
import type { Candidate, ContentBundle } from '../content/types.ts'
import { cardKey } from './card-id.ts'
import { expectedMove, knownReplies, openingOfVariation, treeFor } from '../content/tree.ts'
import type { OpeningOverlays } from '../store/overlays.ts'

const MAX_DEPTH = 60

/** Position keys after 0..n plies of the variation line. */
export function lineKeys(b: ContentBundle, variationId: string): string[] {
  const variation = b.openings.flatMap((o) => o.variations).find((v) => v.id === variationId)
  if (!variation) return []
  const chess = new Chess()
  const keys = [positionKey(chess.fen())]
  for (const san of variation.line) { chess.move(san); keys.push(positionKey(chess.fen())) }
  return keys
}

/** Own-move keys on the line plus those in the book subtree below its end (own: expected move, opponent: all known replies). */
export function keysForVariation(b: ContentBundle, variationId: string, ov: OpeningOverlays): Set<string> {
  const line = lineKeys(b, variationId)
  const out = new Set<string>()
  const openingId = openingOfVariation(b, variationId)?.id
  if (!openingId) return out
  for (const key of line) if (expectedMove(b, openingId, key, ov)) out.add(key)
  const seen = new Set<string>()
  const walk = (key: string, depth: number) => {
    if (depth > MAX_DEPTH || seen.has(key)) return
    seen.add(key)
    const node = treeFor(b, openingId)[key]
    if (!node) return
    const exp = node.ownMove ? expectedMove(b, openingId, key, ov) : null
    if (exp) out.add(key)
    const moves: Candidate[] = node.ownMove ? (exp ? [exp] : []) : knownReplies(b, openingId, key)
    for (const m of moves) {
      const next = applyUci(node.fen, m.uci)
      if (next) walk(positionKey(next.fen), depth + 1)
    }
  }
  if (line.length) walk(line[line.length - 1]!, 0)
  return out
}

/** Card ids of the own moves a variation trains. */
export const cardScope = (b: ContentBundle, variationId: string, ov: OpeningOverlays): Set<string> => variationScopes(b, ov).get(variationId) ?? new Set()

/**
 * Memoises a derivation that depends only on the bundle and the overlay state (not on learning progress):
 * one result per bundle object and overlay content. The bundle is held weakly, so a reloaded bundle drops its entries.
 */
export function memoByBundle<T>(compute: (b: ContentBundle, ov: OpeningOverlays) => T): (b: ContentBundle, ov: OpeningOverlays) => T {
  const cache = new WeakMap<ContentBundle, Map<string, T>>()
  return (b, ov) => {
    const perBundle = cache.get(b) ?? new Map<string, T>()
    cache.set(b, perBundle)
    const key = JSON.stringify(ov)
    if (!perBundle.has(key)) perBundle.set(key, compute(b, ov))
    return perBundle.get(key) as T
  }
}

/** Own-move card ids per variation. Walks the whole tree, so it is computed once per bundle and overlay state. */
export const variationScopes = memoByBundle((b, ov) => {
  const out = new Map<string, Set<string>>()
  for (const v of b.openings.flatMap((o) => o.variations)) {
    const openingId = openingOfVariation(b, v.id)?.id
    out.set(v.id, new Set(openingId ? [...keysForVariation(b, v.id, ov)].map((k) => cardKey(openingId, k)) : []))
  }
  return out
})
