import { test } from 'node:test'
import assert from 'node:assert/strict'
import { access } from '../src/teacher/access.ts'
import type { AccessInput } from '../src/teacher/access.ts'

const base: AccessInput = { phase: 'play', withTeacher: false, free: false, along: false, thinking: false, judging: false, analysing: false, helping: false, pending: false, myTurn: true, browsing: false }
const bools = [false, true]

test('teacher game: while playing the engine panel is locked and the coach panel recommends nothing, in every state', () => {
  for (const free of bools) for (const along of bools) for (const thinking of bools) for (const judging of bools) for (const pending of bools) for (const myTurn of bools) {
    const a = access({ ...base, withTeacher: true, free, along, thinking, judging, pending, myTurn })
    assert.equal(a.engineLock, 'task', JSON.stringify({ free, along, thinking, judging, pending, myTurn }))
    assert.equal(a.coachEngine, false)
  }
})

test('free game without teacher: engine panel only with "mitlaufen" (busy while the engine itself works)', () => {
  assert.deepEqual(access({ ...base, free: true }), { engineLock: 'task', coachEngine: false, canAsk: false })
  assert.equal(access({ ...base, free: true, along: true }).engineLock, null)
  assert.equal(access({ ...base, free: true, along: true, thinking: true }).engineLock, 'busy')
  assert.equal(access({ ...base, free: true, along: true }).coachEngine, true)
  assert.equal(access({ ...base, free: true, along: true, thinking: true }).coachEngine, false)
})

test('variation sparring without teacher keeps its old behaviour (panel locked, coach may run on the own turn)', () => {
  assert.deepEqual(access(base), { engineLock: 'task', coachEngine: true, canAsk: false })
})

test('outside a running game: nothing is locked, "busy" while the review runs', () => {
  for (const phase of ['setup', 'over'] as const) {
    assert.equal(access({ ...base, phase, withTeacher: true }).engineLock, null)
    assert.equal(access({ ...base, phase, withTeacher: true, analysing: true }).engineLock, 'busy')
  }
})

test('help buttons only on the own turn of a teacher game, never while something is running or a move is held', () => {
  assert.equal(access({ ...base, withTeacher: true }).canAsk, true)
  for (const patch of [{ myTurn: false }, { thinking: true }, { judging: true }, { helping: true }, { pending: true }, { browsing: true }, { phase: 'over' as const }, { phase: 'setup' as const }]) {
    assert.equal(access({ ...base, withTeacher: true, ...patch }).canAsk, false, JSON.stringify(patch))
  }
  assert.equal(access({ ...base, withTeacher: false }).canAsk, false)
})
