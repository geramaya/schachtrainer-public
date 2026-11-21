import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analysisFen, newAnalysis, playMove, goBack, goForward, goTo, currentFen, moveLine } from '../src/train/analysisBoard.ts'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

test('a new analysis shows the start position', () => {
  const a = newAnalysis(START)
  assert.equal(currentFen(a), START)
  assert.deepEqual(a.ucis, [])
})

test('playMove advances; illegal moves are refused and change nothing', () => {
  let a = newAnalysis(START)
  a = playMove(a, 'e2e4')
  a = playMove(a, 'e7e5')
  assert.equal(a.view, 2)
  assert.equal(playMove(a, 'e2e4'), a)
  assert.equal(playMove(a, 'zz'), a)
})

test('both sides move freely in turn, also a Black-to-move start', () => {
  let a = newAnalysis('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')
  a = playMove(a, 'c7c5')
  assert.equal(currentFen(a).split(' ')[1], 'w')
})

test('back and forward move through the line within bounds', () => {
  let a = playMove(playMove(newAnalysis(START), 'e2e4'), 'e7e5')
  a = goBack(a)
  assert.equal(a.view, 1)
  assert.equal(goBack(goBack(goBack(a))).view, 0)
  a = goForward(a)
  assert.equal(a.view, 2)
  assert.equal(goForward(a).view, 2)
  assert.equal(goTo(a, 99).view, 2)
  assert.equal(goTo(a, -4).view, 0)
})

test('playing another move from an earlier position cuts the old continuation', () => {
  let a = playMove(playMove(playMove(newAnalysis(START), 'e2e4'), 'e7e5'), 'g1f3')
  a = goTo(a, 1)
  a = playMove(a, 'c7c5')
  assert.deepEqual(a.ucis, ['e2e4', 'c7c5'])
})

test('replaying the very next move of the line keeps the continuation', () => {
  let a = playMove(playMove(newAnalysis(START), 'e2e4'), 'e7e5')
  a = goTo(a, 1)
  a = playMove(a, 'e7e5')
  assert.deepEqual(a.ucis, ['e2e4', 'e7e5'])
  assert.equal(a.view, 2)
})

test('moveLine gives the SAN of the line and the ply it starts at, also from a Black start', () => {
  const a = playMove(playMove(newAnalysis(START), 'g1f3'), 'g8f6')
  assert.deepEqual(moveLine(a), { sans: ['Nf3', 'Nf6'], startPly: 0 })
  const b = playMove(newAnalysis('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'), 'g8f6')
  assert.deepEqual(moveLine(b), { sans: ['Nf6'], startPly: 1 })
})

test('analysisFen normalises a valid position', () => {
  assert.equal(analysisFen(START), START)
  assert.equal(analysisFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'), START)
})

test('analysisFen refuses broken and impossible positions', () => {
  assert.equal(analysisFen('nonsense'), null)
  assert.equal(analysisFen('k7/K7/8/8/8/8/8/8 w - - 0 1'), null, 'kings next to each other')
  assert.equal(analysisFen('4k3/4Q3/8/8/8/8/8/4K3 w - - 0 1'), null, 'the side not to move is in check')
  assert.equal(analysisFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1'), '4k3/8/8/8/8/8/8/4K3 w - - 0 1')
})
