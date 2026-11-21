import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toGermanSan, formatLine } from '../src/chess/notation.ts'

test('toGermanSan maps piece letters', () => {
  assert.equal(toGermanSan('Nf3'), 'Sf3')
  assert.equal(toGermanSan('Bxc4'), 'Lxc4')
  assert.equal(toGermanSan('Rae1'), 'Tae1')
  assert.equal(toGermanSan('Qh4+'), 'Dh4+')
  assert.equal(toGermanSan('Kf1'), 'Kf1')
})

test('toGermanSan maps promotion pieces', () => {
  assert.equal(toGermanSan('exd8=Q#'), 'exd8=D#')
  assert.equal(toGermanSan('e8=N+'), 'e8=S+')
})

test('toGermanSan leaves castling and pawn moves alone', () => {
  assert.equal(toGermanSan('O-O'), 'O-O')
  assert.equal(toGermanSan('O-O-O+'), 'O-O-O+')
  assert.equal(toGermanSan('e4'), 'e4')
  assert.equal(toGermanSan('bxc3'), 'bxc3')
})

test('formatLine numbers moves, German notation', () => {
  assert.equal(formatLine(['e4', 'e5', 'Nf3']), '1. e4 e5 2. Sf3')
  assert.equal(formatLine(['e4', 'e5', 'Nf3', 'Nc6']), '1. e4 e5 2. Sf3 Sc6')
})

test('formatLine starting with black uses ellipsis', () => {
  assert.equal(formatLine(['e5'], 1), '1… e5')
  assert.equal(formatLine(['e5', 'Nf3', 'Nc6'], 1), '1… e5 2. Sf3 Sc6')
})

test('formatLine of empty line is empty', () => {
  assert.equal(formatLine([]), '')
})
