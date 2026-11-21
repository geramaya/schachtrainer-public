import { test } from 'node:test'
import assert from 'node:assert/strict'
import { schedule, dueCards, newCards, cardsForBundle, syncCards, cardId } from '../src/train/srs.ts'
import { migrateProgress } from '../src/store/migrate.ts'
import { emptyProgress } from '../src/store/progress.ts'
import type { Card } from '../src/train/srs.ts'
import { lineBundle, keyAfter } from './helpers.ts'

const DAY = 86_400_000
const card = (over: Partial<Card> = {}): Card => ({ openingId: 'scotch', key: 'k', expectedUci: 'e2e4', variationId: 'v1', due: 0, intervalDays: 0, ease: 2.5, reps: 0, lapses: 0, contentVersion: 'c1', origin: 'baum', ...over })

test('gut gives the interval sequence 1, 3, 8 days at ease 2.5', () => {
  const now = 1_000_000
  let c = schedule(card(), 'gut', now)
  assert.equal(c.intervalDays, 1); assert.equal(c.due, now + DAY)
  c = schedule(c, 'gut', c.due); assert.equal(c.intervalDays, 3)
  const third = c.due + 0
  c = schedule(c, 'gut', third); assert.equal(c.intervalDays, 8); assert.equal(c.due, third + 8 * DAY)
  assert.equal(c.reps, 3)
})

test('nochmal: due in 10 minutes, interval 0, ease -0.2 but not below 1.3, lapses+1', () => {
  const now = 5_000
  const c = schedule(card({ intervalDays: 8, ease: 2.5, reps: 3 }), 'nochmal', now)
  assert.equal(c.due, now + 600_000); assert.equal(c.intervalDays, 0); assert.equal(c.ease, 2.3); assert.equal(c.lapses, 1)
  assert.equal(schedule(card({ ease: 1.4 }), 'nochmal', now).ease, 1.3)
})

test('gut on a card that is not due yet leaves the plan unchanged; nochmal always counts', () => {
  const c = card({ due: 10_000, intervalDays: 3, reps: 2 })
  assert.deepEqual(schedule(c, 'gut', 5_000), c)
  const missed = schedule(c, 'nochmal', 5_000)
  assert.equal(missed.lapses, 1); assert.equal(missed.due, 5_000 + 600_000)
})

test('dueCards: only practised cards that are due, optionally within a card-id scope, sorted by due', () => {
  const cs = [card({ key: 'a', due: 300, reps: 1 }), card({ key: 'b', due: 100, reps: 1 }), card({ key: 'c', due: 900, reps: 1 }), card({ key: 'd', due: 50, lapses: 1 }), card({ key: 'n' })]
  assert.deepEqual(dueCards(cs, 500).map((c) => c.key), ['d', 'b', 'a'])
  assert.deepEqual(dueCards(cs, 500, new Set(['scotch:b', 'scotch:a'])).map((c) => c.key), ['b', 'a'])
})

test('newCards: never practised cards, not counted as due', () => {
  const cs = [card({ key: 'n1' }), card({ key: 'old', reps: 2 }), card({ key: 'n2' })]
  assert.deepEqual(newCards(cs).map((c) => c.key), ['n1', 'n2'])
  assert.deepEqual(newCards(cs, new Set(['scotch:n2'])).map((c) => c.key), ['n2'])
  assert.equal(dueCards([card({ key: 'n1' })], 500).length, 0)
})

test('cardsForBundle: one card per own node of the whole bundle, expected move from the node', () => {
  const b = lineBundle(['e4', 'e5', 'Nf3'])
  const cs = cardsForBundle(b, {})
  assert.deepEqual(cs.map((c) => [c.expectedUci, c.origin, c.ease]), [['e2e4', 'baum', 2.5], ['g1f3', 'baum', 2.5]])
  assert.equal(cs[1]!.key, keyAfter(['e4', 'e5']))
})

test('cardsForBundle: a transposed position appears only once', () => {
  const b = lineBundle(['Nf3', 'Nf6', 'Ng1', 'Ng8', 'e4'])
  const keys = cardsForBundle(b, {}).map((c) => c.key)
  assert.equal(new Set(keys).size, keys.length)
  assert.equal(keys.filter((k) => k === keyAfter([])).length, 1)
})

test('cardsForBundle: overlay changes the expected move', () => {
  const b = lineBundle(['e4', 'e5'])
  const cs = cardsForBundle(b, { scotch: { [keyAfter([])]: 'e2e4' } })
  assert.equal(cs[0]!.expectedUci, 'e2e4')
})

test('syncCards resets a card when expectedUci changes, but keeps progress on a mere new contentVersion', () => {
  const old = { 'scotch:k': card({ intervalDays: 8, reps: 3, expectedUci: 'e2e4', contentVersion: 'c1' }) }
  const kept = syncCards(old, [card({ expectedUci: 'e2e4', contentVersion: 'c2' })])
  assert.equal(kept['scotch:k']!.reps, 3); assert.equal(kept['scotch:k']!.intervalDays, 8); assert.equal(kept['scotch:k']!.contentVersion, 'c2')
  const reset = syncCards(old, [card({ expectedUci: 'd2d4', contentVersion: 'c1' })])
  assert.equal(reset['scotch:k']!.reps, 0); assert.equal(reset['scotch:k']!.expectedUci, 'd2d4')
})

