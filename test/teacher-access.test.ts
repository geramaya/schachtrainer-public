import { test } from 'node:test'
import assert from 'node:assert/strict'
import { access } from '../src/teacher/access.ts'
import type { AccessInput } from '../src/teacher/access.ts'

const base: AccessInput = { phase: 'play', withTeacher: false, thinking: false, judging: false, analysing: false, helping: false, pending: false, myTurn: true, browsing: false, engineUnlocked: false, analyseWhileThinking: false }
const bools = [false, true]

test('Wertungspartie (no teacher) while playing: no helps at all, in every state', () => {
  for (const thinking of bools) for (const judging of bools) for (const pending of bools) for (const myTurn of bools) for (const engineUnlocked of bools) {
    const a = access({ ...base, thinking, judging, pending, myTurn, engineUnlocked })
    const why = JSON.stringify({ thinking, judging, pending, myTurn, engineUnlocked })
    assert.equal(a.engineLock, 'task', why) // locked, "trotzdem anzeigen" does not lift it
    assert.equal(a.coachEngine, false, why)
    assert.equal(a.coachShapes, false, why)
    assert.equal(a.coachPanel, false, why)
    assert.equal(a.layersLocked, true, why)
    assert.equal(a.canAsk, false, why)
  }
})

test('teacher game while playing: engine panel locked unless the player lifts it, no coach arrows or recommendations, coach panel stays', () => {
  for (const thinking of bools) for (const judging of bools) for (const pending of bools) for (const myTurn of bools) {
    const a = access({ ...base, withTeacher: true, thinking, judging, pending, myTurn })
    assert.equal(a.engineLock, 'task')
    assert.equal(a.coachEngine, false)
    assert.equal(a.coachShapes, false)
    assert.equal(a.coachPanel, true)
    assert.equal(a.layersLocked, false)
  }
})

test('outside a running game everything is free again (setup, finished game); "busy" while the review runs', () => {
  for (const withTeacher of bools) for (const phase of ['setup', 'over'] as const) {
    const a = access({ ...base, phase, withTeacher })
    assert.deepEqual([a.engineLock, a.coachPanel, a.coachShapes, a.layersLocked], [null, true, true, false], `${phase} ${withTeacher}`)
    assert.equal(a.coachEngine, true)
    assert.equal(access({ ...base, phase, withTeacher, analysing: true }).engineLock, 'busy')
  }
})

test('help buttons only on the own turn of a teacher game, never while something is running or a move is held', () => {
  assert.equal(access({ ...base, withTeacher: true }).canAsk, true)
  for (const patch of [{ myTurn: false }, { thinking: true }, { judging: true }, { helping: true }, { pending: true }, { browsing: true }, { phase: 'over' as const }, { phase: 'setup' as const }]) {
    assert.equal(access({ ...base, withTeacher: true, ...patch }).canAsk, false, JSON.stringify(patch))
  }
  assert.equal(access({ ...base, withTeacher: false }).canAsk, false)
})

test('teacher game: the lock holds only until the player lifts it on purpose; busy while the engine works unless "auch während Stockfish denkt"', () => {
  const t = { ...base, withTeacher: true }
  assert.equal(access({ ...t, engineUnlocked: true }).engineLock, null)
  assert.equal(access({ ...t, engineUnlocked: true, thinking: true }).engineLock, 'busy')
  assert.equal(access({ ...t, engineUnlocked: true, judging: true }).engineLock, 'busy')
  assert.equal(access({ ...t, engineUnlocked: true, thinking: true, analyseWhileThinking: true }).engineLock, null)
  assert.equal(access({ ...t, engineUnlocked: false, analyseWhileThinking: true }).engineLock, 'task')
  assert.equal(access({ ...t, engineUnlocked: true }).coachEngine, false)
})
