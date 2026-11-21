import { test } from 'node:test'
import assert from 'node:assert/strict'
import { courseTotalPct, courseStep, courseCta, heroCta } from '../src/train/course.ts'
import type { VariationStages } from '../src/train/pipeline.ts'

const bars = (l: [number, number], v: [number, number], f: [number, number], a: [number, number]) => ({
  lernen: { done: l[0], total: l[1] }, verstehen: { done: v[0], total: v[1] }, festigen: { done: f[0], total: f[1] }, anwenden: { done: a[0], total: a[1] },
})

test('total percent is done over all stage slots of the course, rounded, 0 for an empty course', () => {
  assert.equal(courseTotalPct(bars([17, 17], [6, 17], [9, 17], [2, 17])), 50)
  assert.equal(courseTotalPct(bars([12, 54], [0, 54], [0, 54], [0, 54])), 6)
  assert.equal(courseTotalPct(bars([0, 5], [0, 5], [0, 5], [0, 5])), 0)
  assert.equal(courseTotalPct(bars([0, 0], [0, 0], [0, 0], [0, 0])), 0)
  assert.equal(courseTotalPct(bars([5, 5], [5, 5], [5, 5], [5, 5])), 100)
})

test('next step: start when nothing is done, else the first unfinished stage with content, else done', () => {
  assert.deepEqual(courseStep(bars([0, 5], [0, 5], [0, 5], [0, 5])), { kind: 'start' })
  assert.deepEqual(courseStep(bars([17, 17], [6, 17], [9, 17], [2, 17])), { kind: 'next', stage: 'verstehen' })
  assert.deepEqual(courseStep(bars([1, 54], [0, 54], [0, 54], [0, 54])), { kind: 'next', stage: 'lernen' })
  assert.deepEqual(courseStep(bars([5, 5], [0, 0], [3, 5], [0, 5])), { kind: 'next', stage: 'festigen' }) // a stage without content is skipped
  assert.deepEqual(courseStep(bars([5, 5], [5, 5], [5, 5], [5, 5])), { kind: 'done' })
  assert.deepEqual(courseStep(bars([0, 0], [0, 0], [0, 0], [0, 0])), { kind: 'start' })
})

test('course call to action text', () => {
  assert.equal(courseCta({ kind: 'start' }), 'Kurs starten ▸')
  assert.equal(courseCta({ kind: 'next', stage: 'verstehen' }), 'Weiter: Verstehen ▸')
  assert.equal(courseCta({ kind: 'done' }), 'Abgeschlossen ✓')
})

const st = (l: VariationStages['lernen'], v: VariationStages['verstehen'], f: VariationStages['festigen'], a: VariationStages['anwenden']): VariationStages => ({ lernen: l, verstehen: v, festigen: f, anwenden: a })

test('"Kurs fortsetzen" jumps to the next open stage of the last worked variation', () => {
  const stages = (id: string) => (id === 'v1' ? st('fertig', 'leer', 'leer', 'leer') : null)
  assert.deepEqual(heroCta({ last: { variationId: 'v1', stage: 'lernen' }, stagesOf: stages, startVariationId: 'v0' }), { label: 'Kurs fortsetzen', variationId: 'v1', stage: 'verstehen' })
})

test('"Kurs fortsetzen" skips stages without content and keeps the last stage when all are finished', () => {
  const skip = (id: string) => (id === 'v1' ? st('fertig', 'keine', 'begonnen', 'leer') : null)
  assert.equal(heroCta({ last: { variationId: 'v1', stage: 'lernen' }, stagesOf: skip, startVariationId: 'v0' }).stage, 'festigen')
  const all = (id: string) => (id === 'v1' ? st('fertig', 'fertig', 'fertig', 'fertig') : null)
  assert.deepEqual(heroCta({ last: { variationId: 'v1', stage: 'festigen' }, stagesOf: all, startVariationId: 'v0' }), { label: 'Kurs fortsetzen', variationId: 'v1', stage: 'festigen' })
})

test('without a last course, or one that no longer exists, the hero offers "Kurs starten" at the first variation', () => {
  const none = () => null
  assert.deepEqual(heroCta({ stagesOf: none, startVariationId: 'v0' }), { label: 'Kurs starten', variationId: 'v0', stage: 'lernen' })
  assert.deepEqual(heroCta({ last: { variationId: 'gone', stage: 'festigen' }, stagesOf: none, startVariationId: 'v0' }), { label: 'Kurs starten', variationId: 'v0', stage: 'lernen' })
})

import { courseRows } from '../src/train/course.ts'
import { emptyProgress } from '../src/store/progress.ts'
import { lineBundle } from './helpers.ts'
import { cardsForBundle, cardId } from '../src/train/srs.ts'

test('course rows: one per catalog entry in catalog order; only built openings are available', () => {
  const rows = courseRows(lineBundle(['e4', 'e5'], true), emptyProgress(), 1_000)
  assert.equal(rows.length, 10)
  assert.deepEqual(rows.map((r) => r.id).slice(0, 3), ['scotch', 'smith-morra', 'caro-kann'])
  assert.equal(rows[0]!.available, true)
  assert.equal(rows[0]!.count, 1)
  assert.equal(rows[1]!.available, false)
  assert.deepEqual(rows[0]!.step, { kind: 'start' })
  assert.equal(rows[0]!.pct, 0)
  assert.equal(rows.filter((r) => r.group === 'main').length, 5)
})

test('due cards with no stage finished yet point to "Weiter: Festigen", not "Kurs starten" (practised cards are due while no stage is complete)', () => {
  const none = bars([0, 5], [0, 5], [0, 5], [0, 5])
  assert.deepEqual(courseStep(none, 2), { kind: 'next', stage: 'festigen' })
  assert.deepEqual(courseStep(none, 0), { kind: 'start' })
  assert.deepEqual(courseStep(bars([5, 5], [0, 5], [0, 5], [0, 5]), 2), { kind: 'next', stage: 'verstehen' }) // a started course keeps its normal order
})

test('course rows carry due cards into the next step', () => {
  const b = lineBundle(['e4', 'e5', 'Nf3'], true)
  const p = emptyProgress()
  const cards = cardsForBundle(b, p.overlays).map((c, i) => (i === 0 ? { ...c, reps: 1, due: 1 } : c))
  const rows = courseRows(b, { ...p, cards: Object.fromEntries(cards.map((c) => [cardId(c), c])) }, 1_000)
  assert.equal(rows[0]!.due, 1)
  assert.equal(rows[0]!.pct, 0)
  assert.deepEqual(rows[0]!.step, { kind: 'next', stage: 'festigen' })
})
