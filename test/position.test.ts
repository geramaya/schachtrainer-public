import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { positionKey } from '../src/chess/position.ts'

const play = (sans: string[]) => {
  const c = new Chess()
  for (const s of sans) c.move(s)
  return c.fen()
}

test('positionKey keeps FEN fields 1-4 joined by single spaces', () => {
  assert.equal(
    positionKey(play(['e4', 'e5', 'Nf3', 'Nc6'])),
    'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -',
  )
})

test('positionKey is equal for transposed move orders', () => {
  assert.equal(
    positionKey(play(['c4', 'g6', 'Nf3', 'Bg7'])),
    positionKey(play(['Nf3', 'g6', 'c4', 'Bg7'])),
  )
})

test('positionKey ignores halfmove clock and move number', () => {
  assert.equal(
    positionKey('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 5 9'),
    positionKey('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
  )
})

test('positionKey normalizes en passant square when no legal ep capture exists', () => {
  const afterE4Ep = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
  const afterE4NoEp = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
  assert.equal(positionKey(afterE4Ep), positionKey(afterE4NoEp))
})

test('positionKey keeps en passant square when a legal ep capture exists', () => {
  const fen = 'rnbqkbnr/ppp1pppp/8/8/3pP3/5N2/PPPP1PPP/RNBQKB1R b KQkq e3 0 3'
  assert.ok(positionKey(fen).endsWith(' e3'))
})
