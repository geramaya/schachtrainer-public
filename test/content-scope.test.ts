import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scopeContent } from '../tools/lib/content-scope.ts'

const e = (id: string) => ({ id }) as never
const q = (id: string) => ({ id }) as never
const d = (explanationId: string) => ({ explanationId }) as never

test('scopeContent keeps only content whose id starts with a selected opening', () => {
  const r = scopeContent(['caro-kann'], {
    explanations: [e('scotch/a/1'), e('caro-kann/b/1')],
    questions: [q('scotch/a/q1'), q('caro-kann/b/q1')],
    deviations: [d('scotch/a/1'), d('caro-kann/b/1')],
  })
  assert.deepEqual(r.explanations.map((x: { id: string }) => x.id), ['caro-kann/b/1'])
  assert.deepEqual(r.questions.map((x: { id: string }) => x.id), ['caro-kann/b/q1'])
  assert.deepEqual(r.deviations.map((x: { explanationId: string }) => x.explanationId), ['caro-kann/b/1'])
})

test('scopeContent does not match an opening id that is only a prefix of another id', () => {
  const r = scopeContent(['kings'], { explanations: [e('kings-indian/a/1')], questions: [], deviations: [] })
  assert.equal(r.explanations.length, 0)
})
