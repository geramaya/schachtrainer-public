import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canStartByMove, flipIntent, parseSideChoice, resolveSide } from '../src/train/free-start.ts'

const idle = { phase: 'setup' as const, free: true, hasStartFen: false }

test('resolveSide: Zufall is drawn at the start, a fixed choice stays', () => {
  assert.equal(resolveSide('white', 0.9), 'white')
  assert.equal(resolveSide('black', 0.1), 'black')
  assert.equal(resolveSide('random', 0.1), 'white')
  assert.equal(resolveSide('random', 0.7), 'black')
})

test('parseSideChoice: stored data is validated, default white', () => {
  assert.equal(parseSideChoice('random'), 'random')
  assert.equal(parseSideChoice('purple'), 'white')
  assert.equal(parseSideChoice(null), 'white')
})

test('the first move on the board starts a free game from the start position, for White only', () => {
  assert.equal(canStartByMove({ ...idle, side: 'white' }), true)
  assert.equal(canStartByMove({ ...idle, side: 'black' }), false) // the engine has to move first
  assert.equal(canStartByMove({ ...idle, side: 'random' }), false)
  assert.equal(canStartByMove({ ...idle, side: 'white', hasStartFen: true }), false)
  assert.equal(canStartByMove({ ...idle, side: 'white', free: false }), false)
  assert.equal(canStartByMove({ ...idle, side: 'white', phase: 'play' }), false)
})

test('flip before the first move changes the side (Black: the trainer starts at once); in a running game it is only the view', () => {
  assert.deepEqual(flipIntent({ ...idle, side: 'white' }), { kind: 'side', side: 'black', start: true })
  assert.deepEqual(flipIntent({ ...idle, side: 'black' }), { kind: 'side', side: 'white', start: false })
  assert.deepEqual(flipIntent({ ...idle, side: 'random' }), { kind: 'side', side: 'black', start: true })
  assert.deepEqual(flipIntent({ ...idle, side: 'white', phase: 'play' }), { kind: 'view' })
  assert.deepEqual(flipIntent({ ...idle, side: 'white', hasStartFen: true }), { kind: 'view' })
  assert.deepEqual(flipIntent({ ...idle, side: 'white', free: false }), { kind: 'view' })
})
