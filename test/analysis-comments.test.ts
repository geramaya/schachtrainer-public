import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { buildAnalysis } from '../src/analysis/build.ts'
import { moveComment } from '../src/analysis/comments.ts'
import { materialAfterQuiet } from '../src/analysis/nag.ts'
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
const analysis = () => buildAnalysis(START, UCIS, EV, 12)

test('a mistake: what the move allows, which move was better (allowed after the game) and the engine line in German notation', () => {
  const c = moveComment(analysis(), START, UCIS, 2)!
  assert.match(c, /Stockfish sieht nach a3/)
  assert.match(c, /Besser war Sf3/)
  assert.match(c, /2\. Sf3 Sc6/)
})

test('an only move: the second best move and the proven gap', () => {
  const c = moveComment(analysis(), START, UCIS, 0)!
  assert.match(c, /Einziger Zug/)
  assert.match(c, /d4/)
  assert.match(c, /1,5 Bauerneinheiten/)
})

test('no sign and no repertoire note: no comment (no mandatory comment)', () => {
  assert.equal(moveComment(analysis(), START, UCIS, 1), null)
})

test('repertoire: a hit says so, a deviation names the planned move', () => {
  assert.match(moveComment(analysis(), START, UCIS, 1, { repertoire: { kind: 'treffer', san: 'e5' } })!, /Repertoire/)
  const dev = moveComment(analysis(), START, UCIS, 2, { repertoire: { kind: 'abweichung', plannedSan: 'Nf3' } })!
  assert.match(dev, /Abweichung vom Repertoire: geplant war Sf3/)
  assert.match(dev, /Stockfish sieht nach a3/, 'the engine comment stays')
})

test('a sacrifice !!: the material claim is proven by the line, with the number', () => {
  const fen = 'r5k1/p4ppp/8/8/8/8/1P3PPP/R5K1 w - - 0 1'
  const ev: PositionEvals = {
    whiteCp: [100, 100], best: ['a1a7', null],
    detail: [{ mate: null, pv: ['a1a7', 'a8a7', 'b2b4', 'a7a2'], second: { uci: 'b2b4', whiteCp: -100, mate: null, pv: ['b2b4'] } }, { mate: null, pv: [], second: null }],
  }
  const a = buildAnalysis(fen, ['a1a7'], ev, 12)
  assert.equal(a.moves[0]!.cat, 'brilliant')
  const c = moveComment(a, fen, ['a1a7'], 0)!
  assert.match(c, /Einziger Zug/)
  assert.match(c, /Material/)
  assert.match(c, /4 Bauerneinheiten/)
  assert.match(c, /nach 1\. Txa7 Txa7 2\. b4 steht/, 'the line shown ends where the material count was taken')
  assert.doesNotMatch(c, /Ta2/)
})

test('materialAfterQuiet: the net material change of the mover after the quiet position, null while the line is not settled', () => {
  const fen = 'r5k1/p4ppp/8/8/8/8/1P3PPP/R5K1 w - - 0 1'
  assert.equal(materialAfterQuiet(fen, ['a1a7', 'a8a7', 'b2b4'], 'white'), -4)
  assert.equal(materialAfterQuiet(fen, ['a1a7', 'a8a7'], 'white'), null)
})

test('an imported analysis without engine lines gives no engine comment', () => {
  const a = { ...analysis(), source: 'pgn' as const, lines: UCIS.concat('x').map(() => null) }
  assert.equal(moveComment(a, START, UCIS, 2), null)
})

test('an only move against a mate in the second line: the claim is the mate, not a made-up number of pawns', () => {
  const ev: PositionEvals = {
    whiteCp: [30, 30], best: ['e2e4', null],
    detail: [{ mate: null, pv: ['e2e4'], second: { uci: 'd2d4', whiteCp: -10000, mate: -3, pv: ['d2d4'] } }, { mate: null, pv: [], second: null }],
  }
  const a = buildAnalysis(START, ['e2e4'], ev, 12)
  assert.equal(a.moves[0]!.cat, 'great')
  const c = moveComment(a, START, ['e2e4'], 0)!
  assert.match(c, /Einziger Zug: d4 ließe Matt in 3 zu\./)
  assert.doesNotMatch(c, /Bauerneinheiten/)
})
