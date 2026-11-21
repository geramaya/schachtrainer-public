import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isShown, badgeLabel, judgeMove, explanationAtKey } from '../src/train/lesson.ts'
import type { Explanation, Question } from '../src/content/types.ts'

const base: Explanation = { id: 'e', key: 'k', title: 't', text: 'x', arrows: [], claims: [], status: 'entwurf', source: { kind: 'autor', ref: 'r' } }
const claim = { kind: 'best' as const, uci: 'd2d4' }

test('an entwurf explanation with claims is hidden, without claims it is shown', () => {
  assert.equal(isShown({ ...base, claims: [claim] }), false)
  assert.equal(isShown(base), true)
  assert.equal(isShown({ ...base, status: 'engine-geprüft', claims: [claim] }), true)
})

test('badgeLabel maps every status', () => {
  assert.equal(badgeLabel('entwurf'), 'Entwurf')
  assert.equal(badgeLabel('engine-geprüft'), 'Engine-geprüft')
  assert.equal(badgeLabel('human-ok'), 'Von dir bestätigt')
})

test('explanationAtKey matches on the position key and skips hidden ones', () => {
  const list = [{ ...base, id: 'a', key: 'k1', claims: [claim] }, { ...base, id: 'b', key: 'k2' }]
  assert.equal(explanationAtKey(list, 'k1'), undefined)
  assert.equal(explanationAtKey(list, 'k2')!.id, 'b')
})

const q: Question = { id: 'q', key: 'k', variationId: 'v', prompt: 'p', kind: 'move', answerUci: 'd2d4', explanationId: 'e' }

test('judgeMove: correct, first wrong retries, second wrong reveals', () => {
  assert.equal(judgeMove(q, 'd2d4', 0), 'correct')
  assert.equal(judgeMove(q, 'a2a3', 0), 'retry')
  assert.equal(judgeMove(q, 'a2a3', 1), 'reveal')
  assert.equal(judgeMove(q, 'd2d4', 1), 'correct')
})

test('explanationAtKey with an opening id takes the explanation of that opening, not another with the same key', () => {
  const list = [{ ...base, id: 'budapest/a/1', key: 'k' }, { ...base, id: 'nimzo-indian/b/1', key: 'k' }]
  assert.equal(explanationAtKey(list, 'k', 'nimzo-indian')!.id, 'nimzo-indian/b/1')
  assert.equal(explanationAtKey(list, 'k', 'budapest')!.id, 'budapest/a/1')
  assert.equal(explanationAtKey(list, 'k', 'tarrasch'), undefined)
})
