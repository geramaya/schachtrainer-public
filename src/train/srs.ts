import type { ContentBundle } from '../content/types.ts'
import { expectedMove, treeFor } from '../content/tree.ts'
import { cardId, cardKey } from './card-id.ts'
import type { OpeningOverlays } from '../store/overlays.ts'
import { memoByBundle, variationScopes } from './scope.ts'

export { cardId }

export interface Card {
  openingId: string; key: string; expectedUci: string; variationId: string; due: number; intervalDays: number
  ease: number; reps: number; lapses: number; contentVersion: string; origin: 'baum' | 'partie'
}

const DAY = 86_400_000
const RETRY_MS = 10 * 60_000
const START_EASE = 2.5
const MIN_EASE = 1.3

export function schedule(c: Card, grade: 'nochmal' | 'gut' | 'schwer', now: number): Card {
  if (grade === 'nochmal') {
    return { ...c, due: now + RETRY_MS, intervalDays: 0, ease: Math.max(MIN_EASE, Math.round((c.ease - 0.2) * 100) / 100), lapses: c.lapses + 1 }
  }
  if (c.due > now) return c // practising ahead of schedule does not move the plan
  if (grade === 'schwer') { // solved with a hint: still a success, but slower growth and lower ease
    const intervalDays = c.intervalDays === 0 ? 1 : Math.max(1, Math.round(c.intervalDays * 1.2))
    return { ...c, intervalDays, due: now + intervalDays * DAY, reps: c.reps + 1, ease: Math.max(MIN_EASE, Math.round((c.ease - 0.15) * 100) / 100) }
  }
  const intervalDays = c.intervalDays === 0 ? 1 : c.intervalDays === 1 ? 3 : Math.round(c.intervalDays * c.ease)
  return { ...c, intervalDays, due: now + intervalDays * DAY, reps: c.reps + 1 }
}

/** Cards that can be practised: game cards, and tree cards that some variation owns (others count nowhere). */
export const trainableCards = (cards: Card[]): Card[] => cards.filter((c) => c.origin === 'partie' || c.variationId !== '')

/** A card never practised: neither a success nor a lapse yet. */
export const isNew = (c: Card): boolean => c.reps === 0 && c.lapses === 0

/** Practised cards that are due, optionally limited to a set of card ids; new cards are not "due". */
export function dueCards(cards: Card[], now: number, scope?: Set<string>): Card[] {
  return cards.filter((c) => !isNew(c) && c.due <= now && (!scope || scope.has(cardId(c)))).sort((a, b) => a.due - b.due)
}

export function newCards(cards: Card[], scope?: Set<string>): Card[] {
  return cards.filter((c) => isNew(c) && (!scope || scope.has(cardId(c))))
}

/** One new card per own-move node of every opening (by position key, so transpositions count once per opening). */
const freshCards = memoByBundle((b, ov): Card[] => {
  const owner = new Map<string, string>()
  for (const [vid, keys] of variationScopes(b, ov)) for (const k of keys) if (!owner.has(k)) owner.set(k, vid)
  const out: Card[] = []
  for (const o of b.openings) for (const node of Object.values(treeFor(b, o.id))) {
    const expected = node.ownMove ? expectedMove(b, o.id, node.key, ov) : null
    const variationId = owner.get(cardKey(o.id, node.key))
    if (!expected || !variationId) continue // a node no variation trains is not a card
    out.push({ openingId: o.id, key: node.key, expectedUci: expected.uci, variationId, due: 0, intervalDays: 0, ease: START_EASE, reps: 0, lapses: 0, contentVersion: b.contentVersion, origin: 'baum' })
  }
  return out
})

/** Computed once per bundle and overlay state; every caller gets its own card objects. */
export const cardsForBundle = (b: ContentBundle, ov: OpeningOverlays): Card[] => freshCards(b, ov).map((c) => ({ ...c }))

/**
 * Merges fresh cards into stored ones (by card id): reset only if expectedUci changed; a new contentVersion alone keeps the progress.
 * Tree cards without a fresh counterpart (orphaned or outdated by a rebuild) are dropped; game cards never are.
 */
export function syncCards(existing: Record<string, Card>, fresh: Card[]): Record<string, Card> {
  const out = Object.fromEntries(Object.entries(existing).filter(([, c]) => c.origin === 'partie'))
  for (const f of fresh) {
    const id = cardId(f)
    const old = existing[id]
    out[id] = old && old.expectedUci === f.expectedUci ? { ...old, contentVersion: f.contentVersion, ...(old.origin === 'baum' ? { variationId: f.variationId } : {}) } : f
  }
  return out
}
