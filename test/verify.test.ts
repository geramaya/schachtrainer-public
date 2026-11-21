import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ClaimCheckError } from '../tools/lib/check-claims.ts'
import { verifyExplanations } from '../tools/lib/verify.ts'
import { positionKey } from '../src/chess/position.ts'
import type { Claim, Explanation, TreeNode } from '../src/content/types.ts'
import { fakeEngine, fenAfter } from './fake-engine.ts'

const start = fenAfter([])
const key = positionKey(start)
const nodes: Record<string, TreeNode> = { [key]: { key, fen: start, ownMove: true, candidates: [], active: 0, replies: [] } }
const top = {
  [key]: { lines: [{ uci: 'e2e4', cp: 30 }, { uci: 'd2d4', cp: 25 }, { uci: 'g1f3', cp: -10 }, { uci: 'a2a3', cp: -50 }] },
}
const expl = (id: string, status: Explanation['status'], claims: Claim[]): Explanation => ({
  id, key, title: 't', text: 'x', arrows: [], claims, status, source: { kind: 'autor', ref: 'test' },
})
const forged = { evalCp: 999, depth: 99 }

test('a hand-set engine-geprüft status with invented evidence does not get a false claim through', async () => {
  const bad = expl('e-bad', 'engine-geprüft', [{ kind: 'best', uci: 'a2a3', verified: forged }])
  await assert.rejects(verifyExplanations([bad], nodes, fakeEngine(top)), (e: unknown) => {
    assert.ok(e instanceof ClaimCheckError)
    assert.match(e.failures.join('|'), /e-bad.*a2a3/)
    return true
  })
})

test('true claims get status and evidence from the engine run, never from the input', async () => {
  const good = expl('e-good', 'engine-geprüft', [{ kind: 'best', uci: 'd2d4', verified: forged }])
  const [out] = await verifyExplanations([good], nodes, fakeEngine(top))
  assert.equal(out!.status, 'engine-geprüft')
  assert.deepEqual(out!.claims[0]!.verified, { evalCp: 25, depth: 18 })
})

test('human-ok and claim-free explanations pass untouched without asking the engine', async () => {
  const eng = fakeEngine(top)
  const h = expl('h', 'human-ok', [{ kind: 'best', uci: 'a2a3' }])
  const plain = expl('p', 'entwurf', [])
  assert.deepEqual(await verifyExplanations([h, plain], nodes, eng), [h, plain])
  assert.equal(eng.calls.length, 0)
})

test('an explanation at an unknown key fails the build', async () => {
  const orphan = { ...expl('o', 'entwurf', [{ kind: 'best', uci: 'e2e4' }]), key: 'nope' }
  await assert.rejects(verifyExplanations([orphan], nodes, fakeEngine(top)), /nope/)
})

test('verifyByOpening checks an explanation against the tree of its own opening, not another one', async () => {
  const { verifyByOpening } = await import('../tools/lib/verify.ts')
  const wrongFen = fenAfter(['d4']) // marker: the tree of the other opening holds a different node under the same key
  const trees = { scotch: { [key]: { ...nodes[key]!, fen: wrongFen } }, caro: { [key]: nodes[key]! } }
  const openings = [{ id: 'scotch' }, { id: 'caro' }]
  const e = expl('caro/x', 'entwurf', [{ kind: 'best', uci: 'e2e4' }])
  const [out] = await verifyByOpening([e], openings, trees, fakeEngine(top))
  assert.equal(out!.status, 'engine-geprüft') // e2e4 is only legal on the fen of the caro tree
  await assert.rejects(verifyByOpening([{ ...e, id: 'nobody/x' }], openings, trees, fakeEngine(top)), /nobody/)
  await assert.rejects(verifyByOpening([{ ...e, id: 'scotch/x' }], openings, trees, fakeEngine(top)), /e2e4/)
})
