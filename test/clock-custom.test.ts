import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MINUTE_STEPS, customTimeControl, parseTimeControl, pgnTimeControl } from '../src/train/clock.ts'

test('minute steps like Lichess: a quarter, a half, three quarters, then 1 to 180', () => {
  assert.deepEqual(MINUTE_STEPS.slice(0, 5), [0.25, 0.5, 0.75, 1, 2])
  assert.equal(MINUTE_STEPS.at(-1), 180)
  assert.equal(MINUTE_STEPS.length, 3 + 180)
})

test('customTimeControl: label "7+3", PGN seconds, validated', () => {
  const t = customTimeControl(7, 3)!
  assert.deepEqual([t.id, t.label, t.baseMs, t.incMs, pgnTimeControl(t)], ['c:7+3', '7+3', 420_000, 3000, '420+3'])
  assert.equal(customTimeControl(0.25, 0)!.label, '¼+0')
  assert.equal(pgnTimeControl(customTimeControl(0.25, 0)!), '15+0')
  assert.equal(customTimeControl(0.75, 10)!.label, '¾+10')
  assert.equal(customTimeControl(0, 0), null) // 0+0 is not allowed
  assert.equal(customTimeControl(0, 5), null)
  assert.equal(customTimeControl(181, 0), null)
  assert.equal(customTimeControl(2.5, 0), null) // not a step
  assert.equal(customTimeControl(5, 181), null)
  assert.equal(customTimeControl(5, -1), null)
  assert.equal(customTimeControl(5, 1.5), null)
})

test('parseTimeControl: stored custom values come back, broken ones do not', () => {
  assert.deepEqual(parseTimeControl('c:7+3'), customTimeControl(7, 3))
  assert.deepEqual(parseTimeControl('c:0.25+0'), customTimeControl(0.25, 0))
  for (const bad of ['c:0+0', 'c:181+0', 'c:5+181', 'c:x+y', 'c:5', 'c:2.5+0']) assert.equal(parseTimeControl(bad), null, bad)
  assert.equal(parseTimeControl('3+2')!.id, '3+2')
})
