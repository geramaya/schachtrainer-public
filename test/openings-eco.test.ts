import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { detectOpening, ecoEntriesFromTsv, ecoHash, openingInfo, parseEcoTable } from '../src/openings/eco.ts'
import { positionKey } from '../src/chess/position.ts'

const START = new Chess().fen()
const TSV = `eco\tname\tpgn
C60\tRuy Lopez\t1. e4 e5 2. Nf3 Nc6 3. Bb5
C71\tRuy Lopez: Modern Steinitz Defense\t1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 d6
B10\tCaro-Kann Defense\t1. e4 c6
B12\tCaro-Kann Defense: Advance Variation\t1. e4 c6 2. d4 d5 3. e5
A00\tAmar Opening\t1. Nh3
B12\tDoppelt\t1. e4 c6 2. d4 d5 3. e5
kaputt
`
const table = () => parseEcoTable({ version: 1, entries: ecoEntriesFromTsv(TSV) })!

test('ecoEntriesFromTsv: [hash, eco, name] per position, the original English name unchanged (never half translated), bad rows skipped, first entry of a position wins', () => {
  const e = ecoEntriesFromTsv(TSV)
  assert.equal(e.length, 5, 'header, broken row and the duplicate position are not entries')
  const byEco = Object.fromEntries(e.map(([, eco, name]) => [eco + name.length, name]))
  assert.ok(Object.values(byEco).includes('Caro-Kann Defense: Advance Variation'))
  assert.ok(Object.values(byEco).includes('Ruy Lopez: Modern Steinitz Defense'))
  assert.ok(!Object.values(byEco).some((n) => /Verteidigung|Variante|Eröffnung/.test(n)), 'no German words mixed into English names')
  assert.ok(!Object.values(byEco).includes('Doppelt'))
})

test('ecoHash: stable, short, different for different positions', () => {
  const a = ecoHash(positionKey(START))
  assert.equal(a, ecoHash(positionKey(START)))
  assert.notEqual(a, ecoHash(positionKey(new Chess('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1').fen())))
  assert.match(a, /^[0-9a-z]{6,12}$/)
})

test('parseEcoTable: a broken file gives null, not a crash', () => {
  assert.equal(parseEcoTable(null), null)
  assert.equal(parseEcoTable({ version: 1, entries: 'x' }), null)
  assert.equal(parseEcoTable({ version: 1, entries: [['h', 'A00']] }), null)
})

const ucis = (start: string, sans: string[]) => { const c = new Chess(start); return sans.map((s) => { const m = c.move(s); return m.from + m.to + (m.promotion ?? '') }) }

test('detectOpening: the deepest known position of the game, with its ECO code and the plies it needed', () => {
  const g = ucis(START, ['e4', 'c6', 'd4', 'd5', 'e5', 'Bf5', 'Nf3'])
  assert.deepEqual(detectOpening(table(), START, g), { eco: 'B12', name: 'Caro-Kann Defense: Advance Variation', plies: 5 })
  assert.deepEqual(detectOpening(table(), START, ucis(START, ['e4', 'c6']))!.eco, 'B10')
})

test('detectOpening: a transposition reaches the same position (move order does not matter)', () => {
  const g = ucis(START, ['Nf3', 'Nc6', 'e4', 'e5', 'Bb5'])
  assert.deepEqual(detectOpening(table(), START, g), { eco: 'C60', name: 'Ruy Lopez', plies: 5 })
})

test('detectOpening: leaving the theory keeps the last known opening; a game that never was in a book has none', () => {
  const afterTheory = ucis(START, ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Bxc6', 'dxc6'])
  assert.equal(detectOpening(table(), START, afterTheory)!.eco, 'C60')
  assert.equal(detectOpening(table(), START, ucis(START, ['a3', 'e5'])), null)
  assert.equal(detectOpening(table(), START, []), null)
})

test('detectOpening: a game from another start position (the position is not in the table) has none', () => {
  const fen = '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1'
  assert.equal(detectOpening(table(), fen, ucis(fen, ['e4', 'Kd7'])), null)
})

test('detectOpening: deeper known position wins over a shorter one', () => {
  const deep = ucis(START, ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'd6'])
  assert.equal(detectOpening(table(), START, deep)!.eco, 'C71')
})

test('openingInfo: the PGN tags are shown, our own detection is the fallback and fills a missing ECO code', () => {
  const det = { eco: 'B12', name: 'Caro-Kann Defense: Advance Variation' }
  assert.deepEqual(openingInfo({ eco: 'B13', name: 'Caro-Kann Defense: Exchange Variation' }, det), { eco: 'B13', name: 'Caro-Kann Defense: Exchange Variation', source: 'pgn' })
  assert.deepEqual(openingInfo({ eco: null, name: 'Caro-Kann Defense' }, det), { eco: 'B12', name: 'Caro-Kann Defense', source: 'pgn' })
  assert.deepEqual(openingInfo({ eco: null, name: null }, det), { eco: 'B12', name: 'Caro-Kann Defense: Advance Variation', source: 'detected' })
  assert.deepEqual(openingInfo({ eco: 'B12', name: null }, null), { eco: 'B12', name: null, source: 'pgn' })
  assert.deepEqual(openingInfo({ eco: null, name: null }, null), { eco: null, name: null, source: null })
  assert.deepEqual(openingInfo({ eco: '?', name: '?' }, det).source, 'detected', 'placeholder tags like "?" are no information')
})
