import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { positionKey } from '../src/chess/position.ts'
import { migrateBundleV3 } from '../tools/migrate-bundle-v3.ts'
import { validateBundle } from '../tools/lib/validate.ts'
import type { Candidate, TreeNode, Variation } from '../src/content/types.ts'

const src = { kind: 'autor' as const, ref: 't' }
const keyOf = (line: string[]) => { const c = new Chess(); for (const s of line) c.move(s); return positionKey(c.fen()) }

/** Schema 2: one tree per side. White holds Scotch (1.e4 e5 ...) and Smith-Morra (1.e4 c5 ...), black holds Caro-Kann. */
function v2Bundle() {
  const white: Record<string, TreeNode> = {}
  const black: Record<string, TreeNode> = {}
  const add = (tree: Record<string, TreeNode>, line: string[], san: string, own: boolean) => {
    const c = new Chess(); for (const s of line) c.move(s)
    const fen = c.fen(), key = positionKey(fen), m = c.move(san)
    const cand: Candidate = { uci: m.from + m.to + (m.promotion ?? ''), san, evalCp: null, source: src }
    const n = (tree[key] ??= { key, fen, ownMove: own, candidates: [], active: 0, replies: [] })
    if (own) n.candidates.push(cand); else n.replies.push(cand)
  }
  add(white, [], 'e4', true); add(white, ['e4'], 'e5', false); add(white, ['e4'], 'c5', false)
  add(white, ['e4', 'e5'], 'Nf3', true); add(white, ['e4', 'e5', 'Nf3'], 'Nc6', false)
  add(white, ['e4', 'c5'], 'd4', true); add(white, ['e4', 'c5', 'd4'], 'cxd4', false)
  add(black, [], 'e4', false); add(black, ['e4'], 'c6', true); add(black, ['e4', 'c6'], 'd4', false); add(black, ['e4', 'c6', 'd4'], 'd5', true)
  const v = (id: string, line: string[]): Variation => ({ id, name: id, nameEn: id, line, keyPositions: [], fromDocument: true })
  const op = (id: string, side: 'white' | 'black', line: string[]) => ({ id, name: id, side, entry: line, role: '', docRef: '', variations: [v(`${id}/a`, line)] })
  return {
    schemaVersion: 2, contentVersion: 'old', trees: { white, black }, explanations: [], questions: [], deviations: [], puzzles: {},
    openings: [op('scotch', 'white', ['e4', 'e5', 'Nf3', 'Nc6']), op('smith-morra', 'white', ['e4', 'c5', 'd4', 'cxd4']), op('caro-kann', 'black', ['e4', 'c6', 'd4', 'd5'])],
  }
}

test('migrateBundleV3 gives each opening its own tree with only its own branch of a shared position', () => {
  const r = migrateBundleV3(v2Bundle() as never)
  assert.equal(r.schemaVersion, 3)
  assert.deepEqual(Object.keys(r.trees).sort(), ['caro-kann', 'scotch', 'smith-morra'])
  assert.deepEqual(r.trees.scotch![keyOf(['e4'])]!.replies.map((c) => c.san), ['e5'])
  assert.deepEqual(r.trees['smith-morra']![keyOf(['e4'])]!.replies.map((c) => c.san), ['c5'])
  assert.equal(r.trees.scotch![keyOf(['e4', 'c5'])], undefined)
  assert.equal(r.trees['smith-morra']![keyOf(['e4', 'e5'])], undefined)
  assert.equal(r.trees.scotch![keyOf([])]!.candidates[0]!.san, 'e4')
})

test('migrateBundleV3 keeps the black opening in its own tree with answer node at the start', () => {
  const r = migrateBundleV3(v2Bundle() as never)
  assert.equal(r.trees['caro-kann']![keyOf([])]!.ownMove, false)
  assert.equal(r.trees['caro-kann']![keyOf(['e4'])]!.ownMove, true)
  assert.equal('white' in r.trees, false)
})

test('migrateBundleV3 gives a valid bundle with a fresh contentVersion', () => {
  const r = migrateBundleV3(v2Bundle() as never)
  assert.deepEqual(validateBundle(r, { requireLessons: false }), [])
  assert.notEqual(r.contentVersion, 'old')
})
