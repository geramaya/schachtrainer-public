import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { badgesOf, filterGames } from '../src/games/library.ts'
import { storedFromRecord } from '../src/games/model.ts'
import type { StoredGame } from '../src/games/model.ts'
import type { GameAnalysis } from '../src/analysis/build.ts'
import { toPgn } from '../src/games/pgn.ts'
import { gameRecord } from '../src/train/free-play.ts'

const START = new Chess().fen()
const record = (over: { timeControl?: string; learning?: boolean; rated?: boolean; reason?: 'matt' | 'zeit' } = {}) =>
  gameRecord({ startFen: START, ucis: ['e2e4', 'e7e5'], outcome: { winner: 'white', reason: over.reason ?? 'matt' }, date: new Date('2026-01-01T00:00:00.000Z'), elo: 1500, teacher: null, ownSide: 'white', helps: { hints: 0, bests: 0, repertoire: 0 }, ...over })
const game = (over: Partial<StoredGame> = {}, r = record()): StoredGame => ({ ...storedFromRecord(r, { source: 'free', opening: null, retractions: [], review: null }), ...over })

test('badgesOf: analysed yes/no, learning game, time control as minutes+seconds', () => {
  assert.deepEqual(badgesOf(game()), { analysed: false, learning: false, rated: false, timeControl: null })
  assert.equal(badgesOf(game({ analysis: {} as GameAnalysis })).analysed, true)
  const g = game({}, record({ timeControl: '180+2', learning: true }))
  assert.deepEqual(badgesOf(g), { analysed: false, learning: true, rated: false, timeControl: '3+2' })
  assert.equal(badgesOf(game({ meta: { ...game().meta!, timeControl: '40/7200' } })).timeControl, '40/7200')
  assert.equal(badgesOf(game({ meta: { ...game().meta!, timeControl: '90+30' } })).timeControl, '90+30')
})

test('filterGames: "nur analysierte" keeps only games with a stored analysis', () => {
  const a = game({ analysis: {} as GameAnalysis })
  const b = game()
  assert.deepEqual(filterGames([a, b], { analysed: true }).map((g) => g.id), [a.id])
  assert.equal(filterGames([a, b], {}).length, 2)
})

test('a game with a time control and a time forfeit goes into the PGN as such; a learning game is marked as event', () => {
  const pgn = toPgn(game({}, record({ timeControl: '180+2', learning: true, reason: 'zeit' })))
  assert.match(pgn, /\[TimeControl "180\+2"\]/)
  assert.match(pgn, /\[Termination "time forfeit"\]/)
  assert.match(pgn, /\[Event "Lernpartie"\]/)
  assert.doesNotMatch(toPgn(game()), /Termination|TimeControl|Lernpartie/)
})

test('a game without a teacher is a Wertungspartie: marked as event in DB and PGN, apart from the learning games', () => {
  const g = game({}, record({ rated: true }))
  assert.equal(badgesOf(g).rated, true)
  assert.equal(badgesOf(g).learning, false)
  assert.match(toPgn(g), /\[Event "Wertungspartie"\]/)
  assert.equal(badgesOf(game()).rated, false)
})
