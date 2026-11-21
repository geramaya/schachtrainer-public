import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { checkAuthoredIntro } from '../tools/lib/intro-check.ts'
import { introFacts } from '../tools/lib/intro-facts.ts'
import type { DocLine } from '../tools/lib/intro-facts.ts'
import type { Variation } from '../src/content/types.ts'

const OPENING = { id: 'scotch' as const, side: 'white' as const, entry: ['e4', 'e5'], docRef: 'doc' }
const LINE = ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4']
const V: Variation = { id: 'v1', name: 'V', nameEn: 'V', line: LINE, keyPositions: [], fromDocument: false }
const DOC: DocLine[] = [{ z: 4, text: '- Code: 1. e4 e5 2. Sf3 Sc6 3. d4!' }, { z: 5, text: '- Die Logik: Wir öffnen das Zentrum.' }]

function sheet() {
  const g = new Chess()
  const analysis: Record<string, unknown> = {}
  const cps = [20, 30, 25, 150, -130, 35]
  const after: string[] = []
  LINE.forEach((san, i) => { g.move(san); after.push(g.fen()); analysis[`${g.fen()}|18|1`] = { lines: [{ cp: cps[i], mate: null }] } })
  const afterE4 = new Chess(); afterE4.move('e4')
  const explorer = { [afterE4.fen()]: [{ uci: 'e7e5', games: 600 }, { uci: 'c7c5', games: 300 }, { uci: 'e7e6', games: 100 }] }
  return introFacts(OPENING, V, { analysis: analysis as never, explorer })
}
const F = sheet()
const check = (text: string, belege: string[] = []) => checkAuthoredIntro({ text, belege }, LINE, F, DOC)

test('a text that names only what the sheet and the line show passes', () => {
  assert.deepEqual(check('Nach 1. e4 e5 2. Sf3 Sc6 spielst du 3. d4 und Schwarz schlägt mit 3… exd4.'), [])
})

test('moves and pieces are still checked against the line', () => {
  assert.equal(check('Nach 1. e4 e5 2. Sf3 Sc6 spielst du 3. Lc4.').length, 1)
  assert.equal(check('Der Läufer h6 greift an.').length, 1)
})

test('a square that no piece ever touches on the line is rejected', () => {
  assert.equal(check('Achte auf das Feld h6.').length, 1)
  assert.deepEqual(check('Achte auf das Feld d4.'), [])
})

test('evaluations must match a value of the sheet within 0,1 pawns, either perspective, sign included', () => {
  assert.deepEqual(check('Stockfish sieht nach 2… Sc6 etwa +1,5 für Weiß.'), [], 'the sheet has 150')
  assert.deepEqual(check('Stockfish sieht +1,45.'), [], 'within tolerance')
  assert.equal(check('Stockfish sieht +2,1 für Weiß.').length, 1)
  assert.equal(check('Stockfish sieht −1,5 für Weiß.').length, 1, 'the sign is part of the claim')
  assert.deepEqual(check('Der Sprung beträgt 1,75 Bauerneinheiten.'), [], 'unsigned size matches the jump of 175')
  assert.equal(check('Der Sprung beträgt 3 Bauerneinheiten.').length, 1)
})

test('percentages must match a frequency of the sheet within one point, counts within five percent', () => {
  assert.deepEqual(check('In 60 % der Partien spielt Schwarz 1… e5.'), [])
  assert.deepEqual(check('Rund 59,5 Prozent wählen 1… e5.'), [])
  assert.equal(check('Rund 75 % wählen 1… e5.').length, 1)
  assert.deepEqual(check('Das sind 600 Partien.'), [])
  assert.deepEqual(check('Das sind 1.000 Partien.'), [])
  assert.equal(check('Das sind 5.000 Partien.').length, 1)
})

test('statements about plan or idea need evidence keys that exist in the sheet', () => {
  assert.equal(check('Der Plan ist, das Zentrum zu öffnen.').length, 1, 'no evidence')
  assert.equal(check('Der Plan ist, das Zentrum zu öffnen.', ['erfunden']).length, 1, 'unknown key')
  assert.deepEqual(check('Der Plan ist, das Zentrum zu öffnen.', ['kritischerZug']), [])
  assert.deepEqual(check('Die Idee: Zentrum öffnen.', ['doc:Z5']), [])
  assert.equal(check('Die Idee: Zentrum öffnen.', ['doc:Z99']).length, 1, 'line is not in the excerpt')
  assert.deepEqual(check('Nach 1. e4 e5 geht es los.'), [], 'no claim of plan, no evidence needed')
})

test('evidence keys are checked even when no plan is claimed', () => {
  assert.equal(check('Nach 1. e4 e5 geht es los.', ['erfunden']).length, 1)
})

test('a sheet of another line is stale and the text is rejected', () => {
  const stale = checkAuthoredIntro({ text: 'Nach 1. e4 e5 geht es los.', belege: [] }, ['d4', 'd5'], F, DOC)
  assert.equal(stale.length, 1)
  assert.match(stale[0]!, /Faktenblatt/)
})

test('an authored text has one to three sentences and at most 700 characters, like every intro of the bundle', () => {
  assert.deepEqual(check('Nach 1. e4 e5 geht es los. Das ist ein Satz. Und noch einer.'), [])
  const four = check('Nach 1. e4 e5 geht es los. Das ist ein Satz. Und noch einer. Und noch einer.')
  assert.equal(four.length, 1)
  assert.match(four[0]!, /4 Sätze/)
  assert.equal(check('Nach 1. e4 e5 geht es los ' + 'x'.repeat(700) + '.').length, 1)
  assert.equal(check('').length, 1, 'empty')
})
