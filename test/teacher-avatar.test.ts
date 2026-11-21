import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FIGUREN, avatarChain, parseTeacher, teacherOf } from '../src/teacher/avatar.ts'
import { importProgress, exportProgress, emptyProgress } from '../src/store/progress.ts'

test('image chain: the feeling, then neutral of the same figure; neutral alone has one entry', () => {
  assert.deepEqual(avatarChain('fuchs', 'entsetzt', '/'), ['/lehrer/fuchs-entsetzt.webp', '/lehrer/fuchs-neutral.webp'])
  assert.deepEqual(avatarChain('mann', 'neutral', '/'), ['/lehrer/mann-neutral.webp'])
})

test('teacher setting: default on with Jonas; stored value survives export/import; garbage falls back', () => {
  assert.deepEqual(teacherOf({}), { on: true, figur: 'mann', quips: false, speak: false, hold: 'blunder' })
  assert.deepEqual(parseTeacher({ on: false, figur: 'fuchs' }), { on: false, figur: 'fuchs' })
  assert.deepEqual(parseTeacher({ on: 'ja', figur: 'drache' }), {})
  const p = emptyProgress()
  p.settings = { ...p.settings, teacher: { on: false, figur: 'meister' } }
  assert.deepEqual(importProgress(exportProgress(p)).settings.teacher, { on: false, figur: 'meister' })
  assert.equal(importProgress(JSON.stringify({ schema: 1, cards: {}, overlays: {}, settings: { sparringElo: 1500 } })).settings.teacher, undefined)
})

test('quip settings: off by default, stored and imported, garbage dropped', () => {
  assert.deepEqual(teacherOf({ teacher: { quips: true } }), { on: true, figur: 'mann', quips: true, speak: false, hold: 'blunder' })
  assert.deepEqual(parseTeacher({ quips: true, speak: true }), { quips: true, speak: true })
  assert.deepEqual(parseTeacher({ quips: 'ja', speak: 1 }), {})
  const p = emptyProgress()
  p.settings = { ...p.settings, teacher: { quips: true, speak: true } }
  assert.deepEqual(importProgress(exportProgress(p)).settings.teacher, { quips: true, speak: true })
})
