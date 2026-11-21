import { test } from 'node:test'
import assert from 'node:assert/strict'
import { graphPoints, graphY, plyAtX } from '../src/analysis/graph.ts'

test('graphY: 0 cp in the middle, white better = up, black better = down, mate exactly at the edge', () => {
  assert.equal(graphY({ cp: 0, mate: null }, 100), 50)
  assert.ok(graphY({ cp: 200, mate: null }, 100) < 50)
  assert.ok(graphY({ cp: -200, mate: null }, 100) > 50)
  assert.equal(graphY({ cp: 10000, mate: 3 }, 100), 0)
  assert.equal(graphY({ cp: -10000, mate: -1 }, 100), 100)
})

test('graphY: capped by the win chance curve - a huge advantage does not leave the box, symmetric', () => {
  assert.ok(graphY({ cp: 9000, mate: null }, 100) >= 0)
  assert.ok(Math.abs(graphY({ cp: 300, mate: null }, 100) + graphY({ cp: -300, mate: null }, 100) - 100) < 1e-9)
})

test('graphPoints: one point per position over the width; unknown positions are left out', () => {
  const pts = graphPoints([{ cp: 0, mate: null }, null, { cp: 100, mate: null }], 200, 100)
  assert.deepEqual(pts.map((p) => p.x), [0, 200])
  assert.deepEqual(pts.map((p) => p.ply), [0, 2])
  assert.deepEqual(graphPoints([{ cp: 0, mate: null }], 200, 100).map((p) => p.x), [0], 'a single position is drawn at the left edge')
  assert.deepEqual(graphPoints([], 200, 100), [])
})

test('plyAtX: the nearest position, clamped to the ends', () => {
  assert.equal(plyAtX(0, 200, 10), 0)
  assert.equal(plyAtX(200, 200, 10), 10)
  assert.equal(plyAtX(101, 200, 10), 5)
  assert.equal(plyAtX(-50, 200, 10), 0)
  assert.equal(plyAtX(999, 200, 10), 10)
  assert.equal(plyAtX(50, 200, 0), 0)
})
