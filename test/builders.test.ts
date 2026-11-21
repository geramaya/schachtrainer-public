import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildQuestionsFor, buildDeviationsFor } from '../content-src/builders.ts'
import { keyAfter, uciOf } from '../content-src/lib.ts'
import type { Explanation } from '../src/content/types.ts'

const sans = ['d4', 'Nf6']
const expl = (id: string): Explanation => ({
  id, key: keyAfter(sans), title: 't', text: 'x', arrows: [], status: 'entwurf', source: { kind: 'autor', ref: 'r' },
  claims: [{ kind: 'best', uci: uciOf(sans, 'c4'), verified: undefined }] as Explanation['claims'],
})
const both = [expl('budapest/b/1'), expl('nimzo-indian/n/1')]

test('questions use the explanation of their own opening when two openings explain the same position', () => {
  const q = buildQuestionsFor('nimzo-indian', both, [{ v: 'n', line: 'd4 Nf6', at: 2, prompt: 'p', answer: 'c4' }])
  assert.equal(q[0]!.explanationId, 'nimzo-indian/n/1')
})

test('deviations use the explanation of their own variation when two openings explain the same position', () => {
  const d = buildDeviationsFor(both, [{ v: 'n', line: 'd4 Nf6', at: 2, reply: 'Nf6', answer: 'c4' } as never])
  assert.equal(d[0]!.explanationId, 'nimzo-indian/n/1')
})
