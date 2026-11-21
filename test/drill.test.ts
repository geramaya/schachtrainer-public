import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickReply, opponentMove, isLineIncomplete } from '../src/train/drill.ts'
import { lineBundle, keyAfter } from './helpers.ts'

// Opponent (black) has two known replies after 1. e4: e5 (leads to a due card at 2. Nf3) and c5 (no card below).
const b = lineBundle(['e4', 'e5', 'Nf3'], true, { 1: ['c5'] })
const afterE4 = keyAfter(['e4'])

test('pickReply prefers the reply whose subtree holds a due card', () => {
  const due = new Set([keyAfter(['e4', 'e5'])])
  for (let i = 0; i < 20; i++) assert.equal(pickReply(b, 'scotch', afterE4, due, {}, () => i / 20)!.san, 'e5')
})

test('pickReply falls back to any known reply when no due card is below', () => {
  const sans = new Set<string>()
  for (let i = 0; i < 20; i++) sans.add(pickReply(b, 'scotch', afterE4, new Set(), {}, () => i / 20)!.san)
  assert.deepEqual([...sans].sort(), ['c5', 'e5'])
})

test('pickReply returns null outside the book', () => {
  assert.equal(pickReply(b, 'scotch', keyAfter(['d4']), new Set(), {}, () => 0), null)
  assert.equal(pickReply(b, 'scotch', keyAfter(['e4', 'e5', 'Nf3']), new Set(), {}, () => 0), null)
})

// Variation v1 ends after 1. e4 e5 2. Nf3 (3 plies); the book continues 2...Nc6 3. d4 below it and has a second reply 1...c5.
const b2 = lineBundle(['e4', 'e5', 'Nf3', 'Nc6', 'd4'], true, { 1: ['c5'] }, 3)

test('opponentMove follows the variation line even when another branch holds the due card', () => {
  const due = new Set([keyAfter(['e4', 'c5'])])
  for (let i = 0; i < 10; i++) assert.equal(opponentMove(b2, 'v1', keyAfter(['e4']), due, {}, () => i / 10)!.san, 'e5')
})

test('opponentMove below the line end picks from the known replies; null when the subtree ends', () => {
  assert.equal(opponentMove(b2, 'v1', keyAfter(['e4', 'e5', 'Nf3']), new Set(), {}, () => 0)!.san, 'Nc6')
  assert.equal(opponentMove(b2, 'v1', keyAfter(['e4', 'e5', 'Nf3', 'Nc6', 'd4']), new Set(), {}, () => 0), null)
})

test('opponentMove returns null instead of throwing on an invalid SAN in the line', () => {
  const bad = lineBundle(['e4', 'e5', 'Nf3'], true)
  bad.openings[0]!.variations[0]!.line[1] = 'Qxz9'
  assert.equal(opponentMove(bad, 'v1', keyAfter(['e4']), new Set(), {}, () => 0), null)
})

test('isLineIncomplete: true while the position is inside the line, false at its end or off it', () => {
  const full = lineBundle(['e4', 'e5', 'Nf3'], true)
  assert.equal(isLineIncomplete(full, 'v1', keyAfter(['e4'])), true)
  assert.equal(isLineIncomplete(full, 'v1', keyAfter(['e4', 'e5', 'Nf3'])), false)
  assert.equal(isLineIncomplete(full, 'v1', keyAfter(['d4'])), false)
})
