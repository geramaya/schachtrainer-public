import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkMove, isOwnPly, nextOwnPly } from '../src/lehrgang/loop.ts'
import { LEHRGANG_KEY, emptyState, exportState, importState, loadState, markFalle, markStep, saveState, stufeFortschritt } from '../src/lehrgang/store.ts'
import { TODO } from '../src/lehrgang/types.ts'
import type { Lehrgang, Variante } from '../src/lehrgang/types.ts'

const z = (san: string, uci: string, satz = TODO) => ({ san, uci, satz })
const v = (id: string, stufe: Variante['stufe'] = 'kern'): Variante => ({
  id, name: id, stufe, anteil: 0.3, haeufigkeit: 'etwa 3 von 10', vorlaeufig: false, veraltet: false, ziel: [],
  zuege: [z('e4', 'e2e4', 'Zentrum besetzen.'), z('e5', 'e7e5'), z('Nf3', 'g1f3', 'Der Springer greift e5 an.'), z('Nc6', 'b8c6')],
})

test('isOwnPly: white moves on even plies, black on odd ones; nextOwnPly skips the opponent moves and ends at the line end', () => {
  assert.equal(isOwnPly('white', 0), true)
  assert.equal(isOwnPly('white', 1), false)
  assert.equal(isOwnPly('black', 1), true)
  assert.equal(nextOwnPly('white', v('a'), 1), 2)
  assert.equal(nextOwnPly('white', v('a'), 3), null)
  assert.equal(nextOwnPly('black', v('a'), 0), 1)
})

test('checkMove accepts the repertoire move and answers a wrong move with the expected move', () => {
  assert.deepEqual(checkMove(v('a'), 2, 'g1f3'), { ok: true })
  assert.deepEqual(checkMove(v('a'), 2, 'd2d4'), { ok: false, erwartet: { san: 'Nf3', uci: 'g1f3' } })
})

test('progress: steps are stored per Lehrgang and variety in an own storage key; marking is idempotent and does not touch other entries', () => {
  let s = emptyState()
  s = markStep(s, 'scotch', 'v1', 'vorfuehren')
  s = markStep(markStep(s, 'scotch', 'v1', 'kopf'), 'scotch', 'v1', 'kopf')
  s = markFalle(s, 'scotch', 'f1')
  assert.deepEqual(s.varianten['scotch/v1'], { vorfuehren: true, kopf: true })
  assert.deepEqual(s.fallen, { 'scotch/f1': true })
  const l = { id: 'scotch', varianten: [v('v1'), v('v2'), v('v3', 'erweiterung')] } as unknown as Lehrgang
  assert.deepEqual(stufeFortschritt(s, l, 'kern'), { done: 1, total: 2 })
  assert.deepEqual(stufeFortschritt(s, l, 'erweiterung'), { done: 0, total: 1 })
})

test('storage: save and load round-trip under LEHRGANG_KEY; broken or foreign data gives an empty state, never an exception; export/import for the backup', () => {
  const mem = new Map<string, string>()
  const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, x: string) => void mem.set(k, x) } as unknown as Storage
  const s = markStep(emptyState(), 'italian', 'v9', 'gefuehrt')
  assert.equal(saveState(storage, s), true)
  assert.ok(mem.has(LEHRGANG_KEY))
  assert.deepEqual(loadState(storage), s)
  mem.set(LEHRGANG_KEY, '{kaputt')
  assert.deepEqual(loadState(storage), emptyState())
  mem.set(LEHRGANG_KEY, JSON.stringify({ version: 99, varianten: 5 }))
  assert.deepEqual(loadState(storage), emptyState())
  assert.deepEqual(importState(exportState(s)), s)
  assert.throws(() => importState('{"version":2}'), /Lehrgang/)
})

import { variantTitles } from '../src/lehrgang/title.ts'

test('variantTitles: names the line after the entry with the fewest moves that tell the varieties apart (at least 4 plies), so two lines never share a title', () => {
  const mk = (id: string, sans: string[]): Variante => ({ ...v(id), name: TODO, zuege: sans.map((s) => z(s, 'a1a1')) })
  const entry = ['e4', 'e5']
  const a = mk('a', ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5'])
  const b = mk('b', ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'Bc5'])
  const c = mk('c', ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bxb4'])
  const t = variantTitles([a, b, c], entry)
  assert.equal(t.get('c'), '2. Sf3 Sc6 3. Lc4 Lc5')
  assert.equal(t.get('a'), '2. Sf3 Sc6 3. Lc4 Sf6 4. Sg5 d5')
  assert.equal(t.get('b'), '2. Sf3 Sc6 3. Lc4 Sf6 4. Sg5 Lc5')
  const named = { ...a, name: 'Fried Liver' }
  assert.equal(variantTitles([named, b], entry).get('a'), 'Fried Liver')
})
