import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateMove } from '../src/teacher/analyse.ts'
import { positionKey } from '../src/chess/position.ts'
import { fakeEngine } from './fake-engine.ts'
import { Chess } from 'chess.js'

const START = new Chess().fen()
const after = (fen: string, uci: string) => { const c = new Chess(fen); c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }); return c.fen() }

test('played move is the best move: one analysis, played = best', async () => {
  const eng = fakeEngine({ [positionKey(START)]: { lines: [{ uci: 'e2e4', cp: 30, pv: ['e2e4', 'e7e5'] }, { uci: 'd2d4', cp: 20, pv: ['d2d4'] }] } })
  const r = await evaluateMove(eng, START, 'e2e4', 14)
  assert.equal(eng.calls.length, 1)
  assert.equal(eng.calls[0]!.multipv, 2)
  assert.deepEqual(r.played, r.best)
})

test('played move is the second line: its score comes from the same analysis', async () => {
  const eng = fakeEngine({ [positionKey(START)]: { lines: [{ uci: 'e2e4', cp: 30 }, { uci: 'd2d4', cp: 20, pv: ['d2d4', 'd7d5'] }] } })
  const r = await evaluateMove(eng, START, 'd2d4', 14)
  assert.equal(eng.calls.length, 1)
  assert.equal(r.played.cp, 20)
})

test('other move: analysed after the move, score and mate flipped to the mover, pv starts with the move', async () => {
  const next = after(START, 'a2a3')
  const eng = fakeEngine({
    [positionKey(START)]: { lines: [{ uci: 'e2e4', cp: 30 }, { uci: 'd2d4', cp: 20 }] },
    [positionKey(next)]: { lines: [{ uci: 'e7e5', cp: 45, pv: ['e7e5', 'e2e4'] }] },
  })
  const r = await evaluateMove(eng, START, 'a2a3', 14)
  assert.equal(eng.calls.length, 2)
  assert.deepEqual(r.played, { uci: 'a2a3', cp: -45, mate: null, pv: ['a2a3', 'e7e5', 'e2e4'] })
})

test('mate against the mover (opponent mates in 2) becomes mate -2 for the mover', async () => {
  const fen = '4r1k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1'
  const next = after(fen, 'd1d2')
  const eng = fakeEngine({ [positionKey(fen)]: { lines: [{ uci: 'h2h3', cp: 0 }, { uci: 'g2g3', cp: 0 }] }, [positionKey(next)]: { lines: [{ uci: 'e8e1', mate: 1, pv: ['e8e1'] }] } })
  const r = await evaluateMove(eng, fen, 'd1d2', 14)
  assert.equal(r.played.mate, -1)
  assert.equal(r.played.cp, null)
})

test('move that ends the game is never sent to the engine (checkmate = mate 1 for the mover, stalemate = 0)', async () => {
  const mateFen = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1'
  const eng = fakeEngine({ [positionKey(mateFen)]: { lines: [{ uci: 'a1a8', mate: 1 }, { uci: 'h2h3', cp: 20 }] } })
  const r = await evaluateMove(eng, mateFen, 'a1a8', 14)
  assert.equal(r.played.mate, 1)
  const stale = '7k/5K2/8/8/8/8/8/6Q1 w - - 0 1'
  const eng2 = fakeEngine({ [positionKey(stale)]: { lines: [{ uci: 'g1g7', mate: 1 }] } })
  const r2 = await evaluateMove(eng2, stale, 'g1g6', 14)
  assert.equal(r2.played.cp, 0)
  assert.equal(eng2.calls.length, 1)
})
