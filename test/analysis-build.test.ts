import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { fakeEngine } from './fake-engine.ts'
import { positionKey } from '../src/chess/position.ts'
import { evaluatePositions, gameFens } from '../src/train/review.ts'
import type { PositionEvals } from '../src/train/review.ts'
import { ANALYSIS_VERSION, buildAnalysis, normalizeAnalysis, summarize } from '../src/analysis/build.ts'
import type { GameAnalysis } from '../src/analysis/build.ts'

const START = new Chess().fen()
const UCIS = ['e2e4', 'e7e5', 'a2a3']
const fens = gameFens(START, UCIS)
const key = (i: number) => positionKey(fens[i]!)

test('evaluatePositions with multipv 2: second line and best line per position, white view (mate sign flipped for black)', async () => {
  const eng = fakeEngine({
    [key(0)]: { lines: [{ uci: 'e2e4', cp: 30, pv: ['e2e4', 'e7e5'] }, { uci: 'd2d4', cp: -80, pv: ['d2d4'] }] },
    [key(1)]: { lines: [{ uci: 'e7e5', cp: 20, pv: ['e7e5', 'g1f3'] }, { uci: 'c7c5', cp: 10, pv: ['c7c5'] }] },
    [key(2)]: { lines: [{ uci: 'g1f3', mate: 3, pv: ['g1f3'] }, { uci: 'b1c3', cp: 20, pv: ['b1c3'] }] },
    [key(3)]: { lines: [{ uci: 'a7a6', mate: 2, pv: ['a7a6'] }] },
  })
  const ev = await evaluatePositions(eng, fens, 12, { multipv: 2 })
  assert.ok(eng.calls.every((c) => c.multipv === 2))
  assert.deepEqual(ev.whiteCp, [30, -20, 10000, -10000])
  assert.deepEqual(ev.detail![0], { mate: null, pv: ['e2e4', 'e7e5'], second: { uci: 'd2d4', whiteCp: -80, mate: null, pv: ['d2d4'] } })
  assert.deepEqual(ev.detail![1]!.second, { uci: 'c7c5', whiteCp: -10, mate: null, pv: ['c7c5'] })
  assert.equal(ev.detail![2]!.mate, 3)
  assert.equal(ev.detail![3]!.mate, -2, 'black mates in 2: from the white view -2')
  assert.equal(ev.detail![3]!.second, null)
})

test('evaluatePositions without multipv: one line, no detail (as before)', async () => {
  const eng = fakeEngine({})
  const ev = await evaluatePositions(eng, fens.slice(0, 2), 12)
  assert.ok(eng.calls.every((c) => c.multipv === 1))
  assert.equal(ev.detail, undefined)
})

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

test('buildAnalysis: positions, move signs and losses from the evaluations', () => {
  const a = buildAnalysis(START, UCIS, EV, 12)
  assert.equal(a.source, 'engine')
  assert.equal(a.depth, 12)
  assert.deepEqual(a.positions, [{ cp: 30, mate: null }, { cp: 30, mate: null }, { cp: 25, mate: null }, { cp: -250, mate: null }])
  assert.equal(a.version, ANALYSIS_VERSION)
  assert.deepEqual(a.moves.map((m) => m.cat), ['great', 'best', 'blunder'])
  assert.equal(a.moves[2]!.lossCp, 275)
  assert.equal(a.moves[0]!.lossCp, 0)
  assert.equal(a.lines[2]!.best.uci, 'g1f3')
  assert.equal(a.lines[0]!.second!.uci, 'd2d4')
})

test('summarize: counts per side and accuracy (the side with the blunder is less accurate)', () => {
  const s = summarize(buildAnalysis(START, UCIS, EV, 12), START)
  assert.equal(s.white.counts.great, 1)
  assert.equal(s.white.counts.blunder, 1)
  assert.equal(s.black.counts.best, 1)
  assert.equal(Object.values(s.black.counts).reduce((a, b) => a + b, 0), 1)
  assert.ok(s.white.accuracy! < 70, `white ${s.white.accuracy}`)
  assert.ok(s.black.accuracy! > 95, `black ${s.black.accuracy}`)
})

