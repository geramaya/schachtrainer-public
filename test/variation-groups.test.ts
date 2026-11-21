import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupVariations } from '../src/content/groups.ts'
import type { Variation } from '../src/content/types.ts'

const v = (id: string, partOf?: string, fromDocument = false): Variation => ({ id, name: id, nameEn: id, line: [], keyPositions: [], fromDocument, ...(partOf ? { partOf } : {}) })

test('a variation with partOf is listed under its main variation, not on its own', () => {
  const g = groupVariations([v('a'), v('a-short', 'a'), v('b')])
  assert.deepEqual(g.map((x) => x.main.id), ['a', 'b'])
  assert.deepEqual(g[0]!.stages.map((x) => x.id), ['a-short'])
  assert.deepEqual(g[1]!.stages, [])
})

test('a chain is followed to its root; a missing target or a cycle keeps the entry on its own', () => {
  const chain = groupVariations([v('a'), v('b', 'a'), v('c', 'b')])
  assert.deepEqual(chain.map((x) => x.main.id), ['a'])
  assert.deepEqual(chain[0]!.stages.map((x) => x.id), ['b', 'c'])
  assert.deepEqual(groupVariations([v('x', 'gone')]).map((x) => x.main.id), ['x'])
  const cyc = groupVariations([v('p', 'q'), v('q', 'p')])
  assert.deepEqual(cyc.map((x) => x.main.id).sort(), ['p', 'q'])
})

test('document variations come first, order is otherwise kept', () => {
  const g = groupVariations([v('z'), v('d', undefined, true), v('y')])
  assert.deepEqual(g.map((x) => x.main.id), ['d', 'z', 'y'])
})
