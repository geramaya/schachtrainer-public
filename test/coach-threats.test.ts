import { test } from 'node:test'
import assert from 'node:assert/strict'
import { threatsByNullMove } from '../src/coach/threats.ts'
import { positionKey } from '../src/chess/position.ts'
import { fakeEngine, fenAfter } from './fake-engine.ts'

const sans = (s: string) => s.split(' ')
// black to move, white threatens Nxf7; the null move hands the move to white
const fen = fenAfter(sans('e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5'))
const nullFen = fen.replace(' b ', ' w ')

test('threat found: best move after the null move gains over the baseline', async () => {
  const eng = fakeEngine({
    [positionKey(fen)]: { lines: [{ uci: 'd7d5', cp: 0 }] },
    [positionKey(nullFen)]: { lines: [{ uci: 'g5f7', cp: 300 }, { uci: 'g5h7', cp: 20 }] },
  })
  assert.deepEqual(await threatsByNullMove(fen, eng, 14), [{ uci: 'g5f7', gainCp: 300 }])
  assert.ok(eng.calls.every((c) => c.depth === 14))
})

test('no threat: gain below the threshold', async () => {
  const eng = fakeEngine({
    [positionKey(fen)]: { lines: [{ uci: 'd7d5', cp: 0 }] },
    [positionKey(nullFen)]: { lines: [{ uci: 'g5f7', cp: 20 }] },
  })
  assert.deepEqual(await threatsByNullMove(fen, eng, 14), [])
})

test('side in check: no null move, engine untouched', async () => {
  const check = fenAfter(sans('e4 e5 Qh5 Nc6 Qxf7+'))
  const eng = fakeEngine()
  assert.deepEqual(await threatsByNullMove(check, eng, 14), [])
  assert.equal(eng.calls.length, 0)
})

test('finished position: engine untouched', async () => {
  const mate = fenAfter(sans('f3 e5 g4 Qh4#'))
  const eng = fakeEngine()
  assert.deepEqual(await threatsByNullMove(mate, eng, 14), [])
  assert.equal(eng.calls.length, 0)
})

test('at most the two strongest threats are reported', async () => {
  const eng = fakeEngine({
    [positionKey(fen)]: { lines: [{ uci: 'd7d5', cp: 0 }] },
    [positionKey(nullFen)]: { lines: [{ uci: 'g5f7', cp: 300 }, { uci: 'g5h7', cp: 250 }, { uci: 'c4f7', cp: 200 }] },
  })
  assert.deepEqual((await threatsByNullMove(fen, eng, 14)).map((t) => t.uci), ['g5f7', 'g5h7'])
})

test('gain below 150 cp is not announced as a threat', async () => {
  const eng = fakeEngine({
    [positionKey(fen)]: { lines: [{ uci: 'd7d5', cp: 0 }] },
    [positionKey(nullFen)]: { lines: [{ uci: 'g5f7', cp: 140 }] },
  })
  assert.deepEqual(await threatsByNullMove(fen, eng, 14), [])
})

test('several moves to the same target square are one threat', async () => {
  const eng = fakeEngine({
    [positionKey(fen)]: { lines: [{ uci: 'd7d5', cp: 0 }] },
    [positionKey(nullFen)]: { lines: [{ uci: 'g5f7', cp: 300 }, { uci: 'c4f7', cp: 280 }, { uci: 'g5h7', cp: 200 }] },
  })
  assert.deepEqual((await threatsByNullMove(fen, eng, 14)).map((t) => t.uci), ['g5f7', 'g5h7'])
})

test('a mating threat carries the mate distance', async () => {
  const eng = fakeEngine({
    [positionKey(fen)]: { lines: [{ uci: 'd7d5', cp: 0 }] },
    [positionKey(nullFen)]: { lines: [{ uci: 'g5f7', mate: 3 }] },
  })
  assert.equal((await threatsByNullMove(fen, eng, 14))[0]!.mateIn, 3)
})

// ---- defensive moves are not threats ----
import { Chess } from 'chess.js'
const AFTER_KXF7 = fenAfter(sans('e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7 Kxf7'))
const NULL_KXF7 = AFTER_KXF7.replace(' w ', ' b ')

test('king step and bishop retreat after the null move are defences, not threats (Fried Liver after 6...Kxf7)', async () => {
  const eng = fakeEngine({
    [positionKey(AFTER_KXF7)]: { lines: [{ uci: 'd1f3', cp: 110 }] },
    [positionKey(NULL_KXF7)]: { lines: [
      { uci: 'f7g8', cp: 480, pv: ['f7g8', 'd1f3', 'c8e6'] },
      { uci: 'c8e6', cp: 470, pv: ['c8e6', 'd1f3', 'f7g8'] },
    ] },
  })
  assert.deepEqual(await threatsByNullMove(AFTER_KXF7, eng, 14), [])
})

test('a quiet move whose line wins material within three plies is still a threat', async () => {
  const fenQ = new Chess('4k3/8/8/8/8/3q4/8/R3K3 b - - 0 1').fen()
  const nullQ = fenQ.replace(' b ', ' w ')
  const eng = fakeEngine({
    [positionKey(fenQ)]: { lines: [{ uci: 'e8e7', cp: 0 }] },
    [positionKey(nullQ)]: { lines: [{ uci: 'a1a3', cp: 900, pv: ['a1a3', 'e8e7', 'a3d3'] }] },
  })
  assert.deepEqual(await threatsByNullMove(fenQ, eng, 14), [{ uci: 'a1a3', gainCp: 900 }])
})
