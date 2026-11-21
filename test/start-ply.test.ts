import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { positionKey } from '../src/chess/position.ts'
import { startPlyFor } from '../src/train/startPly.ts'

const keys = (() => {
  const c = new Chess()
  const out = [positionKey(c.fen())]
  for (const san of ['e4', 'e5', 'Nf3', 'Nc6']) { c.move(san); out.push(positionKey(c.fen())) }
  return out
})()

test('a lesson opens at the start position, not at the end of the line', () => {
  assert.equal(startPlyFor(keys), 0)
})

test('a position named by the URL wins when it is on the line', () => {
  const c = new Chess(); c.move('e4'); c.move('e5'); c.move('Nf3')
  assert.equal(startPlyFor(keys, c.fen()), 3)
})

test('a position that is not on the line falls back to the start', () => {
  assert.equal(startPlyFor(keys, 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1'), 0)
  assert.equal(startPlyFor(keys, 'nonsense'), 0)
})
