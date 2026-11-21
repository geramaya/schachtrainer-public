import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planTraining, TASK_SECONDS, TARGET_SECONDS } from '../src/train/plan.ts'
import type { PlanInput } from '../src/train/plan.ts'
import type { Card } from '../src/train/srs.ts'
import { cardId } from '../src/train/srs.ts'

const NOW = 1_000_000
const card = (over: Partial<Card> & { key: string }): Card => ({ openingId: 'scotch', expectedUci: 'e2e4', variationId: 'v1', due: 0, intervalDays: 1, ease: 2.5, reps: 1, lapses: 0, contentVersion: 'c', origin: 'baum', ...over })
const input = (over: Partial<PlanInput> = {}): PlanInput => ({ now: NOW, cards: [], puzzles: [], deviations: [], done: new Set(), ...over })
const ids = (p: { tasks: { kind: string; id: string }[] }, kind: string) => p.tasks.filter((t) => t.kind === kind).map((t) => t.id)

test('estimated seconds per task are documented: card 20, puzzle 90, deviation 60; target 10 minutes', () => {
  assert.deepEqual(TASK_SECONDS, { card: 20, puzzle: 90, deviation: 60 })
  assert.equal(TARGET_SECONDS, 600)
})

test('due cards come first, the most overdue first; practised cards that are not due and new cards are left out of the due part', () => {
  const cards = [card({ key: 'a', due: 300 }), card({ key: 'b', due: 100 }), card({ key: 'c', due: NOW + 5 }), card({ key: 'd', due: 200 })]
  const p = planTraining(input({ cards }))
  assert.deepEqual(ids(p, 'card'), ['scotch:b', 'scotch:d', 'scotch:a'])
})

test('cards take at most 70 percent of the time; the rest holds one puzzle and one deviation, the total stays within the target', () => {
  const cards = Array.from({ length: 40 }, (_, i) => card({ key: `k${i}`, due: i + 1 }))
  const p = planTraining(input({ cards, puzzles: [{ id: 'z1', openingId: 'scotch', rating: 1200 }], deviations: [{ id: 'd1', variationId: 'v1', openingId: 'scotch' }] }))
  assert.equal(ids(p, 'card').length, 21) // 21 x 20 s = 420 s = 70 percent of 600 s
  assert.deepEqual(p.tasks.slice(-2).map((t) => t.kind), ['puzzle', 'deviation'])
  assert.equal(p.estimatedSec, 21 * 20 + 90 + 60)
  assert.ok(p.estimatedSec <= TARGET_SECONDS)
})

test('the puzzle comes from the opening with the most due cards, easiest unsolved one first; a solved pool falls back to the easiest', () => {
  const cards = [card({ key: 'a', due: 1, openingId: 'caro-kann' }), card({ key: 'b', due: 2, openingId: 'caro-kann' }), card({ key: 'c', due: 3, openingId: 'scotch' })]
  const puzzles = [{ id: 'sc1', openingId: 'scotch', rating: 1000 }, { id: 'ck-hard', openingId: 'caro-kann', rating: 1800 }, { id: 'ck-easy', openingId: 'caro-kann', rating: 1300 }]
  assert.deepEqual(ids(planTraining(input({ cards, puzzles })), 'puzzle'), ['ck-easy'])
  assert.deepEqual(ids(planTraining(input({ cards, puzzles, done: new Set(['ck-easy']) })), 'puzzle'), ['ck-hard'])
  assert.deepEqual(ids(planTraining(input({ cards, puzzles, done: new Set(['ck-easy', 'ck-hard']) })), 'puzzle'), ['ck-easy'])
})

test('the deviation prefers the same opening and an unsolved one; none is planned if the bundle has none', () => {
  const cards = [card({ key: 'a', due: 1, openingId: 'caro-kann' })]
  const deviations = [{ id: 'd-sc', variationId: 'v1', openingId: 'scotch' }, { id: 'd-ck1', variationId: 'v2', openingId: 'caro-kann' }, { id: 'd-ck2', variationId: 'v2', openingId: 'caro-kann' }]
  assert.deepEqual(ids(planTraining(input({ cards, deviations, done: new Set(['d-ck1']) })), 'deviation'), ['d-ck2'])
  assert.deepEqual(ids(planTraining(input({ cards })), 'deviation'), [])
})

