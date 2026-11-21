import { test } from 'node:test'
import assert from 'node:assert/strict'
import { describeResult, gameStatus, isValidFen } from '../src/chess/status.ts'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

test('gameStatus: running game is not over', () => {
  assert.deepEqual(gameStatus(START, ['e2e4', 'e7e5']), { over: false })
})

test('gameStatus: checkmate names the winner', () => {
  assert.deepEqual(gameStatus(START, ['f2f3', 'e7e5', 'g2g4', 'd8h4']), { over: true, reason: 'matt', winner: 'black' })
})

test('gameStatus: stalemate, threefold repetition, fifty moves, insufficient material', () => {
  assert.deepEqual(gameStatus('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', []), { over: true, reason: 'patt', winner: null })
  const shuffle = ['g1f3', 'g8f6', 'f3g1', 'f6g8']
  assert.deepEqual(gameStatus(START, [...shuffle, ...shuffle]), { over: true, reason: 'wiederholung', winner: null })
  assert.deepEqual(gameStatus('4k3/8/8/8/8/8/4R3/4K3 w - - 100 80', []), { over: true, reason: '50-zuege', winner: null })
  assert.deepEqual(gameStatus('4k3/8/8/8/8/8/8/4K1N1 w - - 0 1', []), { over: true, reason: 'material', winner: null })
})

test('isValidFen rejects garbage and kingless positions', () => {
  assert.equal(isValidFen(START), true)
  assert.equal(isValidFen('nonsense'), false)
  assert.equal(isValidFen('8/8/8/8/8/8/8/8 w - - 0 1'), false)
})

test('describeResult words the end of a game from the user view; start positions that are already over are detected', () => {
  const over = gameStatus('R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1', [])
  assert.ok(over.over)
  assert.equal(describeResult(over, 'white'), 'Du hast gewonnen (Schachmatt)')
  assert.equal(describeResult(over, 'black'), 'Die Engine hat gewonnen (Schachmatt)')
  const stale = gameStatus('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', [])
  assert.ok(stale.over)
  assert.equal(describeResult(stale, 'white'), 'Remis (Patt)')
})
