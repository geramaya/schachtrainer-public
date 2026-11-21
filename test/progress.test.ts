import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyProgress, loadProgress, saveProgress, exportProgress, importProgress, tryImport, KEY, LEGACY_FEEDBACK_KEY, DEFECT_KEY } from '../src/store/progress.ts'
import type { Progress } from '../src/store/progress.ts'

class MemStorage {
  m = new Map<string, string>()
  getItem(k: string) { return this.m.get(k) ?? null }
  setItem(k: string, v: string) { this.m.set(k, v) }
  removeItem(k: string) { this.m.delete(k) }
}
const asStorage = (s: MemStorage) => s as unknown as Storage

const sample = (): Progress => ({
  ...emptyProgress(),
  cards: { k: { openingId: 'scotch', key: 'k', expectedUci: 'e2e4', variationId: 'v', due: 1, intervalDays: 3, ease: 2.5, reps: 2, lapses: 0, contentVersion: 'c', origin: 'baum' } },
  overlays: { scotch: { k: 'd2d4' } },
  feedback: { e1: { verdict: 'passt', contentVersion: 'c' } },
})

test('empty, missing or broken storage gives the empty state without throwing', () => {
  const s = new MemStorage()
  assert.deepEqual(loadProgress(asStorage(s)), emptyProgress())
  s.setItem(KEY, '{kaputt')
  assert.deepEqual(loadProgress(asStorage(s)), emptyProgress())
  s.setItem(KEY, '{"schema":99}')
  assert.deepEqual(loadProgress(asStorage(s)), emptyProgress())
})

test('save then load round-trips; export then import round-trips', () => {
  const s = new MemStorage(); const p = sample()
  saveProgress(asStorage(s), p)
  assert.deepEqual(loadProgress(asStorage(s)), p)
  assert.deepEqual(importProgress(exportProgress(p)), p)
})

test('importProgress throws on broken JSON or unknown schema', () => {
  assert.throws(() => importProgress('{kaputt'))
  assert.throws(() => importProgress('{"schema":2,"cards":{}}'))
  assert.throws(() => importProgress('[]'))
})

test('tryImport: a failed import reports the error and leaves the stored state untouched', () => {
  const s = new MemStorage(); saveProgress(asStorage(s), sample())
  const before = s.getItem(KEY)
  const r = tryImport(asStorage(s), '{kaputt')
  assert.equal(r.ok, false)
  assert.equal(s.getItem(KEY), before)
})

test('tryImport: a good import is stored and returned', () => {
  const s = new MemStorage()
  const r = tryImport(asStorage(s), exportProgress(sample()))
  assert.equal(r.ok, true)
  assert.deepEqual(loadProgress(asStorage(s)), sample())
})

test('a stored state that cannot be read is kept under the defect key before anything overwrites it', () => {
  const s = new MemStorage(); s.setItem(KEY, '{"schema":99,"x":1}')
  assert.deepEqual(loadProgress(asStorage(s)), emptyProgress())
  assert.equal(s.getItem(DEFECT_KEY), '{"schema":99,"x":1}')
})

test('the legacy feedback key is kept when saving fails', () => {
  const s = new MemStorage(); s.setItem(LEGACY_FEEDBACK_KEY, '{"e":{"verdict":"passt","contentVersion":"c"}}')
  s.setItem = () => { throw new Error('quota') }
  assert.equal(loadProgress(asStorage(s)).feedback.e!.verdict, 'passt')
  assert.notEqual(s.getItem(LEGACY_FEEDBACK_KEY), null)
})

test('legacy feedback key is migrated once into the progress and removed', () => {
  const s = new MemStorage()
  s.setItem(LEGACY_FEEDBACK_KEY, JSON.stringify({ e9: { verdict: 'stimmt-nicht', note: 'x', contentVersion: 'c0' } }))
  const p = loadProgress(asStorage(s))
  assert.equal(p.feedback.e9!.verdict, 'stimmt-nicht')
  assert.equal(s.getItem(LEGACY_FEEDBACK_KEY), null)
  assert.equal(loadProgress(asStorage(s)).feedback.e9!.note, 'x')
})

test('older saved states without days/understood/applied load with empty defaults', () => {
  const old = JSON.stringify({ schema: 1, cards: {}, overlays: {}, feedback: {}, settings: { sparringElo: 1500 } })
  const p = importProgress(old)
  assert.deepEqual(p.days, {})
  assert.deepEqual(p.understood, [])
  assert.deepEqual(p.applied, [])
})

test('days, understood and applied survive export/import; malformed values are dropped', () => {
  const p = { ...sample(), days: { '2026-11-20': 3 }, understood: ['q1'], applied: ['v1'] }
  assert.deepEqual(importProgress(exportProgress(p)), p)
  const bad = JSON.stringify({ ...p, days: { '2026-11-20': 'x', nope: 2, '2026-11-19': 4 }, understood: ['q1', 5], applied: 'v1' })
  const q = importProgress(bad)
  assert.deepEqual(q.days, { '2026-11-19': 4 })
  assert.deepEqual(q.understood, ['q1'])
  assert.deepEqual(q.applied, [])
})

test('parseDays keeps only positive finite counts', () => {
  const raw = JSON.stringify({ ...sample(), days: { '2026-11-01': 0, '2026-11-02': -3, '2026-11-03': 2, '2026-11-04': 1.5 } })
  assert.deepEqual(importProgress(raw).days, { '2026-11-03': 2, '2026-11-04': 1.5 })
})

test('hero memory (last visit snapshot, last course) survives export and import; garbage is dropped', async () => {
  const { importProgress, exportProgress, emptyProgress } = await import('../src/store/progress.ts')
  const p = { ...emptyProgress(), settings: { sparringElo: 1500, visit: { at: 1700000000000, stagesDone: 4, streak: 3 }, lastCourse: { variationId: 'v1', stage: 'festigen' as const } } }
  const back = importProgress(exportProgress(p))
  assert.deepEqual(back.settings.visit, { at: 1700000000000, stagesDone: 4, streak: 3 })
  assert.deepEqual(back.settings.lastCourse, { variationId: 'v1', stage: 'festigen' })
  const bad = importProgress(JSON.stringify({ ...emptyProgress(), settings: { sparringElo: 1500, visit: { at: 'x' }, lastCourse: { variationId: 3, stage: 'nope' } } }))
  assert.equal(bad.settings.visit, undefined)
  assert.equal(bad.settings.lastCourse, undefined)
})

test('recording a visit patches only the visit of the stored state: progress of another tab is not overwritten', async () => {
  const { recordVisitIn } = await import('../src/store/progress.ts')
  const st = new MemStorage() as unknown as Storage
  const other = { ...emptyProgress(), days: { '2026-11-20': 7 } }
  saveProgress(st, other)
  recordVisitIn(st, { at: 5, stagesDone: 1, streak: 2 })
  const back = loadProgress(st)
  assert.deepEqual(back.days, { '2026-11-20': 7 })
  assert.deepEqual(back.settings.visit, { at: 5, stagesDone: 1, streak: 2 })
})
