import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyProgress, exportProgress, importProgress } from '../src/store/progress.ts'
import { DEFAULT_COACH_MODE, coachModeFor, withCoachMode } from '../src/coach/mode.ts'

test('defaults: drill and riddles after the move, the rest always', () => {
  assert.deepEqual(DEFAULT_COACH_MODE, { lernen: 'immer', verstehen: 'nach-zug', festigen: 'nach-zug', anwenden: 'immer', raetsel: 'nach-zug' })
  assert.equal(coachModeFor(emptyProgress().settings, 'festigen'), 'nach-zug')
})

test('old saved state without coachMode still loads with defaults', () => {
  const old = JSON.stringify({ schema: 1, cards: {}, overlays: {}, feedback: {}, settings: { sparringElo: 1700 } })
  const p = importProgress(old)
  assert.equal(p.settings.sparringElo, 1700)
  assert.equal(coachModeFor(p.settings, 'lernen'), 'immer')
})

test('chosen mode survives export and import', () => {
  const p = emptyProgress()
  const changed = { ...p, settings: withCoachMode(p.settings, 'festigen', 'aus') }
  const back = importProgress(exportProgress(changed))
  assert.equal(coachModeFor(back.settings, 'festigen'), 'aus')
  assert.equal(coachModeFor(back.settings, 'lernen'), 'immer')
})

test('invalid stored values are dropped, valid ones kept', () => {
  const raw = JSON.stringify({ schema: 1, cards: {}, overlays: {}, feedback: {}, settings: { sparringElo: 1500, coachMode: { lernen: 'kaputt', festigen: 'aus', unbekannt: 'immer' } } })
  const s = importProgress(raw).settings
  assert.equal(coachModeFor(s, 'lernen'), 'immer')
  assert.equal(coachModeFor(s, 'festigen'), 'aus')
})
