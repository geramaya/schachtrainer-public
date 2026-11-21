import { test } from 'node:test'
import assert from 'node:assert/strict'
import { puzzleStart, puzzleStep, sortPuzzles } from '../src/train/puzzle.ts'
import type { Puzzle } from '../src/content/types.ts'

const mk = (over: Partial<Puzzle>): Puzzle => ({ id: 'p', fen: '', moves: [], rating: 1500, themes: [], openingTags: [], url: '', ...over })

// Lichess format: moves[0] is the opponent move, then user / opponent alternate. User promotes on b2a1.
const promo = mk({ fen: 'r1bk2r1/ppppn1pp/8/2Q5/4P3/5N2/Pp3PPP/RN2K2R w KQ - 0 12', moves: ['e1g1', 'b2a1q', 'b1c3', 'a1b2'] })

test('puzzleStart plays the opponent move and gives the user side', () => {
  const s = puzzleStart(promo)
  assert.equal(s.userSide, 'black')
  assert.deepEqual(s.lastMove, ['e1', 'g1'])
  assert.ok(s.fen.startsWith('r1bk2r1/ppppn1pp/8/2Q5/4P3/5N2/Pp3PPP/RN3RK1 b'))
})

test('puzzleStep: correct promotion, wrong promotion piece, wrong move, last move solves', () => {
  assert.equal(puzzleStep(promo, ['e1g1'], 'b2a1q'), 'richtig')
  assert.equal(puzzleStep(promo, ['e1g1'], 'b2a1r'), 'falsch')
  assert.equal(puzzleStep(promo, ['e1g1'], 'a7a6'), 'falsch')
  assert.equal(puzzleStep(promo, ['e1g1', 'b2a1q', 'b1c3'], 'a1b2'), 'gelöst')
})

test('puzzleStep: any mate in one counts as solved, a non-mating alternative does not', () => {
  const p = mk({ fen: '6k1/5ppp/8/8/8/8/5PPP/RR4K1 b - - 0 1', moves: ['g8h8', 'a1a8'] })
  assert.equal(puzzleStep(p, ['g8h8'], 'a1a8'), 'gelöst')
  assert.equal(puzzleStep(p, ['g8h8'], 'b1b8'), 'gelöst')
  assert.equal(puzzleStep(p, ['g8h8'], 'g1f1'), 'falsch')
})

test('puzzleStep: a broken puzzle whose listed move is illegal never counts as solved', () => {
  const p = mk({ fen: '6k1/p4ppp/8/8/8/8/5PPP/RR4K1 b - - 0 1', moves: ['a7a6', 'a1a8'] }) // a6 blocks the a-file
  assert.equal(puzzleStep(p, ['a7a6'], 'a1a8'), 'falsch')
})

test('sortPuzzles orders by rating ascending without mutating the input', () => {
  const list = [mk({ id: 'c', rating: 1900 }), mk({ id: 'a', rating: 1200 }), mk({ id: 'b', rating: 1500 })]
  assert.deepEqual(sortPuzzles(list).map((p) => p.id), ['a', 'b', 'c'])
  assert.deepEqual(list.map((p) => p.id), ['c', 'a', 'b'])
})
