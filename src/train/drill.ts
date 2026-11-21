import type { Candidate, ContentBundle } from '../content/types.ts'
import { expectedMove, knownReplies, openingOfVariation, treeFor } from '../content/tree.ts'
import { applyUci } from '../chess/game.ts'
import { positionKey } from '../chess/position.ts'
import { lineKeys } from './scope.ts'
import { Chess } from 'chess.js'
import type { OpeningOverlays } from '../store/overlays.ts'

const MAX_DEPTH = 40

/** True if following the book from `key` (own side: expected move, opponent: any known reply) reaches an own node with a due card. */
function reachesDue(b: ContentBundle, openingId: string, key: string, due: Set<string>, ov: OpeningOverlays, seen: Set<string>, depth: number): boolean {
  if (depth > MAX_DEPTH || seen.has(key)) return false
  seen.add(key)
  const node = treeFor(b, openingId)[key]
  if (!node) return false
  if (node.ownMove && due.has(key)) return true
  const moves = node.ownMove ? [expectedMove(b, openingId, key, ov)].filter((m): m is Candidate => m !== null) : knownReplies(b, openingId, key)
  return moves.some((m) => {
    const next = applyUci(node.fen, m.uci)
    return next !== null && reachesDue(b, openingId, positionKey(next.fen), due, ov, seen, depth + 1)
  })
}

/** Opponent reply for the drill: random among known replies, preferring branches that lead to due cards; null = out of book. */
export function pickReply(b: ContentBundle, openingId: string, key: string, due: Set<string>, ov: OpeningOverlays, rng: () => number): Candidate | null {
  const replies = knownReplies(b, openingId, key)
  if (replies.length === 0) return null
  const node = treeFor(b, openingId)[key]!
  const preferred = replies.filter((r) => {
    const next = applyUci(node.fen, r.uci)
    return next !== null && reachesDue(b, openingId, positionKey(next.fen), due, ov, new Set([key]), 1)
  })
  const pool = preferred.length ? preferred : replies
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))]!
}
/** Opponent move for the drill of one variation: follow its line to the end, then pick in the book subtree; null = nothing more to play (also for a broken SAN in the line). */
export function opponentMove(b: ContentBundle, variationId: string, key: string, due: Set<string>, ov: OpeningOverlays, rng: () => number): Candidate | null {
  const variation = b.openings.flatMap((o) => o.variations).find((v) => v.id === variationId)
  const openingId = openingOfVariation(b, variationId)?.id
  const node = openingId ? treeFor(b, openingId)[key] : undefined
  try {
    const idx = lineKeys(b, variationId).indexOf(key)
    if (variation && node && idx >= 0 && idx < variation.line.length) {
      const m = new Chess(node.fen).move(variation.line[idx]!)
      return { uci: m.from + m.to + (m.promotion ?? ''), san: m.san, evalCp: null, source: { kind: 'autor', ref: 'variation line' } }
    }
  } catch {
    return null // invalid SAN in the content: stop the drill instead of crashing
  }
  return openingId ? pickReply(b, openingId, key, due, ov, rng) : null
}

/** True if `key` lies inside the variation line (not at its end): the drill stopping here means the content is incomplete, not that the user is done. */
export function isLineIncomplete(b: ContentBundle, variationId: string, key: string): boolean {
  const variation = b.openings.flatMap((o) => o.variations).find((v) => v.id === variationId)
  let idx = -1
  try { idx = lineKeys(b, variationId).indexOf(key) } catch { return true }
  return !!variation && idx >= 0 && idx < variation.line.length
}
