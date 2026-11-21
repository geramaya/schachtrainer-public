import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { buildAnalysis } from '../src/analysis/build.ts'
import { evalText, graphMarks, layoutMarks, shortSentence, tooltipLeft } from '../src/analysis/marks.ts'
import type { PositionEvals } from '../src/train/review.ts'

const START = new Chess().fen()
const UCIS = ['e2e4', 'e7e5', 'a2a3']
const EV: PositionEvals = {
  whiteCp: [30, 30, 25, -250],
  best: ['e2e4', 'e7e5', 'g1f3', 'a7a6'],
  detail: [
    { mate: null, pv: ['e2e4', 'e7e5'], second: { uci: 'd2d4', whiteCp: -120, mate: null, pv: ['d2d4'] } },
    { mate: null, pv: ['e7e5'], second: null },
    { mate: null, pv: ['g1f3', 'b8c6'], second: { uci: 'b1c3', whiteCp: 20, mate: null, pv: ['b1c3'] } },
    { mate: null, pv: ['a7a6'], second: null },
  ],
}

test('evalText: German decimal comma with sign, mate with the winning side', () => {
  assert.equal(evalText({ cp: 30, mate: null }), '+0,30')
  assert.equal(evalText({ cp: -83, mate: null }), '−0,83')
  assert.equal(evalText({ cp: 0, mate: null }), '0,00')
  assert.equal(evalText({ cp: 10000, mate: 3 }), 'Matt in 3 für Weiß')
  assert.equal(evalText({ cp: -10000, mate: -1 }), 'Matt in 1 für Schwarz')
})

test('shortSentence: the first sentence, plus "Besser war X" without the reason, shortened to one line', () => {
  const full = 'Stockfish sieht nach Ke2 −0,83. Besser war Sc3: Er entwickelt den Springer von b1. Engine-Linie: 3. Sc3 e6.'
  assert.equal(shortSentence(full), 'Stockfish sieht nach Ke2 −0,83. Besser war Sc3.')
  assert.equal(shortSentence('Einziger Zug: d4 wäre 1,5 Bauerneinheiten schlechter.'), 'Einziger Zug: d4 wäre 1,5 Bauerneinheiten schlechter.')
  assert.equal(shortSentence(null), '')
  const long = 'Das ist ein sehr langer Satz ' + 'mit vielen Wörtern '.repeat(20) + 'am Ende.'
  assert.ok(shortSentence(long, 80).length <= 80)
  assert.ok(shortSentence(long, 80).endsWith('…'))
})

test('graphMarks: only the notable categories, with move title, symbol, evaluation before and after, and the short comment', () => {
  const a = buildAnalysis(START, UCIS, EV, 12)
  const marks = graphMarks(a, START, UCIS, { comment: (ply) => (ply === 2 ? 'Stockfish sieht nach a3 −2,50. Besser war Sf3: Er entwickelt.' : null) })
  assert.deepEqual(marks.map((m) => [m.ply, m.cat, m.symbol]), [[1, 'great', '!'], [3, 'blunder', '??']])
  assert.equal(marks[1]!.title, '2. a3??')
  assert.equal(marks[1]!.side, 'white')
  assert.equal(marks[1]!.name, 'Patzer')
  assert.equal(marks[1]!.evalText, '+0,25 → −2,50')
  assert.equal(marks[1]!.sentence, 'Stockfish sieht nach a3 −2,50. Besser war Sf3.')
  assert.equal(marks[0]!.title, '1. e4!')
})

test('graphMarks: black moves are marked on the black side, the title uses the black move number notation', () => {
  const a = buildAnalysis(START, ['e2e4', 'e7e5'], { ...EV, whiteCp: [30, 30, 900], best: ['e2e4', 'd7d5', null], detail: EV.detail!.slice(0, 3) }, 12)
  const m = graphMarks(a, START, ['e2e4', 'e7e5'], {}).find((x) => x.ply === 2)!
  assert.equal(m.side, 'black')
  assert.equal(m.title, '1… e5??')
})

test('layoutMarks: marks that are close share rows, none overlap within the gap, severe marks are placed first, the rest has no row', () => {
  // x positions 10 px apart, gap 24 px, two rows
  const items = [{ x: 10, priority: 1 }, { x: 20, priority: 5 }, { x: 30, priority: 1 }, { x: 40, priority: 3 }, { x: 200, priority: 1 }]
  const rows = layoutMarks(items, 24, 2)
  assert.equal(rows[1], 0, 'the most severe mark takes row 0')
  assert.equal(rows[3], 1, 'the next one is too close for row 0, takes row 1')
  assert.equal(rows[0], 1, 'x = 10 is 30 px from x = 40 in row 1')
  assert.equal(rows[2], null, 'x = 30 is within 24 px of x = 20 and x = 40: no free row')
  assert.equal(rows[4], 0, 'far away: row 0 is free again')
})

test('layoutMarks: with enough distance everything sits in row 0', () => {
  assert.deepEqual(layoutMarks([{ x: 0, priority: 1 }, { x: 30, priority: 1 }, { x: 60, priority: 1 }], 24, 3), [0, 0, 0])
})

test('tooltipLeft: centred on the mark, kept inside the graph', () => {
  assert.equal(tooltipLeft(150, 300, 100), 100)
  assert.equal(tooltipLeft(10, 300, 100), 0)
  assert.equal(tooltipLeft(295, 300, 100), 200)
  assert.equal(tooltipLeft(50, 80, 100), 0, 'a tooltip wider than the graph starts at the left edge')
})
