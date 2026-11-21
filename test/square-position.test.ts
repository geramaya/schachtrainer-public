import { test } from 'node:test'
import assert from 'node:assert/strict'
import { squarePercent } from '../src/chess/squarePosition.ts'

test('a1 is bottom-left for white and top-right for black', () => {
  assert.deepEqual(squarePercent('a1', 'white'), { left: 0, top: 87.5 })
  assert.deepEqual(squarePercent('a1', 'black'), { left: 87.5, top: 0 })
})

test('e4 sits in the middle area for both orientations', () => {
  assert.deepEqual(squarePercent('e4', 'white'), { left: 50, top: 50 })
  assert.deepEqual(squarePercent('e4', 'black'), { left: 37.5, top: 37.5 })
})
