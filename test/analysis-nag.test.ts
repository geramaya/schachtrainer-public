import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NAG_CODE, SIGN_CODE, positionSign, signFromCode, nagFromCode, sacrificesMaterial, isRecapture } from '../src/analysis/nag.ts'

test('NAG codes follow the PGN standard', () => {
  assert.deepEqual(NAG_CODE, { '!': 1, '?': 2, '!!': 3, '??': 4, '!?': 5, '?!': 6 })
  assert.equal(nagFromCode(4), '??')
  assert.equal(nagFromCode(99), null)
})

const sign = (cp: number, mate: number | null = null) => positionSign({ cp, mate })
test('position signs: = below 30, slight edge 30-89, clear edge 90-200, decisive above 200 or mate', () => {
  assert.deepEqual([0, 29, -29].map((c) => sign(c)), ['=', '=', '='])
  assert.deepEqual([30, 89].map((c) => sign(c)), ['⩲', '⩲'])
  assert.deepEqual([-30, -89].map((c) => sign(c)), ['⩱', '⩱'])
  assert.deepEqual([90, 200].map((c) => sign(c)), ['±', '±'])
  assert.deepEqual([-90, -200].map((c) => sign(c)), ['∓', '∓'])
  assert.deepEqual([201, 5000].map((c) => sign(c)), ['+−', '+−'])
  assert.deepEqual([-201, -5000].map((c) => sign(c)), ['−+', '−+'])
  assert.equal(sign(10000, 3), '+−')
  assert.equal(sign(-10000, -3), '−+')
})

test('position sign NAG codes: $10 = $14 ⩲ $15 ⩱ $16 ± $17 ∓ $18 +− $19 −+', () => {
  assert.deepEqual(SIGN_CODE, { '=': 10, '⩲': 14, '⩱': 15, '±': 16, '∓': 17, '+−': 18, '−+': 19 })
  assert.equal(signFromCode(18), '+−')
  assert.equal(signFromCode(1), null)
})

test('sacrificesMaterial: a rook given for a pawn that stays given up after the quiet move', () => {
  const fen = 'r5k1/p4ppp/8/8/8/8/1P3PPP/R5K1 w - - 0 1'
  assert.equal(sacrificesMaterial(fen, ['a1a7', 'a8a7', 'b2b4'], 'white'), true)
})

test('sacrificesMaterial: an even exchange, a quiet move, or a line that ends on a capture is no proven sacrifice', () => {
  const fen = 'r5k1/p4ppp/8/8/8/8/1P3PPP/R5K1 w - - 0 1'
  assert.equal(sacrificesMaterial(fen, ['b2b4', 'a7a6'], 'white'), false)
  assert.equal(sacrificesMaterial(fen, ['a1a7', 'a8a7'], 'white'), false, 'ends on a capture: not settled')
  assert.equal(sacrificesMaterial(fen, [], 'white'), false)
  const trade = 'r5k1/p4ppp/8/8/8/8/R4PPP/R5K1 w - - 0 1'
  assert.equal(sacrificesMaterial(trade, ['a2a7', 'a8a7', 'a1a7', 'g8f8'], 'white'), false, 'net gain of a pawn')
})

test('isRecapture: the move takes on the square where the opponent just took', () => {
  const fen = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
  assert.equal(isRecapture(fen, 'e4d5', 'd8d5'), true)
  assert.equal(isRecapture(fen, 'e4d5', 'g8f6'), false, 'no capture')
  assert.equal(isRecapture(fen, 'e4d5', 'c8d7'), false)
  assert.equal(isRecapture(fen, 'e4e5', 'd5d4'), false, 'the previous move was no capture')
  assert.equal(isRecapture(fen, 'e4e9', 'd8d5'), false, 'illegal input is no recapture')
})

test('sacrifice threshold: exactly -2 pawn units counts, -1 does not', () => {
  // white loses a pawn: -1
  assert.equal(sacrificesMaterial('4k3/8/8/8/8/p7/1P6/4K3 w - - 0 1', ['e1d2', 'a3b2', 'd2c2'], 'white'), false)
  // white gives a bishop (3) for a pawn (1): -2
  assert.equal(sacrificesMaterial('4k3/8/8/8/1p6/2p5/1B6/4K3 w - - 0 1', ['b2c3', 'b4c3', 'e1d1'], 'white'), true)
})
