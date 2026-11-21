import { test } from 'node:test'
import assert from 'node:assert/strict'
import { autoExplain, parseExplain } from '../src/teacher/explain.ts'

const RATINGS = ['best', 'excellent', 'gut', 'ungenau', 'fehler', 'patzer'] as const

test('autoExplain: "bei Fehler + Patzer" explains both automatically, "nur bei Patzer" only the blunder, "auf Knopfdruck" never; Ungenau only on the button', () => {
  assert.deepEqual(RATINGS.map((r) => autoExplain(r, 'both')), [false, false, false, false, true, true])
  assert.deepEqual(RATINGS.map((r) => autoExplain(r, 'blunder')), [false, false, false, false, false, true])
  assert.deepEqual(RATINGS.map((r) => autoExplain(r, 'button')), [false, false, false, false, false, false])
})

test('parseExplain: stored data is validated', () => {
  assert.equal(parseExplain('blunder'), 'blunder')
  assert.equal(parseExplain('sometimes'), undefined)
  assert.equal(parseExplain(true), undefined)
})
