import { test } from 'node:test'
import assert from 'node:assert/strict'
import { migrateOverlays } from '../src/store/overlays.ts'
import { importProgress, emptyProgress, exportProgress } from '../src/store/progress.ts'

const W = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -'
const B = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -'

test('migrateOverlays sorts old flat overlays by the side to move into the legacy white/black groups', () => {
  assert.deepEqual(migrateOverlays({ [W]: 'd2d4', [B]: 'c7c5' }), { white: { [W]: 'd2d4' }, black: { [B]: 'c7c5' } })
})

test('migrateOverlays keeps the per-opening form as it is', () => {
  assert.deepEqual(migrateOverlays({ scotch: { [W]: 'd2d4' }, italian: {} }), { scotch: { [W]: 'd2d4' }, italian: {} })
  assert.deepEqual(migrateOverlays({}), {})
})

test('migrateOverlays rejects garbage', () => {
  assert.throws(() => migrateOverlays({ [W]: 5 }))
  assert.throws(() => migrateOverlays({ scotch: { [W]: 5 } }))
  assert.throws(() => migrateOverlays(null))
})

test('importProgress accepts a schema-1 file with flat overlays (grouped as legacy white/black until the bundle is known)', () => {
  const old = JSON.stringify({ schema: 1, cards: {}, overlays: { [W]: 'd2d4' }, feedback: {}, settings: { sparringElo: 1500 } })
  assert.deepEqual(importProgress(old).overlays, { white: { [W]: 'd2d4' }, black: {} })
})

test('exported progress round-trips with per-opening overlays', () => {
  const p = { ...emptyProgress(), overlays: { scotch: { [W]: 'd2d4' }, 'caro-kann': { [B]: 'c7c5' } } }
  assert.deepEqual(importProgress(exportProgress(p)).overlays, p.overlays)
})