test('syncCards adds new cards and leaves game cards alone', () => {
  const out = syncCards({ 'scotch:x': card({ key: 'x', origin: 'partie' }) }, [card({ key: 'y' })])
  assert.deepEqual(Object.keys(out).sort(), ['scotch:x', 'scotch:y'])
})

test('cardsForBundle: the same position in two openings gives two cards with the opening id in the card id', () => {
  const a = lineBundle(['e4', 'e5', 'Nf3', 'Nc6', 'd4'], true, {}, 5, 'scotch', 'v1')
  const b = lineBundle(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'], true, {}, 5, 'italian', 'v2')
  a.openings.push(b.openings[0]!); a.trees.italian = b.trees.italian!
  const cs = cardsForBundle(a, {})
  const forkKey = keyAfter(['e4', 'e5', 'Nf3', 'Nc6'])
  const fork = cs.filter((c) => c.key === forkKey)
  assert.deepEqual(fork.map((c) => [c.openingId, c.expectedUci]).sort(), [['italian', 'f1c4'], ['scotch', 'd2d4']])
  assert.deepEqual(fork.map((c) => cardId(c)).sort(), [`italian:${forkKey}`, `scotch:${forkKey}`])
  assert.equal(cs.find((c) => c.openingId === 'italian' && c.key === keyAfter([]))!.variationId, 'v2')
})


/** Bundle whose tree has one own-move node that no variation line or its subtree reaches (an orphan branch). */
function bundleWithOrphan() {
  const b = lineBundle(['e4', 'e5', 'Nf3'])
  const alt = lineBundle(['e4', 'c5', 'Nf3'])
  const orphanKey = keyAfter(['e4', 'c5'])
  b.trees.scotch![orphanKey] = alt.trees.scotch![orphanKey]!
  return { b, orphanKey }
}

test('cardsForBundle: a node outside every variation scope gets no card', () => {
  const { b, orphanKey } = bundleWithOrphan()
  const cs = cardsForBundle(b, {})
  assert.equal(cs.some((c) => c.key === orphanKey), false)
  assert.ok(cs.length > 0 && cs.every((c) => c.variationId !== ''))
})

test('syncCards removes tree cards that no fresh card matches, even practised ones; game cards stay', () => {
  const stored = {
    'scotch:gone': card({ key: 'gone', reps: 2, due: 10 }),
    'scotch:kept': card({ key: 'kept', reps: 2, intervalDays: 3 }),
    'scotch:game': card({ key: 'game', origin: 'partie', reps: 1 }),
  }
  const out = syncCards(stored, [card({ key: 'kept' })])
  assert.deepEqual(Object.keys(out).sort(), ['scotch:game', 'scotch:kept'])
  assert.equal(out['scotch:kept']!.intervalDays, 3)
})

test('migration of an old state: progress on cards that exist in a variation survives, orphan cards vanish', () => {
  const { b, orphanKey } = bundleWithOrphan()
  const liveKey = keyAfter([])
  const p = emptyProgress()
  p.cards = {
    [`scotch:${liveKey}`]: card({ key: liveKey, expectedUci: 'e2e4', reps: 4, intervalDays: 8, due: 77 }),
    [`scotch:${orphanKey}`]: card({ key: orphanKey, expectedUci: 'g1f3', reps: 2, due: 1 }),
    'scotch:vanished': card({ key: 'vanished', reps: 1, due: 1 }),
  }
  const m = migrateProgress(p, b)
  const synced = syncCards(m.cards, cardsForBundle(b, m.overlays))
  assert.deepEqual(Object.keys(synced).filter((k) => synced[k]!.origin === 'baum').includes(`scotch:${orphanKey}`), false)
  assert.equal(synced['scotch:vanished'], undefined)
  assert.equal(synced[`scotch:${liveKey}`]!.reps, 4)
  assert.equal(synced[`scotch:${liveKey}`]!.due, 77)
})

test('cardsForBundle: computed once per bundle and overlay state; callers get their own card objects', () => {
  const b = lineBundle(['e4', 'e5', 'Nf3'])
  let reads = 0
  const trees = b.trees
  Object.defineProperty(b, 'trees', { get() { reads++; return trees }, configurable: true })
  const first = cardsForBundle(b, {})
  const after = reads
  const second = cardsForBundle(b, {})
  assert.equal(reads, after)
  assert.deepEqual(second, first)
  first[0]!.reps = 99 // a caller changing its copy must not poison the cache
  assert.equal(cardsForBundle(b, {})[0]!.reps, 0)
})

test('schwer: counts as success but with a shorter interval than gut and ease -0.15; never beyond gut', () => {
  const now = 1_000_000
  const c = card({ intervalDays: 8, ease: 2.5, reps: 3, due: 0 })
  const hard = schedule(c, 'schwer', now), good = schedule(c, 'gut', now)
  assert.equal(hard.intervalDays, 10); assert.equal(good.intervalDays, 20)
  assert.equal(hard.due, now + 10 * DAY); assert.equal(hard.ease, 2.35); assert.equal(hard.reps, 4); assert.equal(hard.lapses, 0)
  assert.equal(schedule(card({ ease: 1.35 }), 'schwer', now).ease, 1.3)
  assert.equal(schedule(card(), 'schwer', now).intervalDays, 1)
  assert.deepEqual(schedule(card({ due: 10_000, intervalDays: 3 }), 'schwer', 5_000), card({ due: 10_000, intervalDays: 3 }))
})
