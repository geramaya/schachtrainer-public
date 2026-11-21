import type { ContentBundle, Opening } from '../content/types.ts'
import { treeFor } from '../content/tree.ts'
import { cardKey } from '../train/card-id.ts'
import type { Card } from '../train/srs.ts'
import type { OpeningOverlays } from './overlays.ts'
import type { Progress } from './progress.ts'

type LegacyCard = Omit<Card, 'openingId'> & { openingId?: string }

/** A game card needs no tree node (it carries its move): its variation's opening, else the openings of the side to move that know the position, else the first opening of that side. */
function partieTargets(c: LegacyCard, b: ContentBundle): Opening[] {
  const byVariation = b.openings.filter((o) => o.variations.some((v) => v.id === c.variationId))
  if (byVariation.length > 0) return byVariation
  const side = c.key.split(' ')[1] === 'b' ? 'black' : 'white'
  const sameSide = b.openings.filter((o) => o.side === side)
  const knowing = sameSide.filter((o) => treeFor(b, o.id)[c.key])
  return knowing.length > 0 ? knowing : sameSide.slice(0, 1)
}

/**
 * Brings an older stored state to per-opening cards and overlays (needs the bundle to know who owns a position).
 * Legacy tree cards (id = position key) are copied to every opening whose tree has that position as an own node,
 * legacy game cards go to the opening of their variation (else by side and position, see partieTargets); entries that no opening can take are counted and reported once with console.warn.
 * Legacy overlays are grouped "white"/"black" and go to the openings of that side that own the position.
 * Idempotent: migrated entries are never touched.
 */
export function migrateProgress(p: Progress, b: ContentBundle): Progress {
  const cards: Record<string, Card> = {}
  let dropped = 0
  const legacy: LegacyCard[] = []
  for (const [id, c] of Object.entries(p.cards as Record<string, LegacyCard>)) {
    if (c.openingId !== undefined) cards[id] = c as Card
    else legacy.push(c)
  }
  for (const c of legacy) {
    const own = b.openings.filter((o) => treeFor(b, o.id)[c.key]?.ownMove)
    const targets = c.origin === 'partie' ? partieTargets(c, b) : own
    if (targets.length === 0) dropped++
    for (const o of targets) cards[cardKey(o.id, c.key)] ??= { ...c, openingId: o.id }
  }
  const overlays: OpeningOverlays = {}
  const add = (openingId: string, key: string, uci: string) => { (overlays[openingId] ??= {})[key] = uci }
  for (const [group, map] of Object.entries(p.overlays)) {
    if (group !== 'white' && group !== 'black') {
      for (const [key, uci] of Object.entries(map)) add(group, key, uci)
      continue
    }
    for (const o of b.openings.filter((x) => x.side === group)) {
      for (const [key, uci] of Object.entries(map)) if (treeFor(b, o.id)[key]?.ownMove) add(o.id, key, uci)
    }
  }
  if (dropped > 0) console.warn(`${dropped} alte Karte(n) konnten keiner Eröffnung zugeordnet werden und wurden entfernt`)
  return { ...p, cards, overlays }
}
