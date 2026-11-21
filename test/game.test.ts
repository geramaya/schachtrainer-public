import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isCheck, legalDests, needsPromotion, toUci, applyUci } from '../src/chess/game.ts'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

test('legalDests of the start position: 10 origin squares, 20 targets', () => {
  const d = legalDests(START)
  assert.equal(d.size, 10)
  let n = 0
  for (const t of d.values()) n += t.length
  assert.equal(n, 20)
  assert.deepEqual([...d.get('e2')!].sort(), ['e3', 'e4'])
})

test('needsPromotion: pawn a7-a8 yes, quiet pawn move no', () => {
  const fen = '4k3/P7/8/8/8/8/8/4K3 w - - 0 1'
  assert.equal(needsPromotion(fen, 'a7', 'a8'), true)
  assert.equal(needsPromotion(START, 'e2', 'e4'), false)
  assert.equal(needsPromotion(fen, 'e1', 'e2'), false)
})

test('toUci appends the promotion piece only when given', () => {
  assert.equal(toUci('e7', 'e8', 'n'), 'e7e8n')
  assert.equal(toUci('e2', 'e4'), 'e2e4')
})

test('applyUci castling gives O-O and the new FEN', () => {
  const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'
  const r = applyUci(fen, 'e1g1')!
  assert.equal(r.san, 'O-O')
  assert.equal(r.fen.split(' ')[0], 'r3k2r/8/8/8/8/8/8/R4RK1')
})

test('applyUci en passant gives exd6 and removes the pawn', () => {
  const fen = 'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3'
  const r = applyUci(fen, 'e5d6')!
  assert.equal(r.san, 'exd6')
  assert.equal(r.fen.split(' ')[0], 'rnbqkbnr/ppp1pppp/3P4/8/8/8/PPPP1PPP/RNBQKBNR')
})

test('applyUci returns null for illegal moves', () => {
  assert.equal(applyUci(START, 'e2e5'), null)
})

test('applyUci promotion gives =N in SAN, without a piece it is rejected', () => {
  const fen = '4k3/P7/8/8/8/8/8/4K3 w - - 0 1'
  assert.equal(applyUci(fen, 'a7a8n')!.san, 'a8=N')
  assert.equal(applyUci(fen, 'a7a8'), null)
})

test('applyUci returns null for a malformed FEN or UCI instead of throwing', () => {
  assert.equal(applyUci('not a fen', 'e2e4'), null)
  assert.equal(applyUci(START, ''), null)
})

test('isCheck is true only when the side to move is in check', () => {
  assert.equal(isCheck('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1'), true)
  assert.equal(isCheck(START), false)
})
