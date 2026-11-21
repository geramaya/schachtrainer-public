import { test } from 'node:test'
import assert from 'node:assert/strict'
import { withLessonKeys } from '../tools/lib/keypositions.ts'
import { keyAfter } from '../content-src/lib.ts'
import type { Explanation, Variation } from '../src/content/types.ts'

const expl = (id: string, sans: string[]): Explanation => ({
  id, key: keyAfter(sans), title: 't', text: 'x', arrows: [], claims: [], status: 'entwurf', source: { kind: 'autor', ref: 't' },
})
const v: Variation = { id: 'v', name: 'V', nameEn: 'V', line: ['e4', 'e5', 'Nf3', 'Nc6'], keyPositions: [keyAfter(['e4', 'e5', 'Nf3', 'Nc6'])], fromDocument: false }

test('key positions are the positions of the line that carry an explanation, in line order, plus the end', () => {
  const out = withLessonKeys([v], [expl('b', ['e4', 'e5', 'Nf3']), expl('a', ['e4']), expl('x', ['d4'])])
  assert.deepEqual(out[0]!.keyPositions, [keyAfter(['e4']), keyAfter(['e4', 'e5', 'Nf3']), keyAfter(['e4', 'e5', 'Nf3', 'Nc6'])])
  assert.deepEqual(v.keyPositions.length, 1, 'input is not mutated')
})
