import { test } from 'node:test'
import assert from 'node:assert/strict'
import { whiteScore, scoreLabel, barCp, pvMoves, engineArrows, summarize, endedScore, shownScore } from '../src/coach/ceval.ts'
import type { Analysis } from '../src/engine/service.ts'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'

test('whiteScore flips cp and mate when Black is to move', () => {
  assert.deepEqual(whiteScore({ cp: 30, mate: null }, 'white'), { cp: 30, mate: null })
  assert.deepEqual(whiteScore({ cp: 30, mate: null }, 'black'), { cp: -30, mate: null })
  assert.deepEqual(whiteScore({ cp: null, mate: 3 }, 'black'), { cp: null, mate: -3 })
  assert.deepEqual(whiteScore({ cp: null, mate: 2 }, 'white'), { cp: null, mate: 2 })
})

test('scoreLabel: pawn value with comma, #n for mate from White side', () => {
  assert.equal(scoreLabel({ cp: 44, mate: null }), '+0,4')
  assert.equal(scoreLabel({ cp: null, mate: 3 }), '#3')
  assert.equal(scoreLabel({ cp: null, mate: -2 }), '#-2')
})

test('barCp saturates for mate and is 0 without a score', () => {
  assert.ok(barCp({ cp: null, mate: 3 }) >= 800)
  assert.ok(barCp({ cp: null, mate: -1 }) <= -800)
  assert.equal(barCp({ cp: 120, mate: null }), 120)
  assert.equal(barCp(null), 0)
})

test('pvMoves gives German SAN with move numbers and the FEN after each move', () => {
  const m = pvMoves(START, ['e2e4', 'e7e5', 'g1f3', 'b8c6'])
  assert.deepEqual(m.map((x) => x.san), ['e4', 'e5', 'Sf3', 'Sc6'])
  assert.deepEqual(m.map((x) => x.num), ['1.', null, '2.', null])
  assert.equal(m[0]!.fen, AFTER_E4)
  assert.equal(m[1]!.uci, 'e7e5')
})

test('pvMoves starts with "n…" when Black is to move', () => {
  const m = pvMoves(AFTER_E4, ['e7e5', 'g1f3'])
  assert.deepEqual(m.map((x) => x.num), ['1…', '2.'])
})

test('pvMoves cuts at an illegal move and at the display limit', () => {
  assert.equal(pvMoves(START, ['e2e4', 'e2e4', 'd7d5']).length, 1)
  const long = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1g1', 'f6e4', 'd2d4', 'b7b5', 'a4b3', 'd7d5']
  assert.equal(pvMoves(START, long, 12).length, 12)
})

test('summarize turns an analysis into white-side lines with labels', () => {
  const a: Analysis = {
    bestUci: 'e7e5', depth: 18,
    lines: [
      { uci: 'e7e5', cp: 25, mate: null, pv: ['e7e5', 'g1f3'] },
      { uci: 'c7c5', cp: 40, mate: null, pv: ['c7c5'] },
    ],
  }
  const s = summarize(a, AFTER_E4)
  assert.equal(s.depth, 18)
  assert.equal(s.lines[0]!.label, '-0,3') // Black to move: +25 for Black = -0.25 for White
  assert.equal(s.lines[0]!.moves[0]!.san, 'e5')
  assert.equal(s.best?.cp, -25)
})

test('engineArrows: best move strong, second line pale, none with fewer lines', () => {
  const lines = [
    { uci: 'e7e5', cp: 0, mate: null, pv: ['e7e5'] },
    { uci: 'c7c5', cp: 0, mate: null, pv: ['c7c5'] },
    { uci: 'e7e6', cp: 0, mate: null, pv: ['e7e6'] },
  ]
  assert.deepEqual(engineArrows(lines), [
    { orig: 'e7', dest: 'e5', brush: 'ceval' },
    { orig: 'c7', dest: 'c5', brush: 'cevalPale' },
  ])
  assert.deepEqual(engineArrows(lines.slice(0, 1)), [{ orig: 'e7', dest: 'e5', brush: 'ceval' }])
  assert.deepEqual(engineArrows([]), [])
})

const MATED_WHITE = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3' // White is checkmated
const STALEMATE = '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'
const MATE_BLACK = 'R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1'

test('endedScore: checkmate scores for the mating side, stalemate is 0', () => {
  const w = endedScore(MATED_WHITE)
  assert.ok(w.cp! <= -800 && w.mate === null)
  assert.equal(scoreLabel(w), '#-')
  const b = endedScore(MATE_BLACK)
  assert.ok(b.cp! >= 800)
  assert.equal(scoreLabel(b), '#')
  assert.deepEqual(endedScore(STALEMATE), { cp: 0, mate: null })
})

test('shownScore: finished position and engine error never show the score of the previous position', () => {
  const held = { cp: 120, mate: null }
  const best = { cp: 30, mate: null }
  assert.deepEqual(shownScore({ fen: STALEMATE, ended: true, error: '', best: null, held }), { cp: 0, mate: null })
  assert.equal(shownScore({ fen: START, ended: false, error: 'boom', best: null, held }), null)
  assert.deepEqual(shownScore({ fen: START, ended: false, error: '', best: null, held }), held)
  assert.deepEqual(shownScore({ fen: START, ended: false, error: '', best, held }), best)
})
