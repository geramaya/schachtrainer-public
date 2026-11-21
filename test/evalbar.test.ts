import { test } from 'node:test'
import assert from 'node:assert/strict'
import { whiteShare, evalLabel } from '../src/coach/evalbar.ts'

test('whiteShare is 50 percent when equal and saturates at 800 centipawns', () => {
  assert.equal(whiteShare(0), 50)
  assert.equal(whiteShare(400), 75)
  assert.equal(whiteShare(-400), 25)
  assert.equal(whiteShare(5000), 100)
  assert.equal(whiteShare(-5000), 0)
})

test('evalLabel shows a signed pawn value with decimal comma, and a dash without evaluation', () => {
  assert.equal(evalLabel(44), '+0,4')
  assert.equal(evalLabel(-120), '-1,2')
  assert.equal(evalLabel(0), '0,0')
  assert.equal(evalLabel(null), '–')
})

test('evalLabel shows mate as #n for White and #-n against White, never as a pawn value', () => {
  assert.equal(evalLabel(10000, 3), '#3')
  assert.equal(evalLabel(-10000, -2), '#-2')
  assert.equal(evalLabel(10000), '#') // mate score without a distance (finished game)
  assert.equal(evalLabel(-10000), '#-')
  assert.doesNotMatch(evalLabel(10000, 1), /\d,\d/)
})
