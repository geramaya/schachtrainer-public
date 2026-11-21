import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { MemoryStore } from './games-memory-store.ts'
import { backfillRatings, ratedGameOf, ratingOf } from '../src/games/library.ts'
import { MAIA_NAME, maiaName, opponentOf, storedFromRecord } from '../src/games/model.ts'
import type { StoredGame } from '../src/games/model.ts'
import { displayName, playerOf } from '../src/games/identity.ts'
import { parsePgn, toPgn } from '../src/games/pgn.ts'
import { gameRecord } from '../src/train/free-play.ts'
import { recommend, replayRatings } from '../src/train/rating.ts'
import type { RatedGame } from '../src/train/rating.ts'

const START = new Chess().fen()
const make = (date: string, o: { winner?: 'white' | 'black' | null; opponent?: 'maia'; elo?: number } = {}): StoredGame => {
  const r = gameRecord({ startFen: START, ucis: ['e2e4', 'e7e5', 'g1f3'], outcome: { winner: o.winner === undefined ? 'white' : o.winner, reason: 'matt' }, date: new Date(date), elo: o.elo ?? 1500, teacher: null, ownSide: 'white', helps: { hints: 0, bests: 0, repertoire: 0 }, rated: true, ...(o.opponent ? { opponent: o.opponent } : {}) })
  return storedFromRecord(r, { source: 'free', opening: null, retractions: [], review: null })
}

test('a game against Maia is stored under the name "Maia 2 (level)", a Stockfish game as before', () => {
  assert.equal(maiaName(1500), 'Maia 2 (1500)')
  const m = make('2026-01-01T00:00:00.000Z', { opponent: 'maia' })
  assert.deepEqual([m.white, m.black, m.elo], ['Ich', 'Maia 2 (1500)', 1500])
  assert.equal(make('2026-01-01T00:00:00.000Z').black, 'Stockfish')
  assert.ok(MAIA_NAME)
})

test('opponentOf: Maia by the name of the side that is not the player, everything else Stockfish', () => {
  assert.equal(opponentOf(make('2026-01-01T00:00:00.000Z', { opponent: 'maia' })), 'maia')
  assert.equal(opponentOf(make('2026-01-01T00:00:00.000Z')), 'stockfish')
  assert.equal(opponentOf({ white: 'Maia 2 (1500)', black: 'Ich', ownSide: 'black' }), 'maia')
  assert.equal(opponentOf({ white: 'Maia 2 (1500)', black: 'Anna', ownSide: null }), 'stockfish') // imported game of other people
})

test('PGN: White/Black carry "Maia 2 (1500)" and a re-import keeps the opponent', () => {
  const pgn = toPgn(make('2026-01-01T00:00:00.000Z', { opponent: 'maia' }))
  assert.match(pgn, /\[Black "Maia 2 \(1500\)"\]/)
  const back = parsePgn(pgn).games[0]!
  assert.equal(back.black, 'Maia 2 (1500)')
})

test('shown names: no second "(Elo …)" behind the Maia level', () => {
  const g = make('2026-01-01T00:00:00.000Z', { opponent: 'maia' })
  assert.equal(displayName(g, 'black'), 'Maia 2 (1500)')
  assert.deepEqual(playerOf(g, 'black'), { name: 'Maia 2 (1500)', elo: null })
  assert.equal(displayName(make('2026-01-01T00:00:00.000Z'), 'black'), 'Stockfish (Elo 1500)')
})

let n = 0
const rg = (over: Partial<RatedGame> = {}): RatedGame => ({ id: `g${++n}`, date: `2026-02-${String(n).padStart(2, '0')}T10:00:00.000Z`, plies: 40, ownSide: 'white', elo: 1500, result: '1-0', reason: 'matt', event: 'Wertungspartie', timeControl: null, ...over })

test('replayRatings: the rating is kept per opponent kind; games against Stockfish are not touched by Maia games', () => {
  const games = [rg(), rg({ opponent: 'maia', result: '0-1' }), rg({ opponent: 'maia', result: '0-1' })]
  const sf = replayRatings(games)
  assert.equal(sf.entries.length, 1)
  assert.equal(sf.current.none, 1520)
  const maia = replayRatings(games, 'maia')
  assert.equal(maia.entries.length, 2)
  assert.deepEqual([maia.entries[0]!.before, maia.entries[0]!.delta], [1500, -20]) // starts at 1500, own series
  assert.equal(maia.current.none, 1500 - 20 - 19)
})

test('recommend: the level stays inside the range of the opponent (Maia 1100-1900)', () => {
  const entries = replayRatings(Array.from({ length: 4 }, () => rg({ opponent: 'maia' })), 'maia').entries
  assert.equal(recommend(entries, 'none', 1900, { min: 1100, max: 1900 })!.level, 1900)
  assert.equal(recommend(entries, 'none', 1500, { min: 1100, max: 1900 })!.level, 1600)
})

test('ratedGameOf: the opponent comes from the stored names; ratingOf and backfillRatings keep one series per opponent', async () => {
  const sf1 = make('2026-01-01T00:00:00.000Z')
  const m1 = make('2026-01-02T00:00:00.000Z', { opponent: 'maia', winner: 'black' })
  assert.equal(ratedGameOf(m1).opponent, 'maia')
  assert.equal(ratedGameOf(sf1).opponent, 'stockfish')
  assert.deepEqual(ratingOf([sf1], m1), { category: 'none', before: 1500, after: 1480, delta: -20 }) // not 1520 -> 1499
  const store = new MemoryStore()
  await store.putMany([sf1, m1])
  assert.equal(await backfillRatings(store, () => {}), 2)
  const all = await store.all()
  assert.deepEqual(all.find((g) => g.id === sf1.id)!.rating, { category: 'none', before: 1500, after: 1520, delta: 20 })
  assert.deepEqual(all.find((g) => g.id === m1.id)!.rating, { category: 'none', before: 1500, after: 1480, delta: -20 })
})