test('without due cards: new cards of the last worked variation plus a puzzle of its opening, no deviation', () => {
  const cards = [
    card({ key: 'n1', variationId: 'v9', openingId: 'caro-kann', reps: 0, intervalDays: 0 }),
    card({ key: 'n2', variationId: 'v9', openingId: 'caro-kann', reps: 0, intervalDays: 0 }),
    card({ key: 'other', variationId: 'v1', reps: 0, intervalDays: 0 }),
    card({ key: 'later', due: NOW + 99, variationId: 'v9', openingId: 'caro-kann' }),
  ]
  const puzzles = [{ id: 'sc1', openingId: 'scotch', rating: 1000 }, { id: 'ck1', openingId: 'caro-kann', rating: 1500 }]
  const p = planTraining(input({ cards, puzzles, deviations: [{ id: 'd1', variationId: 'v9', openingId: 'caro-kann' }], lastVariationId: 'v9' }))
  assert.deepEqual(ids(p, 'card'), ['caro-kann:n1', 'caro-kann:n2'])
  assert.deepEqual(ids(p, 'puzzle'), ['ck1'])
  assert.deepEqual(ids(p, 'deviation'), [])
})

test('few due cards are topped up with new cards of the last worked variation, up to the card budget', () => {
  const news = Array.from({ length: 30 }, (_, i) => card({ key: `n${i}`, variationId: 'v9', reps: 0, intervalDays: 0 }))
  const p = planTraining(input({ cards: [card({ key: 'due', due: 5 }), ...news], lastVariationId: 'v9' }))
  assert.deepEqual(ids(p, 'card').slice(0, 2), ['scotch:due', 'scotch:n0'])
  assert.equal(ids(p, 'card').length, 21)
})

test('cards from played games carry their source, so game positions can be mixed in later', () => {
  const p = planTraining(input({ cards: [card({ key: 'g', due: 1, origin: 'partie', variationId: '' }), card({ key: 'r', due: 2 })] }))
  assert.deepEqual(p.tasks.map((t) => (t.kind === 'card' ? t.source : null)), ['partie', 'repertoire'])
})

test('nothing to train gives an empty plan; a plan without any card still offers a puzzle', () => {
  assert.deepEqual(planTraining(input()), { tasks: [], estimatedSec: 0 })
  const p = planTraining(input({ puzzles: [{ id: 'z', openingId: 'scotch', rating: 1 }] }))
  assert.deepEqual(p.tasks, [{ kind: 'puzzle', id: 'z' }])
})

test('card tasks use the card id', () => {
  const c = card({ key: 'x', due: 1 })
  assert.equal(planTraining(input({ cards: [c] })).tasks[0]!.id, cardId(c))
})

import { trainingPlanFor } from '../src/train/plan-adapter.ts'
import { emptyProgress } from '../src/store/progress.ts'
import { cardsForBundle } from '../src/train/srs.ts'
import { applyDeviationId, applyPuzzleId } from '../src/train/pipeline.ts'
import { lineBundle, keyAfter } from './helpers.ts'

test('plan from the bundle: puzzle pool of the opening, deviation of the variation, solved ones come last, due cards first', () => {
  const b = lineBundle(['e4', 'e5', 'Nf3'], true)
  const key = keyAfter(['e4', 'e5'])
  b.puzzles = { 'scotch/allgemein': [{ id: 'z1', fen: '', moves: [], rating: 1200, themes: [], openingTags: [], url: '' }, { id: 'z2', fen: '', moves: [], rating: 1100, themes: [], openingTags: [], url: '' }] }
  b.deviations = [{ key, variationId: 'v1', replyUci: 'a7a6', punishUci: 'g1f3', explanationId: 'x' }]
  const p = emptyProgress()
  const cards = cardsForBundle(b, p.overlays).map((c, i) => ({ ...c, reps: i === 0 ? 1 : 0, due: i === 0 ? 1 : 0 }))
  const base = { ...p, cards: Object.fromEntries(cards.map((c) => [`${c.openingId}:${c.key}`, c])) }
  const plan = trainingPlanFor(b, base, 1_000)
  assert.deepEqual(plan.tasks.map((t) => t.kind), ['card', 'card', 'puzzle', 'deviation'])
  assert.equal(plan.tasks.find((t) => t.kind === 'puzzle')!.id, 'z2') // easiest first
  const solved = trainingPlanFor(b, { ...base, applied: [applyPuzzleId('z2')] }, 1_000)
  assert.equal(solved.tasks.find((t) => t.kind === 'puzzle')!.id, 'z1')
  assert.equal(plan.tasks.find((t) => t.kind === 'deviation')!.id, applyDeviationId('v1', key, 'a7a6'))
})
