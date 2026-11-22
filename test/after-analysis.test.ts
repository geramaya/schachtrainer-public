import { test } from 'node:test'
import assert from 'node:assert/strict'
import { afterAnalysisHash } from '../src/games/after-analysis.ts'

test('after the end-of-game analysis the saved game opens in the game view (same as from "Meine Partien")', () => {
  assert.equal(afterAnalysisHash('abc', true), '#/meine-partien/abc')
})

test('without a stored game or when the results were not stored the page stays where it is (the result is still shown there)', () => {
  assert.equal(afterAnalysisHash(null, true), null)
  assert.equal(afterAnalysisHash('abc', false), null)
})
