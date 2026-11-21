import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { ALL_MOVES, MOVE_INDEX, mirrorMove } from '../src/maia/vocab.ts'
import { eloCategory, maiaInput } from '../src/maia/encode.ts'
import { chooseMove } from '../src/maia/policy.ts'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const plane = (b: Float32Array, ch: number) => b.slice(ch * 64, ch * 64 + 64)
const at = (b: Float32Array, ch: number, row: number, col: number) => b[ch * 64 + row * 8 + col]

test('vocabulary: 1880 moves in the order of CSSLab/maia2 (hash of the move list from all_moves.json, file sha256 8a14d9f5…77c919f)', () => {
  assert.equal(ALL_MOVES.length, 1880)
  assert.equal(createHash('sha256').update(ALL_MOVES.join(' ')).digest('hex'), '7b9fa7388765eb6999fb0f9507d8a881aae27adea7ed6e62f2add3e749950147')
  assert.deepEqual([ALL_MOVES[0], ALL_MOVES[1], ALL_MOVES[2], MOVE_INDEX.get('a1h8')], ['a1h8', 'a1a8', 'a1g7', 0])
})

test('mirrorMove flips the rank (9 - rank) and keeps the promotion piece', () => {
  assert.equal(mirrorMove('e2e4'), 'e7e5')
  assert.equal(mirrorMove('a7a8q'), 'a2a1q')
})

test('eloCategory: <1100 = 0, 100 wide classes, >=2000 = 10, always clamped into 0..10 (M8)', () => {
  assert.deepEqual([1099, 1100, 1199, 1200, 1500, 1999, 2000, 3500, -40, 0].map(eloCategory), [0, 1, 1, 2, 5, 9, 10, 10, 0, 0])
  assert.throws(() => eloCategory(NaN), RangeError)
})

test('maiaInput, white to move: own pieces in planes 0-5, turn plane, castling planes, no en passant', () => {
  const { boards, eloSelf, eloOppo } = maiaInput(START, 1500)
  assert.equal(boards.length, 18 * 64)
  assert.equal(at(boards, 0, 1, 4), 1) // white pawn e2 = row 1, col 4
  assert.equal(at(boards, 5, 0, 4), 1) // white king e1
  assert.equal(at(boards, 6, 6, 4), 1) // black pawn e7
  assert.equal(plane(boards, 12).every((v) => v === 1), true)
  for (const ch of [13, 14, 15, 16]) assert.equal(plane(boards, ch).every((v) => v === 1), true)
  assert.equal(plane(boards, 17).some((v) => v !== 0), false)
  assert.deepEqual([eloSelf, eloOppo], [5, 5])
})

test('maiaInput, black to move: board mirrored (colours swapped, ranks flipped), turn plane stays 1, castling and en passant mirrored', () => {
  const { boards } = maiaInput('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b Kq e3 0 1', 1500)
  assert.equal(at(boards, 0, 1, 4), 1) // black pawn e7 -> own pawn on row 1
  assert.equal(at(boards, 6, 4, 4), 1) // white pawn e4 -> mirrored to rank 5 = row 4, opponent planes
  assert.equal(at(boards, 6, 3, 4), 0)
  assert.equal(plane(boards, 12).every((v) => v === 1), true)
  // planes 13..16 = own K, own Q, opponent K, opponent Q; own (black) has only q, opponent (white) only K
  assert.deepEqual([13, 14, 15, 16].map((ch) => plane(boards, ch)[0]), [0, 1, 1, 0])
  assert.equal(at(boards, 17, 5, 4), 1) // e3 -> e6 = row 5
})

test('maiaInput: the Elo of both sides is the level (category index)', () => {
  assert.deepEqual([maiaInput(START, 1100).eloSelf, maiaInput(START, 1900).eloSelf, maiaInput(START, 5000).eloSelf], [1, 9, 10])
})

test('chooseMove: only legal moves count, even if an illegal one has the highest logit (M9)', () => {
  const logits = new Float32Array(1880).fill(-5)
  logits[MOVE_INDEX.get('e2e4')!] = 1
  logits[MOVE_INDEX.get('e2e5')!] = 99 // illegal pawn jump
  assert.equal(chooseMove(logits, START, { temperature: 0, random: () => 0.5 }), 'e2e4')
})

test('chooseMove, black: the logits belong to the mirrored board, the answer is a real move', () => {
  const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
  const logits = new Float32Array(1880).fill(-5)
  logits[MOVE_INDEX.get('e2e4')!] = 3 // mirrored e7e5
  logits[MOVE_INDEX.get('e7e5')!] = 9 // would be an illegal move after mirroring
  assert.equal(chooseMove(logits, fen, { temperature: 0, random: () => 0 }), 'e7e5')
})

test('chooseMove: sampling follows the softmax of the legal logits', () => {
  const logits = new Float32Array(1880).fill(-50)
  logits[MOVE_INDEX.get('e2e4')!] = Math.log(0.8)
  logits[MOVE_INDEX.get('d2d4')!] = Math.log(0.2)
  const pick = (r: number) => chooseMove(logits, START, { temperature: 1, random: () => r })
  // legal moves are ordered by their UCI text: d2d4 (share 0.2) comes before e2e4 (share 0.8)
  assert.deepEqual([pick(0.01), pick(0.19), pick(0.21), pick(0.999)], ['d2d4', 'd2d4', 'e2e4', 'e2e4'])
})

test('chooseMove: low temperature sharpens the choice towards the best move', () => {
  const logits = new Float32Array(1880).fill(-50)
  logits[MOVE_INDEX.get('e2e4')!] = 1
  logits[MOVE_INDEX.get('d2d4')!] = 0.5
  assert.equal(chooseMove(logits, START, { temperature: 0.05, random: () => 0.9 }), 'e2e4')
})

test('chooseMove: castling and promotion moves are found, no legal move = error', () => {
  const castle = new Float32Array(1880).fill(-5)
  castle[MOVE_INDEX.get('e1g1')!] = 5
  assert.equal(chooseMove(castle, 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', { temperature: 0, random: () => 0 }), 'e1g1')
  const promo = new Float32Array(1880).fill(-5)
  promo[MOVE_INDEX.get('a7a8n')!] = 5
  assert.equal(chooseMove(promo, '8/P6k/8/8/8/8/8/K7 w - - 0 1', { temperature: 0, random: () => 0 }), 'a7a8n')
  assert.throws(() => chooseMove(new Float32Array(1880), '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', { temperature: 0, random: () => 0 }), /legal/i)
})
