import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { MemoryStore } from './games-memory-store.ts'
import { backfillRatings, ratedGameOf, ratingOf } from '../src/games/library.ts'
import { storedFromRecord } from '../src/games/model.ts'
import type { StoredGame } from '../src/games/model.ts'
import { toPgn } from '../src/games/pgn.ts'
import { gameRecord } from '../src/train/free-play.ts'

const START = new Chess().fen()
const make = (date: string, over: { winner?: 'white' | 'black' | null; rated?: boolean; learning?: boolean; timeControl?: string } = {}): StoredGame => {
  const r = gameRecord({ startFen: START, ucis: ['e2e4', 'e7e5', 'g1f3'], outcome: { winner: over.winner === undefined ? 'white' : over.winner, reason: 'matt' }, date: new Date(date), elo: 1500, teacher: null, ownSide: 'white', helps: { hints: 0, bests: 0, repertoire: 0 }, rated: over.rated ?? true, ...(over.learning ? { learning: true } : {}), ...(over.timeControl ? { timeControl: over.timeControl } : {}) })
  return storedFromRecord(r, { source: 'free', opening: null, retractions: [], review: null })
}

test('ratedGameOf: maps a stored game to what the rating needs', () => {
  const g = make('2026-01-01T00:00:00.000Z', { timeControl: '180+2' })
  assert.deepEqual(ratedGameOf(g), { id: g.id, date: g.date, plies: 3, ownSide: 'white', elo: 1500, result: '1-0', reason: 'matt', event: 'Wertungspartie', timeControl: '180+2', opponent: 'stockfish' })
})

test('ratingOf: the rating before/after of a new game, given the games so far', () => {
  const first = make('2026-01-01T00:00:00.000Z')
  const next = make('2026-01-02T00:00:00.000Z', { winner: 'black' })
  assert.deepEqual(ratingOf([first], next), { category: 'none', before: 1520, after: 1499, delta: -21 }) // after +20 from the first game, -21 now
  assert.equal(ratingOf([], make('2026-01-03T00:00:00.000Z', { rated: false })), undefined) // not a Wertungspartie
})

test('PGN: own rating before the game as White/BlackElo, the Stockfish level as the opponent', () => {
  const g = { ...make('2026-01-02T00:00:00.000Z'), rating: { category: 'none' as const, before: 1520, after: 1540, delta: 20 } }
  const pgn = toPgn(g)
  assert.match(pgn, /\[WhiteElo "1520"\]/)
  assert.match(pgn, /\[BlackElo "1500"\]/)
})

test('backfillRatings: fills the rating of old games chronologically, keeps a backup of the previous versions first, and is idempotent', async () => {
  const store = new MemoryStore()
  const a = make('2026-01-01T00:00:00.000Z')
  const b = make('2026-01-02T00:00:00.000Z', { winner: 'black' })
  const learn = make('2026-01-03T00:00:00.000Z', { rated: false, learning: true })
  await store.putMany([b, a, learn])
  const backups: StoredGame[][] = []
  const changed = await backfillRatings(store, (prev) => { backups.push(prev.map((g) => ({ ...g }))) })
  assert.equal(changed, 2)
  assert.equal(backups.length, 1)
  assert.deepEqual(backups[0]!.map((g) => g.rating), [undefined, undefined]) // the backup is taken before anything is written
  const all = await store.all()
  const by = (id: string) => all.find((g) => g.id === id)!
  assert.deepEqual(by(a.id).rating, { category: 'none', before: 1500, after: 1520, delta: 20 })
  assert.deepEqual(by(b.id).rating, { category: 'none', before: 1520, after: 1499, delta: -21 })
  assert.equal(by(learn.id).rating, undefined)
  assert.equal(await backfillRatings(store, () => assert.fail('no second backup')), 0)
})
