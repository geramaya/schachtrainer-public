import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cardScope, keysForVariation, lineKeys, variationScopes } from '../src/train/scope.ts'
import { lineBundle, keyAfter } from './helpers.ts'

const full = ['e4', 'e5', 'Nf3', 'Nc6', 'd4']

test('lineKeys: position keys after 0..n plies of the variation line', () => {
  const b = lineBundle(full, true, {}, 2)
  assert.deepEqual(lineKeys(b, 'v1'), [keyAfter([]), keyAfter(['e4']), keyAfter(['e4', 'e5'])])
})

test('keysForVariation: own nodes on the line plus own nodes in the subtree below its end', () => {
  const b = lineBundle(full, true, {}, 2) // variation ends after 1...e5, the book continues below
  assert.deepEqual([...keysForVariation(b, 'v1', {})].sort(), [keyAfter([]), keyAfter(['e4', 'e5']), keyAfter(['e4', 'e5', 'Nf3', 'Nc6'])].sort())
})

test('keysForVariation: a variation that left the book early does not own the other branch', () => {
  const b = lineBundle(full, true, {}, 2)
  b.openings[0]!.variations.push({ id: 'v2', name: 'V2', nameEn: 'V2', line: ['d4'], keyPositions: [], fromDocument: false })
  assert.deepEqual([...keysForVariation(b, 'v2', {})], [keyAfter([])])
})

test('variationScopes: shared prefix positions belong to every variation passing through them', () => {
  const b = lineBundle(full, true, {}, 2)
  b.openings[0]!.variations.push({ id: 'v2', name: 'V2', nameEn: 'V2', line: ['e4'], keyPositions: [], fromDocument: false })
  const scopes = variationScopes(b, {})
  assert.ok(scopes.get('v1')!.has(`scotch:${keyAfter([])}`) && scopes.get('v2')!.has(`scotch:${keyAfter([])}`))
})

/** Counts reads of the trees: the expensive derivations walk them, a cache hit must not. */
function countTreeReads<T extends { trees: unknown }>(b: T): { reads: () => number } {
  let n = 0
  const trees = b.trees
  Object.defineProperty(b, 'trees', { get() { n++; return trees }, configurable: true })
  return { reads: () => n }
}

test('variationScopes: computed once per bundle and overlay state, then served from the cache', () => {
  const b = lineBundle(full, true, {}, 2)
  const spy = countTreeReads(b)
  const first = variationScopes(b, {})
  const afterFirst = spy.reads()
  assert.ok(afterFirst > 0)
  assert.equal(variationScopes(b, {}), first)
  assert.equal(variationScopes(b, {}), first)
  assert.equal(spy.reads(), afterFirst) // no further walk
})

test('variationScopes: another overlay state or another bundle is a cache miss', () => {
  const b = lineBundle(full, true, {}, 2)
  const base = variationScopes(b, {})
  assert.notEqual(variationScopes(b, { scotch: { [keyAfter([])]: 'e2e4' } }), base)
  assert.notEqual(variationScopes(lineBundle(full, true, {}, 2), {}), base)
  assert.equal(variationScopes(b, {}), base) // the original state is still cached
})

test('cardScope reads the cached scopes instead of walking the tree again', () => {
  const b = lineBundle(full, true, {}, 2)
  variationScopes(b, {})
  const spy = countTreeReads(b)
  cardScope(b, 'v1', {})
  cardScope(b, 'v1', {})
  assert.equal(spy.reads(), 0)
})
