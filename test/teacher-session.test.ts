import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canKeep, undoHeld } from '../src/teacher/session.ts'
import type { Held } from '../src/teacher/session.ts'
import { cardsFromErrors } from '../src/train/review.ts'
import type { ReviewError } from '../src/train/review.ts'
import { Chess } from 'chess.js'
import { cardKey } from '../src/train/card-id.ts'
import { positionKey } from '../src/chess/position.ts'

const held: Held = {
  uci: 'a2a3', fenBefore: new Chess().fen(), san: 'a3', hinted: false, revealed: false,
  j: { rating: 'patzer', lossCp: 300, facts: [], text: '', reveal: '', bestWhy: null, betterUci: 'e2e4', betterSan: 'e4' },
}

test('undo during play removes the held move and records it as a retracted error', () => {
  const r = undoHeld(held, ['a2a3'], 'play')!
  assert.deepEqual(r.ucis, [])
  assert.deepEqual(r.error, { ply: 0, uci: 'a2a3', san: 'a3', lossCp: 300, severity: 'patzer', fenBefore: held.fenBefore, betterUci: 'e2e4', betterSan: 'e4' })
})

test('after the game is over (resigned) the held move can neither be undone nor kept', () => {
  assert.equal(undoHeld(held, ['a2a3'], 'over'), null)
  assert.equal(canKeep(held, 'over'), false)
  assert.equal(canKeep(held, 'play'), true)
  assert.equal(canKeep(null, 'play'), false)
  assert.equal(undoHeld(null, ['a2a3'], 'play'), null)
})

test('retracted and kept mistakes are trained independently, whichever is clicked first', () => {
  const mk = (uci: string, san: string, fen: string): ReviewError => ({ ply: 0, uci, san, lossCp: 300, severity: 'patzer', fenBefore: fen, betterUci: 'e2e4', betterSan: 'e4' })
  const retracted = [mk('a2a3', 'a3', new Chess().fen())]
  const afterE4 = new Chess()
  afterE4.move('e4')
  const kept = [mk('a7a6', 'a6', afterE4.fen())]
  const first = cardsFromErrors(retracted, 'v1', 'scotch', 'c1', {})
  const existing = Object.fromEntries(first.map((c) => [cardKey(c.openingId!, c.key), c]))
  const second = cardsFromErrors([...retracted, ...kept], 'v1', 'scotch', 'c1', existing)
  assert.deepEqual(second.map((c) => c.key), [positionKey(afterE4.fen())])
})
