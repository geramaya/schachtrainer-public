import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initialView } from '../src/games/open-view.ts'

test('a saved or imported game opens at the start position (index 0), not at the end', () => {
  assert.equal(initialView(40), 0)
  assert.equal(initialView(0), 0)
})

test('a deliberate jump to a move is kept, clamped into the game', () => {
  assert.equal(initialView(40, 7), 7)
  assert.equal(initialView(40, 99), 40)
  assert.equal(initialView(40, -3), 0)
  assert.equal(initialView(40, null), 0)
})