test('a game that starts with black to move: the movers are assigned correctly', () => {
  const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
  const ev: PositionEvals = { whiteCp: [30, 30], best: ['e7e5', null], detail: [{ mate: null, pv: ['e7e5'], second: { uci: 'c7c5', whiteCp: 250, mate: null, pv: ['c7c5'] } }, { mate: null, pv: [], second: null }] }
  const a = buildAnalysis(fen, ['e7e5'], ev, 12)
  assert.deepEqual(a.moves.map((m) => m.cat), ['great'], 'black: best -30, second -250 from the black view = a clear only move')
})

test('buildAnalysis: a forced recapture is no "Stark" although it is the only good move', () => {
  const ucis = ['e2e4', 'd7d5', 'e4d5', 'd8d5']
  const ev: PositionEvals = {
    whiteCp: [20, 20, 20, 20, 20],
    best: ['e2e4', 'd7d5', 'e4d5', 'd8d5', 'b1c3'],
    detail: [
      { mate: null, pv: ['e2e4'], second: null }, { mate: null, pv: ['d7d5'], second: null },
      { mate: null, pv: ['e4d5'], second: null },
      { mate: null, pv: ['d8d5'], second: { uci: 'g8f6', whiteCp: 170, mate: null, pv: ['g8f6'] } },
      { mate: null, pv: ['b1c3'], second: null },
    ],
  }
  assert.equal(buildAnalysis(START, ucis, ev, 12).moves[3]!.cat, 'best')
})

test('book plies: the first moves are book moves, whatever they cost', () => {
  const a = buildAnalysis(START, UCIS, EV, 12, 2)
  assert.deepEqual(a.moves.map((m) => m.cat), ['book', 'book', 'blunder'])
  assert.equal(a.bookPlies, 2)
})

test('Miss: the opponent blundered, the position was winning, the move lets it slip to balanced', () => {
  const ucis = ['e2e4', 'e7e5', 'g1f3', 'b8c6']
  // black plays e5 instead of d5 and the evaluation jumps to +4.8 for white; the Nf3 of white lets it fall back to 0
  const ev: PositionEvals = {
    whiteCp: [0, 0, 480, 0, 0],
    best: ['e2e4', 'd7d5', 'd2d4', 'b8c6', null],
    detail: [
      { mate: null, pv: ['e2e4'], second: null }, { mate: null, pv: ['d7d5'], second: null }, { mate: null, pv: ['d2d4'], second: null },
      { mate: null, pv: ['b8c6'], second: null }, { mate: null, pv: [], second: null },
    ],
  }
  const a = buildAnalysis(START, ucis, ev, 12)
  assert.deepEqual(a.moves.map((m) => m.cat), ['best', 'blunder', 'miss', 'best'])
})

test('normalizeAnalysis: an old analysis (no version) is classified again from the stored evaluations, nothing is recomputed', () => {
  const current = buildAnalysis(START, UCIS, EV, 12)
  const old = { ...current, version: undefined as unknown as number, moves: current.moves.map((m) => ({ nag: '?!', lossCp: m.lossCp })) } as unknown as GameAnalysis
  const n = normalizeAnalysis(old, START, UCIS)
  assert.equal(n.version, ANALYSIS_VERSION)
  assert.deepEqual(n.moves.map((m) => m.cat), ['great', 'best', 'blunder'])
  assert.equal(normalizeAnalysis(current, START, UCIS), current, 'current version: unchanged')
})

test('normalizeAnalysis: an analysis read from a PGN file keeps its classical signs as categories', () => {
  const pgn = { version: 1, source: 'pgn', depth: 0, positions: [null, null], moves: [{ nag: '??', lossCp: 0 }], lines: [null, null], bookPlies: null } as unknown as GameAnalysis
  assert.deepEqual(normalizeAnalysis(pgn, START, ['e2e4']).moves, [{ cat: 'blunder', lossCp: 0 }])
})
