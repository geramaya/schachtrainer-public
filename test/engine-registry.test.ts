import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRegistry } from '../src/engine/registry.ts'
import { fakeEngine } from './fake-engine.ts'
import type { FakeEngine } from './fake-engine.ts'

function setup() {
  const made: FakeEngine[] = []
  const reg = createRegistry(() => { const e = fakeEngine(); made.push(e); return e })
  return { reg, made }
}

test('the engine is created on first use and shared by game and coach', () => {
  const { reg, made } = setup()
  assert.equal(made.length, 0)
  reg.getEngine(); reg.getCoachEngine()
  assert.equal(made.length, 1)
})

test('resetEngine disposes the engine; the next use starts a fresh one', () => {
  const { reg, made } = setup()
  reg.getEngine()
  reg.resetEngine()
  assert.ok(made[0]!.disposed)
  reg.getEngine()
  assert.equal(made.length, 2)
})

test('a late reset for an old engine does not throw away the new healthy one', () => {
  const { reg, made } = setup()
  reg.getCoachEngine()
  const oldEpoch = reg.engineEpoch()
  reg.resetEngine('game', oldEpoch) // the old engine failed and was replaced
  reg.getCoachEngine()
  reg.resetEngine('coach', oldEpoch) // the failure report of the old worker arrives late
  assert.equal(made.length, 2)
  assert.equal(made[1]!.disposed, false)
  reg.resetEngine('coach', reg.engineEpoch())
  assert.ok(made[1]!.disposed)
})
