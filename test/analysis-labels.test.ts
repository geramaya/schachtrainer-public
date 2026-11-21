import { test } from 'node:test'
import assert from 'node:assert/strict'
import { moveLabels } from '../src/analysis/labels.ts'
import type { GameAnalysis } from '../src/analysis/build.ts'

const a: GameAnalysis = {
  version: 2, bookPlies: null, source: 'engine', depth: 12,
  positions: [{ cp: 30, mate: null }, { cp: 30, mate: null }, { cp: -250, mate: null }, null],
  moves: [{ cat: 'great', lossCp: 0 }, { cat: 'blunder', lossCp: 280 }, { cat: null, lossCp: 0 }],
  lines: [null, null, null, null],
}

test('moveLabels: the sign after each move (1-based like the move list) and a hover text with the position sign', () => {
  const l = moveLabels(a)
  assert.deepEqual(l.nags, { 1: '!', 2: '??' })
  assert.deepEqual(l.cats, { 1: 'great', 2: 'blunder' })
  assert.match(l.titles[1]!, /Stark/)
  assert.match(l.titles[1]!, /⩲ Weiß steht etwas besser/)
  assert.match(l.titles[2]!, /Patzer/)
  assert.match(l.titles[2]!, /−\+ Schwarz steht auf Gewinn/)
})

test('moveLabels: a move without sign still gets the position sign as hover text; unknown positions none', () => {
  const l = moveLabels({ ...a, positions: [{ cp: 0, mate: null }, { cp: 0, mate: null }, { cp: 0, mate: null }, { cp: 10, mate: null }] })
  assert.match(l.titles[3]!, /= ausgeglichen/)
  assert.equal(moveLabels(a).titles[4], undefined)
})
