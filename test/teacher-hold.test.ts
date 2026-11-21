import { test } from 'node:test'
import assert from 'node:assert/strict'
import { holds, parseHold } from '../src/teacher/hold.ts'
import { parseTeacher, teacherOf } from '../src/teacher/avatar.ts'

test('holds: "both" stops at Fehler and Patzer, "blunder" only at Patzer, "never" at nothing', () => {
  assert.deepEqual((['ungenau', 'fehler', 'patzer'] as const).map((r) => holds(r, 'both')), [false, true, true])
  assert.deepEqual((['ungenau', 'fehler', 'patzer'] as const).map((r) => holds(r, 'blunder')), [false, false, true])
  assert.deepEqual((['ungenau', 'fehler', 'patzer'] as const).map((r) => holds(r, 'never')), [false, false, false])
})

test('hold setting: default "blunder", stored data is validated', () => {
  assert.equal(teacherOf({}).hold, 'blunder')
  assert.equal(teacherOf({ teacher: { hold: 'both' } }).hold, 'both')
  assert.deepEqual(parseTeacher({ hold: 'never' }), { hold: 'never' })
  assert.deepEqual(parseTeacher({ hold: 'sometimes' }), {})
  assert.equal(parseHold('x'), undefined)
})
