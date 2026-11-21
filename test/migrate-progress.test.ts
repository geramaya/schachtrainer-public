import { test } from 'node:test'
import assert from 'node:assert/strict'
import { migrateProgress } from '../src/store/migrate.ts'
import { emptyProgress } from '../src/store/progress.ts'
import { cardId } from '../src/train/srs.ts'
import type { Card } from '../src/train/srs.ts'
import { lineBundle, keyAfter } from './helpers.ts'

const fork = keyAfter(['e4', 'e5', 'Nf3', 'Nc6'])
const start = keyAfter([])
const bundle = (() => {
  const scotch = lineBundle(['e4', 'e5', 'Nf3', 'Nc6', 'd4'], true, {}, 5, 'scotch', 'v-sco')
  const italian = lineBundle(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'], true, {}, 5, 'italian', 'v-ita')
  const caro = lineBundle(['e4', 'c6', 'd4', 'd5'], false, {}, 4, 'caro-kann', 'v-ck')
  scotch.openings.push(italian.openings[0]!, caro.openings[0]!)
  scotch.trees.italian = italian.trees.italian!
  scotch.trees['caro-kann'] = caro.trees['caro-kann']!
  return scotch
})()
const legacy = (key: string, over: Partial<Card> = {}) => ({ key, expectedUci: 'e2e4', variationId: 'v-sco', due: 5, intervalDays: 3, ease: 2.1, reps: 2, lapses: 1, contentVersion: 'c0', origin: 'baum', ...over }) as Card

test('a legacy card goes to every opening that owns the position, keeping its schedule', () => {
  const p = { ...emptyProgress(), cards: { [fork]: legacy(fork) } }
  const m = migrateProgress(p, bundle)
  assert.deepEqual(Object.keys(m.cards).sort(), [`italian:${fork}`, `scotch:${fork}`])
  assert.equal(m.cards[`italian:${fork}`]!.openingId, 'italian')
  assert.equal(m.cards[`scotch:${fork}`]!.reps, 2)
  assert.equal(m.cards[`scotch:${fork}`]!.intervalDays, 3)
})

test('a legacy card on a position that is only an answer node in one opening goes to the owners only', () => {
  const p = { ...emptyProgress(), cards: { [start]: legacy(start) } }
  assert.deepEqual(Object.keys(migrateProgress(p, bundle).cards).sort(), [`italian:${start}`, `scotch:${start}`])
})

test('a legacy partie card belongs to the opening of its variation', () => {
  const k = keyAfter(['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4']) // not in any tree
  const p = { ...emptyProgress(), cards: { [k]: legacy(k, { origin: 'partie', variationId: 'v-ita' }) } }
  assert.deepEqual(Object.keys(migrateProgress(p, bundle).cards), [`italian:${k}`])
})

test('a partie card whose variation is gone goes to the opening of the side to move that knows the position, else the first of that side', () => {
  const known = keyAfter(['e4', 'c6']) // white to move; only caro-kann (black) has it, but white openings: scotch has no node here
  const own = keyAfter(['e4', 'e5', 'Nf3', 'Nc6']) // white to move, known by scotch and italian
  const blackFree = keyAfter(['d4']) // black to move, no tree knows it: first black opening
  const p = { ...emptyProgress(), cards: {
    [own]: legacy(own, { origin: 'partie', variationId: 'gone' }),
    [blackFree]: legacy(blackFree, { origin: 'partie', variationId: 'gone' }),
    [known]: legacy(known, { origin: 'partie', variationId: 'gone' }),
  } }
  const m = migrateProgress(p, bundle)
  assert.deepEqual(Object.keys(m.cards).sort(), [`caro-kann:${blackFree}`, `italian:${own}`, `scotch:${known}`, `scotch:${own}`].sort())
  assert.equal(m.cards[`scotch:${known}`]!.expectedUci, 'e2e4') // schedule and move are kept
  assert.equal(m.cards[`scotch:${known}`]!.reps, 2)
})

test('dropped legacy entries are counted and reported once, never silently', (t) => {
  const warn = t.mock.method(console, 'warn', () => {})
  const p = { ...emptyProgress(), cards: { y: legacy('y'), z: legacy('z') } } // tree cards on positions no opening owns
  assert.deepEqual(migrateProgress(p, bundle).cards, {})
  assert.equal(warn.mock.callCount(), 1)
  assert.match(String(warn.mock.calls[0]!.arguments[0]), /2 /)
  warn.mock.resetCalls()
  migrateProgress(emptyProgress(), bundle)
  assert.equal(warn.mock.callCount(), 0)
})

test('already migrated cards are untouched and migration is idempotent', () => {
  const done = { ...legacy(fork), openingId: 'scotch' }
  const p = { ...emptyProgress(), cards: { [cardId(done)]: done, [fork]: legacy(fork) } }
  const m = migrateProgress(p, bundle)
  assert.equal(m.cards[`scotch:${fork}`], done)
  assert.deepEqual(migrateProgress(m, bundle), m)
})

test('legacy white/black overlays go to the openings of that side that own the position', () => {
  const p = { ...emptyProgress(), overlays: { white: { [fork]: 'f1c4', [start]: 'd2d4' }, black: { [keyAfter(['e4'])]: 'c7c5' } } }
  const m = migrateProgress(p, bundle)
  assert.deepEqual(m.overlays, { scotch: { [fork]: 'f1c4', [start]: 'd2d4' }, italian: { [fork]: 'f1c4', [start]: 'd2d4' }, 'caro-kann': { [keyAfter(['e4'])]: 'c7c5' } })
})

test('overlays of a position no opening of that side owns are dropped; per-opening overlays stay', () => {
  const p = { ...emptyProgress(), overlays: { white: { nope: 'e2e4' }, scotch: { [fork]: 'd2d4' } } }
  assert.deepEqual(migrateProgress(p, bundle).overlays, { scotch: { [fork]: 'd2d4' } })
})
