import { test } from 'node:test'
import assert from 'node:assert/strict'
import { QUIP_CHANCE, fillQuip, pickQuip } from '../src/teacher/quips.ts'
import type { QuipBook } from '../src/teacher/quips.ts'

const book: QuipBook = {
  mann: {
    patzer: ['Autsch.', 'Das tat weh.', 'Mutig, aber falsch.'],
    gut: ['Okay.', 'Passt.'],
    fehler: ['{figur} auf {zug}? Mutig.', 'Nett.'],
    matt_gesetzt: [],
  },
}

test('fillQuip replaces placeholders from known facts', () => {
  assert.equal(fillQuip('{figur} nach {zug}: {figur_akk}!', { zug: 'Sf3', figur: 'Springer', figur_akk: 'den Springer' }), 'Springer nach Sf3: den Springer!')
})

test('fillQuip gives null when a placeholder has no fact', () => {
  assert.equal(fillQuip('Mit {zug} gewonnen', {}), null)
  assert.equal(fillQuip('Mit {zug} gewonnen', { figur: 'Dame' }), null)
})

test('fillQuip leaves a text without placeholders unchanged', () => {
  assert.equal(fillQuip('Autsch.', {}), 'Autsch.')
})

test('pickQuip is deterministic for the same seed', () => {
  const a = pickQuip(book, 'mann', ['patzer'], {}, 's1', [])
  const b = pickQuip(book, 'mann', ['patzer'], {}, 's1', [])
  assert.ok(a)
  assert.equal(a, b)
})

test('pickQuip varies with the seed', () => {
  const seen = new Set(Array.from({ length: 30 }, (_, i) => pickQuip(book, 'mann', ['patzer'], {}, `seed${i}`, [])))
  assert.equal(seen.size, 3)
})

test('pickQuip never repeats one of the recent quips', () => {
  for (let i = 0; i < 30; i++) {
    const q = pickQuip(book, 'mann', ['patzer'], {}, `s${i}`, ['Autsch.', 'Das tat weh.'])
    assert.equal(q, 'Mutig, aber falsch.')
  }
})

test('pickQuip gives null when every variant was said recently', () => {
  assert.equal(pickQuip(book, 'mann', ['patzer'], {}, 's', ['Autsch.', 'Das tat weh.', 'Mutig, aber falsch.']), null)
})

test('only the last RECENT quips count as recent', () => {
  const old = ['Autsch.', 'x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8', 'Das tat weh.', 'Mutig, aber falsch.']
  const q = pickQuip(book, 'mann', ['patzer'], {}, 's', old)
  assert.equal(q, 'Autsch.')
})

test('a template with a missing fact is skipped, the others stay possible', () => {
  for (let i = 0; i < 20; i++) assert.equal(pickQuip(book, 'mann', ['fehler'], {}, `s${i}`, []), 'Nett.')
})

test('placeholders are filled in the result', () => {
  const q = new Set(Array.from({ length: 40 }, (_, i) => pickQuip(book, 'mann', ['fehler'], { zug: 'Sf3', figur: 'Springer' }, `s${i}`, [])))
  assert.ok(q.has('Springer auf Sf3? Mutig.'))
})

test('missing figure, missing category and empty list give no quip', () => {
  assert.equal(pickQuip(book, 'frau', ['patzer'], {}, 's', []), null)
  assert.equal(pickQuip(book, 'mann', ['ungenau'], {}, 's', []), null)
  assert.equal(pickQuip(book, 'mann', ['matt_gesetzt'], {}, 's', []), null)
})

test('categories are tried in order; an empty one passes to the next', () => {
  assert.ok(book.mann!.patzer!.includes(pickQuip(book, 'mann', ['matt_gesetzt', 'patzer'], {}, 's', [])!))
  assert.ok(book.mann!.fehler!.includes(pickQuip(book, 'mann', ['patzer', 'fehler'], {}, 's', ['Autsch.', 'Das tat weh.', 'Mutig, aber falsch.'])!))
})

test('"gut" is said about a third of the time, a patzer always', () => {
  const n = 600
  const gut = Array.from({ length: n }, (_, i) => pickQuip(book, 'mann', ['gut'], {}, `p${i}`, [])).filter(Boolean).length
  const patzer = Array.from({ length: n }, (_, i) => pickQuip(book, 'mann', ['patzer'], {}, `p${i}`, [])).filter(Boolean).length
  assert.equal(QUIP_CHANCE.patzer, 1)
  assert.equal(patzer, n)
  assert.ok(gut > n * 0.25 && gut < n * 0.42, `gut said ${gut} of ${n}`)
})
