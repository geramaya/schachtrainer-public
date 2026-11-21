import { isNew } from './srs.ts'
import type { Card } from './srs.ts'

/** Cards from played games that are worth practising now: due ones (oldest first), then never-practised ones. */
export function partieQueue(cards: Card[], now: number): Card[] {
  const mine = cards.filter((c) => c.origin === 'partie')
  const due = mine.filter((c) => !isNew(c) && c.due <= now).sort((a, b) => a.due - b.due)
  return [...due, ...mine.filter(isNew)]
}
