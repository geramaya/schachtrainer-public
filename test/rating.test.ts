import { test } from 'node:test'
import assert from 'node:assert/strict'
import { START_RATING, categoryOf, expectedScore, kFactor, recommend, replayRatings, updateRating } from '../src/train/rating.ts'
import type { RatedGame } from '../src/train/rating.ts'

let n = 0
const g = (over: Partial<RatedGame> = {}): RatedGame => ({
  id: `g${++n}`, date: `2026-01-${String(n).padStart(2, '0')}T10:00:00.000Z`, plies: 40, ownSide: 'white', elo: 1500, result: '1-0', reason: 'matt', event: 'Wertungspartie', timeControl: null, ...over,
})

test('categoryOf: estimated duration = minutes * 60 + 40 * increment (Lichess): < 180 s Bullet, < 480 Blitz, < 1500 Schnellschach, else Klassisch; no clock = none', () => {
  const c = (tc: string | null) => categoryOf(tc)
  assert.deepEqual([c(null), c('abc')], ['none', 'none'])
  assert.deepEqual([c('60+0'), c('15+0'), c('120+1')], ['bullet', 'bullet', 'bullet']) // 60, 15, 160
  assert.deepEqual([c('180+0'), c('180+2'), c('300+3')], ['blitz', 'blitz', 'blitz']) // 180, 260, 420
})

test('categoryOf: the boundaries', () => {
  assert.equal(categoryOf('179+0'), 'bullet')
  assert.equal(categoryOf('180+0'), 'blitz')
  assert.equal(categoryOf('479+0'), 'blitz')
  assert.equal(categoryOf('480+0'), 'rapid')
  assert.equal(categoryOf('600+5'), 'rapid') // 800
  assert.equal(categoryOf('900+10'), 'rapid') // 1300
  assert.equal(categoryOf('1499+0'), 'rapid')
  assert.equal(categoryOf('1500+0'), 'classical')
  assert.equal(categoryOf('1800+20'), 'classical') // 2600
  assert.equal(categoryOf('900+20'), 'classical') // a free time control: 900 + 800 = 1700
})

test('Elo: expected score, K factor (40 for the first 30 games of a category, then 20), rounded integer change', () => {
  assert.equal(expectedScore(1500, 1500), 0.5)
  assert.ok(Math.abs(expectedScore(1500, 1600) - 0.36) < 0.005)
  assert.deepEqual([kFactor(0), kFactor(29), kFactor(30)], [40, 40, 20])
  assert.deepEqual(updateRating(1500, 1500, 1, 0), { rating: 1520, delta: 20 })
  assert.deepEqual(updateRating(1500, 1500, 0, 0), { rating: 1480, delta: -20 })
  assert.deepEqual(updateRating(1500, 1500, 0.5, 0), { rating: 1500, delta: 0 })
  assert.equal(updateRating(1500, 1600, 1, 0).delta, 26) // an upset is worth more
  assert.equal(updateRating(1500, 1500, 1, 30).delta, 10)
})

test('replayRatings: chronological per category, the opponent is the Stockfish level of the game, start 1500', () => {
  const games = [
    g({ date: '2026-02-01T00:00:00.000Z', timeControl: '180+2', result: '1-0' }),
    g({ date: '2026-01-01T00:00:00.000Z', timeControl: null, result: '0-1', elo: 1600 }), // earlier, no clock
    g({ date: '2026-03-01T00:00:00.000Z', timeControl: '180+2', result: '1/2-1/2', elo: 1700 }),
  ]
  const { entries, current } = replayRatings(games)
  assert.deepEqual(entries.map((e) => [e.category, e.before, e.after, e.delta]), [['none', 1500, 1486, -14], ['blitz', 1500, 1520, 20], ['blitz', 1520, 1530, 10]]) // a draw against 1700 gains: expected score 0.26
  assert.equal(current.none, 1486)
  assert.equal(current.blitz, 1530)
  assert.equal(current.bullet, START_RATING)
})

test('replayRatings: playing as Black, resignation and left games count as losses; learning games, foreign games and games before move 2 do not count', () => {
  const games = [
    g({ ownSide: 'black', result: '0-1' }), // win as Black
    g({ result: '0-1', reason: 'aufgabe' }), // resigned
    g({ result: '*', reason: 'abbruch', plies: 5 }), // left: loss
    g({ result: '*', reason: 'abbruch', plies: 1 }), // before move 2: not counted
    g({ event: 'Lernpartie' }),
    g({ event: null }),
    g({ ownSide: null }),
    g({ elo: null }),
  ]
  const { entries } = replayRatings(games)
  assert.deepEqual(entries.map((e) => e.score), [1, 0, 0])
})

test('recommend: from the last 5 games of a category, at least 3: >= 60 % -> +100, <= 30 % -> -100, else the same level; kept inside the strength range', () => {
  const run = (scores: number[], level = 1500) => {
    const { entries } = replayRatings(scores.map((s) => g({ result: s === 1 ? '1-0' : s === 0 ? '0-1' : '1/2-1/2', elo: level })))
    return recommend(entries, 'none', level)
  }
  assert.equal(run([1, 1]), null) // too few games
  assert.equal(run([1, 1, 0, 1, 0])!.level, 1600) // 60 %
  assert.equal(run([0, 0, 1, 0, 0])!.level, 1400) // 20 %
  assert.equal(run([1, 0, 0, 1, 0])!.level, 1500) // 40 %
  assert.equal(run([1, 1, 1, 1, 1], 2400)!.level, 2400) // clamped
  assert.equal(run([0, 0, 0, 0, 0], 1320)!.level, 1320)
  assert.equal(run([0, 0, 0, 1, 1, 1, 1, 1])!.level, 1600) // only the last 5 count
  assert.match(run([1, 1, 0, 1, 0])!.text, /gewinnst meist gegen 1500.*probier 1600/)
  assert.match(run([0, 0, 1, 0, 0])!.text, /1400/)
})
