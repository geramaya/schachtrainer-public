import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkClaims, ClaimCheckError } from '../tools/lib/check-claims.ts'
import type { Claim, Explanation } from '../src/content/types.ts'
import { fakeEngine, fenAfter } from './fake-engine.ts'

const explanation = (claims: Claim[]): Explanation => ({
  id: 'e1', key: 'k', title: 't', text: 'x', arrows: [], claims, status: 'entwurf',
  source: { kind: 'autor', ref: 'test' },
})
const failures = async (p: Promise<unknown>): Promise<string[]> => {
  try {
    await p
  } catch (e) {
    assert.ok(e instanceof ClaimCheckError, String(e))
    return e.failures
  }
  assert.fail('expected ClaimCheckError')
}
const k = (fen: string) => fen.split(' ').slice(0, 4).join(' ')

const start = fenAfter([])
const top = {
  [k(start)]: {
    lines: [{ uci: 'e2e4', cp: 30 }, { uci: 'd2d4', cp: 25 }, { uci: 'g1f3', cp: -10 }, { uci: 'a2a3', cp: -50 }],
  },
}

test('best claim passes for a top-3 move within 30 cp and records the evidence', async () => {
  const out = await checkClaims(explanation([{ kind: 'best', uci: 'd2d4' }]), start, fakeEngine(top))
  assert.equal(out.status, 'engine-geprüft')
  assert.deepEqual(out.claims[0]!.verified, { evalCp: 25, depth: 18 })
})

test('best claim fails for a top-3 move more than 30 cp off, and for a move outside the top 3', async () => {
  const f = await failures(checkClaims(explanation([
    { kind: 'best', uci: 'g1f3' }, { kind: 'best', uci: 'a2a3' },
  ]), start, fakeEngine(top)))
  assert.equal(f.length, 2)
  assert.match(f[0]!, /g1f3/)
  assert.match(f[1]!, /a2a3/)
})

// after 1.e4 e5 (white to move): black's threat ...Nf6 against the current position
const w = fenAfter(['e4', 'e5'])
const afterThreat = 'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 3'

test('threat claim: the side not to move gains >= 150 cp against the current position', async () => {
  const eng = (afterCp: number) => fakeEngine({
    [k(w)]: { lines: [{ uci: 'g1f3', cp: 20 }] }, // white to move: black is at -20
    [k(afterThreat)]: { lines: [{ uci: 'f1c4', cp: afterCp }] }, // white view after the black move
  })
  // white view -140 -> black +140; baseline black -20 -> gain 160
  const ok = await checkClaims(explanation([{ kind: 'threat', uci: 'g8f6' }]), w, eng(-140))
  assert.equal(ok.status, 'engine-geprüft')
  assert.equal(ok.claims[0]!.verified!.evalCp, 140)
  // gain only 130
  const f = await failures(checkClaims(explanation([{ kind: 'threat', uci: 'g8f6' }]), w, eng(-110)))
  assert.match(f[0]!, /threat/)
})

test('threat claim falls through when the null move position is illegal (side to move gives check)', async () => {
  // 2.f3 e5 3.g4 Qh4#: white is in check, so black cannot "pass"
  const mated = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'
  const f = await failures(checkClaims(explanation([{ kind: 'threat', uci: 'h4e1' }]), mated, fakeEngine({ [k(mated)]: { lines: [{ uci: 'a2a3' }] } })))
  assert.match(f[0]!, /illegal/)
})

test('blunder claim passes when the move loses >= 150 cp against the best move', async () => {
  const after = fenAfter(['f3'])
  const eng = (cp: number) => fakeEngine({
    [k(start)]: { lines: [{ uci: 'e2e4', cp: 30 }] },
    [k(after)]: { lines: [{ uci: 'e7e5', cp }] }, // black to move
  })
  const ok = await checkClaims(explanation([{ kind: 'blunder', uci: 'f2f3' }]), start, eng(200))
  assert.equal(ok.claims[0]!.verified!.evalCp, -200)
  const f = await failures(checkClaims(explanation([{ kind: 'blunder', uci: 'f2f3' }]), start, eng(100)))
  assert.match(f[0]!, /blunder/)
})

test('an illegal claimed move fails the check, an explanation without claims keeps its status', async () => {
  const f = await failures(checkClaims(explanation([{ kind: 'best', uci: 'e2e5' }]), start, fakeEngine(top)))
  assert.match(f[0]!, /illegal/)
  const plain = await checkClaims(explanation([]), start, fakeEngine())
  assert.equal(plain.status, 'entwurf')
})
