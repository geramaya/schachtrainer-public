import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gameAccuracy, moveAccuracy, volatilityWeights, winPercent } from '../src/analysis/accuracy.ts'

const near = (a: number, b: number, eps = 0.05) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`)

test('winPercent: logistic curve of the centipawns (Lichess constant 0.00368208), cp limited to +-1000 like scalachess, symmetric around 50', () => {
  near(winPercent(0), 50, 1e-9)
  near(winPercent(100), 59.1, 0.1)
  near(winPercent(-100), 40.9, 0.1)
  near(winPercent(500), 86.3, 0.2)
  near(winPercent(300) + winPercent(-300), 100, 1e-9)
  near(winPercent(10000), winPercent(1000), 1e-9)
  near(winPercent(1000), 97.5, 0.1)
  near(winPercent(-10000), 2.5, 0.1)
})

test('moveAccuracy: no loss is exactly 100, it falls with the drop (including the +1 uncertainty bonus of Lichess), a gain does not exceed 100', () => {
  assert.equal(moveAccuracy(50, 50), 100)
  near(moveAccuracy(60, 50), 64.6, 0.1)
  near(moveAccuracy(80, 50), 25.8, 0.1)
  near(moveAccuracy(51, 50), 100 - 0 + (103.1668100711649 * Math.exp(-0.04354415386753951) - 3.166924740191411 + 1 - 100), 1e-6)
  assert.equal(moveAccuracy(50, 70), moveAccuracy(50, 50), 'a gain counts as no drop')
  assert.ok(moveAccuracy(100, 0) >= 0 && moveAccuracy(100, 0) < 5)
})

test('gameAccuracy: mean of the weighted arithmetic mean and the harmonic mean (one bad move hurts)', () => {
  near(gameAccuracy([{ acc: 100, weight: 1 }, { acc: 100, weight: 1 }])!, 100, 1e-9)
  near(gameAccuracy([{ acc: 100, weight: 1 }, { acc: 100, weight: 1 }, { acc: 10, weight: 1 }])!, 47.5, 0.01)
  near(gameAccuracy([{ acc: 100, weight: 1 }, { acc: 0, weight: 3 }])!, 13.49, 0.01)
})

test('gameAccuracy: no moves = null; a zero accuracy does not divide by zero', () => {
  assert.equal(gameAccuracy([]), null)
  near(gameAccuracy([{ acc: 0, weight: 1 }])!, 0.5, 1e-9)
})

test('volatilityWeights: window = (positions - 1) / 10 rounded down, limited to 2..8 (as in lila)', () => {
  const ramp = (n: number) => Array.from({ length: n }, (_, i) => i * 3)
  const w = (n: number) => volatilityWeights(ramp(n))
  // a ramp of step 3: the standard deviation of a window of k+1 points grows with k, so the window size shows in the first weight
  assert.ok(w(15)[0]! < w(45)[0]!, 'bigger games use a wider window')
  assert.equal(w(100)[0], w(81)[0], '81..100 positions: window 8 (limited)')
  assert.equal(w(5)[0], w(12)[0], 'small games: window 2 (limited)')
  near(w(26)[0]!, 3 * Math.sqrt(8 / 12), 1e-9) // 26 positions: floor(25 / 10) = 2 (rounding would give 3)
  near(w(31)[0]!, 3 * Math.sqrt(15 / 12), 1e-9) // 31 positions: window 3
})

test('volatilityWeights: quiet stretches weigh little, wild swings more, within 0.5..12', () => {
  const quiet = Array.from({ length: 30 }, () => 50)
  assert.ok(volatilityWeights(quiet).every((w) => w === 0.5))
  const wild = Array.from({ length: 30 }, (_, i) => (i % 2 ? 95 : 5))
  assert.ok(volatilityWeights(wild).every((w) => w === 12))
  assert.equal(volatilityWeights(quiet).length, 29, 'one weight per move (positions - 1)')
})
