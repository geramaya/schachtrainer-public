import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stageState, openingProgress, variationStages, earliestFuture, markOnce, applyDeviationId, applyPuzzleId, applySparringId, puzzlesOf } from '../src/train/pipeline.ts'
import type { Card } from '../src/train/srs.ts'
import { lineBundle, keyAfter } from './helpers.ts'
import { emptyProgress } from '../src/store/progress.ts'

test('stageState maps done/total to an empty, begun or finished state', () => {
  assert.equal(stageState(0, 0), 'keine') // no content: the stage does not exist
  assert.equal(stageState(0, 5), 'leer')
  assert.equal(stageState(2, 5), 'begonnen')
  assert.equal(stageState(5, 5), 'fertig')
})

test('openingProgress is the share of variations that finished each stage', () => {
  const r = openingProgress([
    { lernen: 'fertig', verstehen: 'begonnen', festigen: 'leer', anwenden: 'leer' },
    { lernen: 'fertig', verstehen: 'fertig', festigen: 'begonnen', anwenden: 'leer' },
    { lernen: 'leer', verstehen: 'leer', festigen: 'leer', anwenden: 'leer' },
  ])
  assert.deepEqual(r.lernen, { done: 2, total: 3 })
  assert.deepEqual(r.verstehen, { done: 1, total: 3 })
  assert.deepEqual(r.festigen, { done: 0, total: 3 })
  assert.deepEqual(openingProgress([]).lernen, { done: 0, total: 0 })
})

const card = (key: string, reps: number): Card => ({ openingId: 'scotch', key, expectedUci: 'e2e4', variationId: 'v1', due: 0, intervalDays: 0, ease: 2.5, reps, lapses: 0, contentVersion: 'c1', origin: 'baum' })

test('festigen is finished only when every card had a "gut" and none is due', () => {
  const b = lineBundle(['e4', 'e5', 'Nf3', 'Nc6'])
  const keys = Object.keys(b.trees.scotch).filter((k) => b.trees.scotch[k]!.ownMove)
  assert.equal(keys.length, 2)
  const NOW = 1000
  const p = emptyProgress()
  assert.equal(variationStages(b, p, 'v1', NOW).festigen, 'leer')
  p.cards = { [`scotch:${keys[0]!}`]: { ...card(keys[0]!, 1), due: 5000 }, [`scotch:${keys[1]!}`]: card(keys[1]!, 0) }
  assert.equal(variationStages(b, p, 'v1', NOW).festigen, 'begonnen')
  p.cards = { [`scotch:${keys[0]!}`]: { ...card(keys[0]!, 1), due: 5000 }, [`scotch:${keys[1]!}`]: { ...card(keys[1]!, 2), due: 5000 } }
  assert.equal(variationStages(b, p, 'v1', NOW).festigen, 'fertig')
  p.cards[`scotch:${keys[1]!}`] = { ...card(keys[1]!, 2), due: 500 } // practised, but due again
  assert.equal(variationStages(b, p, 'v1', NOW).festigen, 'begonnen')
})

test('variationStages: lernen counts rated key explanations', () => {
  const b = lineBundle(['e4', 'e5'])
  const key = Object.keys(b.trees.scotch)[0]!
  b.explanations = [{ id: 'scotch/v1/x1', key, title: 't', text: 't', status: 'engine-geprüft', claims: [], arrows: [] } as never]
  const p = emptyProgress()
  assert.equal(variationStages(b, p, 'v1').lernen, 'leer')
  p.feedback = { 'scotch/v1/x1': { verdict: 'passt', contentVersion: 'c1' } }
  assert.equal(variationStages(b, p, 'v1').lernen, 'fertig')
})

const withApply = (nDev: number, nPuz: number) => {
  const b = lineBundle(['e4', 'e5'])
  const key = Object.keys(b.trees.scotch)[0]!
  b.deviations = Array.from({ length: nDev }, (_, i) => ({ key, variationId: 'v1', replyUci: `a${i}a${i + 1}`, punishUci: 'e2e4', explanationId: 'x' }))
  b.puzzles = { v1: Array.from({ length: nPuz }, (_, i) => ({ id: `pz${i}`, fen: '', moves: [], rating: 1000, themes: [], openingTags: [], url: '' })) }
  return { b, key }
}

test('anwenden needs every deviation once and at least 3 puzzles (all if fewer)', () => {
  const { b, key } = withApply(2, 5)
  const p = emptyProgress()
  const dev = (i: number) => applyDeviationId('v1', key, `a${i}a${i + 1}`)
  assert.equal(variationStages(b, p, 'v1').anwenden, 'leer')
  p.applied = [dev(0), dev(1)]
  assert.equal(variationStages(b, p, 'v1').anwenden, 'begonnen')
  p.applied = [dev(0), dev(1), applyPuzzleId('pz0'), applyPuzzleId('pz1')]
  assert.equal(variationStages(b, p, 'v1').anwenden, 'begonnen')
  p.applied = [dev(0), dev(1), applyPuzzleId('pz0'), applyPuzzleId('pz1'), applyPuzzleId('pz2')]
  assert.equal(variationStages(b, p, 'v1').anwenden, 'fertig')
  p.applied = [dev(0), applyPuzzleId('pz0'), applyPuzzleId('pz1'), applyPuzzleId('pz2')]
  assert.equal(variationStages(b, p, 'v1').anwenden, 'begonnen') // one deviation missing
})

test('anwenden with fewer than 3 puzzles needs all of them; nothing to apply stays empty', () => {
  const { b } = withApply(0, 2)
  const p = emptyProgress()
  p.applied = [applyPuzzleId('pz0')]
  assert.equal(variationStages(b, p, 'v1').anwenden, 'begonnen')
  p.applied = [applyPuzzleId('pz0'), applyPuzzleId('pz1')]
  assert.equal(variationStages(b, p, 'v1').anwenden, 'fertig')
  const none = withApply(0, 0).b
  assert.equal(variationStages(none, emptyProgress(), 'v1').anwenden, 'keine')
})

