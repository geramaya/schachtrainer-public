import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dayKey, recordTraining, streakDays, daysSinceLast, recentDays, nextDueLabel } from '../src/train/streak.ts'

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime()

test('dayKey is the local calendar day', () => {
  assert.equal(dayKey(at(2026, 11, 20, 23)), '2026-11-20')
  assert.equal(dayKey(at(2026, 1, 5, 0)), '2026-01-05')
})

test('recordTraining adds to the count of the day', () => {
  const d1 = recordTraining({}, at(2026, 11, 20), 1)
  const d2 = recordTraining(d1, at(2026, 11, 20, 18), 2)
  assert.deepEqual(d2, { '2026-11-20': 3 })
  assert.deepEqual(d1, { '2026-11-20': 1 }) // input not mutated
})

test('recordTraining keeps only the newest 120 days', () => {
  let d: Record<string, number> = {}
  for (let i = 0; i < 130; i++) d = recordTraining(d, at(2026, 1, 1) + i * 86_400_000, 1)
  assert.equal(Object.keys(d).length, 120)
  assert.equal(d['2026-01-01'], undefined)
})

test('streak counts consecutive days ending today or yesterday', () => {
  const days = { '2026-11-17': 2, '2026-11-18': 1, '2026-11-19': 4, '2026-11-20': 1 }
  assert.equal(streakDays(days, at(2026, 11, 20)), 4)
  assert.equal(streakDays({ '2026-11-19': 1, '2026-11-18': 1 }, at(2026, 11, 20)), 2) // today not yet trained: streak is still alive
  assert.equal(streakDays({ '2026-11-17': 1 }, at(2026, 11, 20)), 0)
  assert.equal(streakDays({ '2026-11-20': 1, '2026-11-18': 1 }, at(2026, 11, 20)), 1) // gap breaks it
  assert.equal(streakDays({}, at(2026, 11, 20)), 0)
})

test('streak survives a month boundary', () => {
  assert.equal(streakDays({ '2026-10-31': 1, '2026-11-01': 1 }, at(2026, 11, 1)), 2)
})

test('daysSinceLast gives whole days or null', () => {
  assert.equal(daysSinceLast({ '2026-11-17': 1 }, at(2026, 11, 20)), 3)
  assert.equal(daysSinceLast({ '2026-11-20': 1 }, at(2026, 11, 20)), 0)
  assert.equal(daysSinceLast({}, at(2026, 11, 20)), null)
})

test('recentDays lists n days oldest first with counts', () => {
  const r = recentDays({ '2026-11-19': 4, '2026-11-20': 1 }, at(2026, 11, 20), 3)
  assert.deepEqual(r, [{ day: '2026-11-18', count: 0 }, { day: '2026-11-19', count: 4 }, { day: '2026-11-20', count: 1 }])
})

test('nextDueLabel names the earliest future due time', () => {
  const now = at(2026, 11, 20, 10)
  assert.equal(nextDueLabel(undefined, now), null)
  assert.equal(nextDueLabel(now + 3_600_000, now), 'heute später')
  assert.equal(nextDueLabel(at(2026, 11, 21, 9), now), 'morgen')
  assert.equal(nextDueLabel(at(2026, 11, 24, 9), now), 'in 4 Tagen')
})

test('daysSinceLast never goes negative when the last day lies in the future', () => {
  assert.equal(daysSinceLast({ '2026-11-22': 1 }, at(2026, 11, 20)), 0)
})
