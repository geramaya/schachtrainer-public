import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Chess } from 'chess.js'
import { positionKey } from '../src/chess/position.ts'
import { expectedMove, knownReplies, treeFor, openingOfVariation, nodeOfVariation, findNode } from '../src/content/tree.ts'
import { setOwnMove, clearOwnMove } from '../src/store/overlays.ts'
import type { ContentBundle } from '../src/content/types.ts'
import { lineBundle, keyAfter } from './helpers.ts'

const bundle: ContentBundle = JSON.parse(
  readFileSync(new URL('./fixtures/mini-bundle.json', import.meta.url), 'utf8'),
)
const fork = (() => {
  const c = new Chess()
  for (const s of ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4']) c.move(s)
  return positionKey(c.fen())
})()
const afterD4 = (() => {
  const c = new Chess()
  for (const s of ['e4', 'e5', 'Nf3', 'Nc6', 'd4']) c.move(s)
  return positionKey(c.fen())
})()

test('expectedMove returns the active candidate', () => {
  assert.equal(expectedMove(bundle, 'scotch', fork, {})?.uci, 'f3d4')
})

test('expectedMove prefers the overlay choice over active', () => {
  const ov = setOwnMove({}, 'scotch', fork, 'f1c4')
  const m = expectedMove(bundle, 'scotch', fork, ov)
  assert.equal(m?.uci, 'f1c4')
  assert.equal(m?.san, 'Bc4')
})

test('expectedMove ignores an overlay uci that is not a candidate', () => {
  assert.equal(expectedMove(bundle, 'scotch', fork, { scotch: { [fork]: 'a2a3' } })?.uci, 'f3d4')
})

test('expectedMove is null for unknown key, opponent nodes and unknown opening', () => {
  assert.equal(expectedMove(bundle, 'scotch', 'nope', {}), null)
  assert.equal(expectedMove(bundle, 'scotch', afterD4, {}), null)
  assert.equal(expectedMove(bundle, 'italian', fork, {}), null)
})

test('knownReplies lists opponent moves, empty when unknown', () => {
  assert.deepEqual(knownReplies(bundle, 'scotch', afterD4).map((c) => c.uci), ['e5d4'])
  assert.deepEqual(knownReplies(bundle, 'scotch', 'nope'), [])
})

test('setOwnMove/clearOwnMove are immutable and keep the openings apart', () => {
  const a = {}
  const b = setOwnMove(a, 'scotch', 'k', 'e2e4')
  assert.deepEqual(a, {})
  assert.deepEqual(b, { scotch: { k: 'e2e4' } })
  const c = clearOwnMove(setOwnMove(b, 'italian', 'k', 'f1c4'), 'scotch', 'k')
  assert.deepEqual(b, { scotch: { k: 'e2e4' } })
  assert.deepEqual(c, { scotch: {}, italian: { k: 'f1c4' } })
})

// Scotch and Italian share 1.e4 e5 2.Nf3 Nc6 and part there (3.d4 / 3.Bc4); Caro-Kann (black) answers 1.e4 where Scotch plays it
const multi = (() => {
  const scotch = lineBundle(['e4', 'e5', 'Nf3', 'Nc6', 'd4'], true, {}, 5, 'scotch', 'v-sco')
  const italian = lineBundle(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'], true, {}, 5, 'italian', 'v-ita')
  const caro = lineBundle(['e4', 'c6', 'd4', 'd5'], false, {}, 4, 'caro-kann', 'v-ck')
  scotch.openings.push(italian.openings[0]!, caro.openings[0]!)
  scotch.trees.italian = italian.trees.italian!
  scotch.trees['caro-kann'] = caro.trees['caro-kann']!
  return scotch
})()

test('two openings of one side choose different moves in the same position', () => {
  const k = keyAfter(['e4', 'e5', 'Nf3', 'Nc6'])
  assert.equal(expectedMove(multi, 'scotch', k, {})?.san, 'd4')
  assert.equal(expectedMove(multi, 'italian', k, {})?.san, 'Bc4')
})

test('the same position is a candidate node in a white opening and an answer node in a black one', () => {
  const start = keyAfter([])
  assert.equal(expectedMove(multi, 'scotch', start, {})?.san, 'e4')
  assert.equal(expectedMove(multi, 'caro-kann', start, {}), null)
  assert.deepEqual(knownReplies(multi, 'caro-kann', start).map((c) => c.san), ['e4'])
  assert.equal(treeFor(multi, 'caro-kann')[start]!.ownMove, false)
  assert.equal(expectedMove(multi, 'caro-kann', keyAfter(['e4']), {})?.san, 'c6')
})

test('an overlay of one opening does not change another opening', () => {
  const k = keyAfter(['e4', 'e5', 'Nf3', 'Nc6'])
  const ov = { scotch: { [k]: 'f1c4' } } // Bc4 is no scotch candidate; italian is untouched
  assert.equal(expectedMove(multi, 'scotch', k, ov)?.san, 'd4')
  assert.equal(expectedMove(multi, 'italian', k, ov)?.san, 'Bc4')
})

test('openingOfVariation, nodeOfVariation and findNode', () => {
  assert.equal(openingOfVariation(multi, 'v-ita')?.id, 'italian')
  assert.equal(openingOfVariation(multi, 'nope'), undefined)
  const start = keyAfter([])
  assert.equal(nodeOfVariation(multi, 'v-ck', start)!.ownMove, false)
  assert.equal(nodeOfVariation(multi, 'v-sco', start)!.ownMove, true)
  assert.equal(nodeOfVariation(multi, 'nope', start), undefined)
  assert.equal(findNode(multi, keyAfter(['e4']))!.ownMove, true) // own in the black tree wins over the answer node in the white trees
  assert.equal(findNode(multi, 'nope'), undefined)
})
