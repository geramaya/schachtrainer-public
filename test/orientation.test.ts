import { test } from 'node:test'
import assert from 'node:assert/strict'
import { materialOf } from '../src/chess/material.ts'
import { startOrientation, flipSide, barSides, povSign, parseFlips, parsePov, povScore } from '../src/ui/orientation.ts'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

test('materialOf: the start position is level, nothing taken', () => {
  assert.deepEqual(materialOf(START), { diff: 0, takenByWhite: [], takenByBlack: [] })
})

test('materialOf: points difference from White view and the pieces each side has taken', () => {
  // White has lost a knight and a pawn, Black has lost the queen and a pawn
  const fen = 'rnb1kbnr/ppp1pppp/8/8/8/8/PPPPPPP1/R1BQKBNR w KQkq - 0 1'
  const m = materialOf(fen)
  assert.deepEqual(m.takenByWhite.sort(), ['p', 'q'])
  assert.deepEqual(m.takenByBlack.sort(), ['n', 'p'])
  assert.equal(m.diff, (9 + 1) - (3 + 1)) // white took queen+pawn (10), black took knight+pawn (4)
})

test('materialOf: a promoted piece is not counted as taken, the points still count', () => {
  const m = materialOf('4k3/8/8/8/8/8/8/Q3K3 w - - 0 1') // second queen? white has 1 queen only: no pawns left, all 8 pawns "taken" by black
  assert.equal(m.takenByBlack.filter((p) => p === 'p').length, 8)
  assert.equal(m.diff, 9 - 0)
  const m2 = materialOf('4k3/8/8/8/8/8/8/QQ2K3 w - - 0 1') // promoted: two queens, queen count above start gives no negative taken
  assert.equal(m2.takenByBlack.includes('q'), false)
  assert.equal(m2.diff, 18)
})

test('orientation: start is the own side or White; flipping swaps; bars follow', () => {
  assert.equal(startOrientation('black'), 'black')
  assert.equal(startOrientation(null), 'white')
  assert.equal(flipSide('white'), 'black')
  assert.deepEqual(barSides('white'), { top: 'black', bottom: 'white' })
  assert.deepEqual(barSides('black'), { top: 'white', bottom: 'black' })
})

test('perspective: scores are from White view or from the side at the bottom', () => {
  assert.equal(povSign('white', 'black'), 1)
  assert.equal(povSign('bottom', 'white'), 1)
  assert.equal(povSign('bottom', 'black'), -1)
  assert.equal(povScore(70, 'bottom', 'black'), -70)
  assert.equal(povScore(70, 'white', 'black'), 70)
})

test('parseFlips / parsePov: stored data is untrusted', () => {
  assert.deepEqual(parseFlips({ a: 'black', b: 'white', c: 'red', d: 3 }), { a: 'black', b: 'white' })
  assert.deepEqual(parseFlips(null), {})
  assert.equal(parsePov('bottom'), 'bottom')
  assert.equal(parsePov('x'), 'white')
})

import { playerOf } from '../src/games/identity.ts'
test('playerOf: name and rating for a player bar (engine strength in own games, file ratings in imported ones)', () => {
  const own = { white: 'Du', black: 'Stockfish', ownSide: 'white' as const, elo: 1400, meta: null }
  assert.deepEqual(playerOf(own, 'white'), { name: 'Du', elo: null })
  assert.deepEqual(playerOf(own, 'black'), { name: 'Stockfish', elo: 1400 })
  const imported = { white: 'anna', black: 'bob', ownSide: null, elo: null, meta: { whiteElo: 1500, blackElo: null } }
  assert.deepEqual(playerOf(imported, 'white'), { name: 'anna', elo: 1500 })
  assert.deepEqual(playerOf(imported, 'black'), { name: 'bob', elo: null })
})