test('variationStages: verstehen counts correctly answered questions', () => {
  const b = lineBundle(['e4', 'e5'])
  const key = Object.keys(b.trees.scotch)[0]!
  b.questions = [
    { id: 'q1', key, variationId: 'v1', prompt: 'p', kind: 'choice', choices: [], explanationId: 'x' },
    { id: 'q2', key, variationId: 'v1', prompt: 'p', kind: 'choice', choices: [], explanationId: 'x' },
  ]
  const p = emptyProgress()
  assert.equal(variationStages(b, p, 'v1').verstehen, 'leer')
  p.understood = ['q1']
  assert.equal(variationStages(b, p, 'v1').verstehen, 'begonnen')
  p.understood = ['q1', 'q2']
  assert.equal(variationStages(b, p, 'v1').verstehen, 'fertig')
})

test('earliestFuture finds the earliest due time of practised cards after now', () => {
  const now = 1000
  const cs = [{ ...card('a', 1), due: 5000 }, { ...card('b', 1), due: 2000 }, { ...card('c', 1), due: 500 }, { ...card('d', 0), due: 1500 }]
  assert.equal(earliestFuture(cs, now), 2000)
  assert.equal(earliestFuture([], now), undefined)
})

test('markOnce appends an id only once and keeps the same array if already present', () => {
  const a = ['q1']
  assert.deepEqual(markOnce(a, 'q2'), ['q1', 'q2'])
  assert.equal(markOnce(a, 'q1'), a)
})

test('openingProgress: stages without content drop out of the denominator, so 100 percent is reachable', () => {
  const r = openingProgress([
    { lernen: 'fertig', verstehen: 'keine', festigen: 'fertig', anwenden: 'keine' },
    { lernen: 'fertig', verstehen: 'fertig', festigen: 'fertig', anwenden: 'fertig' },
    { lernen: 'fertig', verstehen: 'keine', festigen: 'fertig', anwenden: 'keine' },
  ])
  assert.deepEqual(r.verstehen, { done: 1, total: 1 })
  assert.deepEqual(r.anwenden, { done: 1, total: 1 })
  assert.deepEqual(r.lernen, { done: 3, total: 3 })
})

test('variationStages: no questions means verstehen "keine", no explanations lernen "keine", no cards festigen "keine"', () => {
  const b = lineBundle([])
  const s = variationStages(b, emptyProgress(), 'v1')
  assert.deepEqual(s, { lernen: 'keine', verstehen: 'keine', festigen: 'keine', anwenden: 'keine' })
})

test('a finished sparring game counts as apply: alone it finishes a variation without other apply content', () => {
  const { b } = withApply(0, 0)
  const p = emptyProgress()
  assert.equal(variationStages(b, p, 'v1').anwenden, 'keine')
  p.applied = [applySparringId('v1')]
  assert.equal(variationStages(b, p, 'v1').anwenden, 'fertig')
})

test('a finished sparring game with deviations or puzzles present counts as begun, not as finished', () => {
  const { b } = withApply(1, 1)
  const p = emptyProgress()
  p.applied = [applySparringId('v1')]
  assert.equal(variationStages(b, p, 'v1').anwenden, 'begonnen')
})

test('puzzlesOf: own pool first; a variation without one falls back to the opening pool <id>/allgemein', () => {
  const b = lineBundle(['e4', 'e5'])
  const z = (id: string) => ({ id, fen: '', moves: [], rating: 1000, themes: [], openingTags: [], url: '' })
  b.puzzles = { 'scotch/allgemein': [z('a1'), z('a2')] }
  assert.deepEqual(puzzlesOf(b, 'v1').map((x) => x.id), ['a1', 'a2'])
  b.puzzles = { v1: [z('own')], 'scotch/allgemein': [z('a1')] }
  assert.deepEqual(puzzlesOf(b, 'v1').map((x) => x.id), ['own'])
  b.puzzles = {}
  assert.deepEqual(puzzlesOf(b, 'v1'), [])
})

test('variationStages anwenden uses the opening pool for a variation without its own puzzles', () => {
  const b = lineBundle(['e4', 'e5'])
  b.puzzles = { 'scotch/allgemein': [{ id: 'a1', fen: '', moves: [], rating: 1000, themes: [], openingTags: [], url: '' }] }
  const p = emptyProgress()
  assert.equal(variationStages(b, p, 'v1').anwenden, 'leer')
  p.applied = [applyPuzzleId('a1')]
  assert.equal(variationStages(b, p, 'v1').anwenden, 'fertig')
})

test('variationStages: content-derived parts (line keys, explanations, questions) are computed once per bundle; only progress is read again', () => {
  const b = lineBundle(['e4', 'e5', 'Nf3', 'Nc6'])
  let reads = 0
  const { explanations, questions } = b
  Object.defineProperty(b, 'explanations', { get() { reads++; return explanations }, configurable: true })
  Object.defineProperty(b, 'questions', { get() { reads++; return questions }, configurable: true })
  const p = emptyProgress()
  const first = variationStages(b, p, 'v1', 1000)
  const afterFirst = reads
  assert.ok(afterFirst > 0)
  assert.deepEqual(variationStages(b, p, 'v1', 2000), first)
  assert.equal(reads, afterFirst)
  p.understood = ['x'] // progress still counts, it is not cached
  p.cards = { [`scotch:${keyAfter([])}`]: { ...card(keyAfter([]), 1), due: 500 } }
  assert.equal(variationStages(b, p, 'v1', 1000).festigen, 'begonnen')
})
