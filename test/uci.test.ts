import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseInfo, parseBestMove } from '../src/engine/uci.ts'

test('parseInfo reads depth, cp, pv and multipv', () => {
  const r = parseInfo('info depth 12 seldepth 18 multipv 1 score cp 34 nodes 1 pv e2e4 e7e5')
  assert.deepEqual(r, { depth: 12, cp: 34, mate: null, pv: ['e2e4', 'e7e5'], multipv: 1 })
})

test('parseInfo reads mate scores with cp null', () => {
  const r = parseInfo('info depth 5 multipv 2 score mate -3 pv a1a2')
  assert.deepEqual(r, { depth: 5, cp: null, mate: -3, pv: ['a1a2'], multipv: 2 })
})

test('parseInfo defaults multipv to 1', () => {
  assert.equal(parseInfo('info depth 9 score cp -20 pv d2d4')?.multipv, 1)
})

test('parseInfo ignores bound scores (not exact)', () => {
  assert.equal(parseInfo('info depth 9 score cp -20 lowerbound pv d2d4'), null)
  assert.equal(parseInfo('info depth 9 score cp 20 upperbound pv d2d4'), null)
})

test('parseInfo returns null for lines without score or pv', () => {
  assert.equal(parseInfo('info string NNUE evaluation using nn.bin'), null)
  assert.equal(parseInfo('info depth 3 currmove e2e4 currmovenumber 1'), null)
  assert.equal(parseInfo('readyok'), null)
})

test('parseBestMove extracts the move', () => {
  assert.equal(parseBestMove('bestmove g1f3 ponder b8c6'), 'g1f3')
  assert.equal(parseBestMove('bestmove e2e4'), 'e2e4')
})

test('parseBestMove returns null for none and other lines', () => {
  assert.equal(parseBestMove('bestmove (none)'), null)
  assert.equal(parseBestMove('info depth 1'), null)
})
