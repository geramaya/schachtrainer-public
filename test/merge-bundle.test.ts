import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeIntoExisting } from '../tools/lib/merge-bundle.ts'
import type { ContentBundle } from '../src/content/types.ts'

const op = (id: string, vid: string) => ({ id, name: id, side: 'white', entry: [], role: '', docRef: '', variations: [{ id: vid }] }) as never
const bundle = (id: string, vid: string): ContentBundle => ({
  contentVersion: 'x', openings: [op(id, vid)],
  schemaVersion: 3,
  trees: { [id]: { [`${id}-n`]: { key: `${id}-n`, fen: 'f', ownMove: false, candidates: [], active: 0, replies: [] } } },
  explanations: [{ id: `${id}/${vid}/1` } as never], questions: [{ id: `${id}/${vid}/q1` } as never],
  deviations: [{ explanationId: `${id}/${vid}/1` } as never], puzzles: { [vid]: [{ id: 'p' } as never] },
})

test('mergeIntoExisting keeps the other openings and their content, and replaces the rebuilt one', () => {
  const existing = bundle('scotch', 'sv')
  const old = bundle('caro-kann', 'old')
  existing.openings.push(...old.openings); Object.assign(existing.trees, old.trees)
  existing.explanations.push(...old.explanations); existing.puzzles.old = old.puzzles.old!
  const built = bundle('caro-kann', 'new')
  const r = mergeIntoExisting(built, existing, ['caro-kann'])
  assert.deepEqual(r.openings.map((o) => o.id), ['scotch', 'caro-kann'])
  assert.deepEqual(r.openings[1]!.variations.map((v) => v.id), ['new'])
  assert.deepEqual(r.explanations.map((e) => e.id).sort(), ['caro-kann/new/1', 'scotch/sv/1'])
  assert.deepEqual(r.questions.map((q) => q.id).sort(), ['caro-kann/new/q1', 'scotch/sv/q1'])
  assert.deepEqual(Object.keys(r.puzzles).sort(), ['new', 'sv'])
  assert.deepEqual(Object.keys(r.trees).sort(), ['caro-kann', 'scotch'])
  assert.ok(r.trees.scotch!['scotch-n'] && r.trees['caro-kann']!['caro-kann-n'])
  assert.equal(r.trees['caro-kann']!['caro-kann-n'], built.trees['caro-kann']!['caro-kann-n'])
})

test('mergeIntoExisting without an existing bundle returns the built one', () => {
  const built = bundle('scotch', 'sv')
  assert.equal(mergeIntoExisting(built, null, ['scotch']), built)
})

test('mergeIntoExisting replaces exactly the tree of the rebuilt opening, a second opening of the same side stays', () => {
  const node = (ownMove: boolean, san: string) => ({ key: 'k', fen: 'f', ownMove, candidates: [], active: 0, replies: [], san })
  const existing = bundle('scotch', 'sv'); existing.trees.scotch = { k: node(true, 'old-scotch') as never }
  const italian = bundle('italian', 'iv'); existing.openings.push(...italian.openings); existing.trees.italian = { k: node(true, 'italian') as never }
  const built = bundle('scotch', 'new'); built.trees = { scotch: { k: node(true, 'new-scotch') as never } }
  const r = mergeIntoExisting(built, existing, ['scotch'])
  assert.equal((r.trees.scotch!.k as never as { san: string }).san, 'new-scotch')
  assert.equal((r.trees.italian!.k as never as { san: string }).san, 'italian')
  assert.equal(r.schemaVersion, 3)
})

test('mergeIntoExisting keeps the opening pool puzzles (<opening>/allgemein) of the other openings and drops those of the rebuilt one', () => {
  const existing = bundle('scotch', 'sv')
  existing.puzzles['scotch/allgemein'] = [{ id: 'pool' } as never]
  const old = bundle('caro-kann', 'old')
  existing.openings.push(...old.openings)
  existing.puzzles['caro-kann/allgemein'] = [{ id: 'stale' } as never]
  const r = mergeIntoExisting(bundle('caro-kann', 'new'), existing, ['caro-kann'])
  assert.deepEqual(Object.keys(r.puzzles).sort(), ['new', 'scotch/allgemein', 'sv'])
})
