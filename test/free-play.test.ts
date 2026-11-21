import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { lineBundle } from './helpers.ts'
import { bookPliesOf, gameRecord, pickOpening } from '../src/train/free-play.ts'
import type { ContentBundle } from '../src/content/types.ts'

const START = new Chess().fen()
const a = lineBundle(['e4', 'e5', 'Nf3'], true, {}, 3, 'scotch', 'v1')
const b = lineBundle(['d4', 'd5', 'c4'], true, {}, 3, 'qg', 'v2')
const withEntry = (x: ContentBundle, entry: string[]): ContentBundle => ({ ...x, openings: x.openings.map((o) => ({ ...o, entry })) })
const a2 = withEntry(a, ['e4', 'e5', 'Nf3'])
const b2 = withEntry(b, ['d4', 'd5', 'c4'])
const both: ContentBundle = { ...a2, openings: [...a2.openings, ...b2.openings], trees: { ...a2.trees, ...b2.trees } }

test('pickOpening: named once the game has gone through the whole entry', () => {
  assert.equal(pickOpening(both, ['e2e4', 'e7e5', 'g1f3'], START, {}, 'white'), 'scotch')
  assert.equal(pickOpening(both, ['d2d4', 'd7d5', 'c2c4'], START, {}, 'white'), 'qg')
})

test('pickOpening: only a shared prefix or an unfinished entry names no opening (1.e4 e6, 1.e4 e5)', () => {
  assert.equal(pickOpening(both, ['e2e4', 'e7e6'], START, {}, 'white'), null)
  assert.equal(pickOpening(both, ['e2e4', 'e7e5'], START, {}, 'white'), null)
  assert.equal(pickOpening(both, ['d2d4'], START, {}, 'white'), null)
})

test('pickOpening: two openings that both fit equally well name none', () => {
  const twin = { ...a2, openings: a2.openings.map((o) => ({ ...o, id: 'twin' as never })), trees: { twin: a2.trees.scotch! } }
  const tied: ContentBundle = { ...a2, openings: [...a2.openings, ...twin.openings], trees: { ...a2.trees, ...twin.trees } }
  assert.equal(pickOpening(tied, ['e2e4', 'e7e5', 'g1f3'], START, {}, 'white'), null)
})

test('pickOpening: no repertoire note for a game that was never in a book', () => {
  assert.equal(pickOpening(both, ['a2a3'], START, {}, 'white'), null)
})

test('pickOpening: after a deviation later in the line the opening stays', () => {
  assert.equal(pickOpening(both, ['e2e4', 'e7e5', 'g1f3', 'a7a6'], START, {}, 'white'), 'scotch')
})

test('pickOpening: only openings of the own side count', () => {
  assert.equal(pickOpening(both, ['e2e4'], START, {}, 'black'), null)
})

test('pickOpening: start position outside every tree gives none, an empty game names none', () => {
  const odd = '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1'
  assert.equal(pickOpening(both, [], odd, {}, 'white'), null)
  assert.equal(pickOpening(both, [], START, {}, 'white'), null)
})

test('gameRecord: PGN-ready data of a finished game', () => {
  const r = gameRecord({ startFen: START, ucis: ['f2f3', 'e7e5', 'g2g4', 'd8h4'], outcome: { winner: 'black', reason: 'matt' }, date: new Date('2026-11-21T10:00:00Z'), elo: 1500, teacher: 'meister', ownSide: 'white', helps: { hints: 2, bests: 1, repertoire: 0 } })
  assert.deepEqual(r, { startFen: START, ucis: ['f2f3', 'e7e5', 'g2g4', 'd8h4'], sans: ['f3', 'e5', 'g4', 'Qh4#'], result: '0-1', reason: 'matt', date: '2026-11-21T10:00:00.000Z', elo: 1500, teacher: 'meister', ownSide: 'white', helps: { hints: 2, bests: 1, repertoire: 0 } })
})

test('gameRecord: draw and unfinished results', () => {
  const base = { startFen: START, ucis: [], date: new Date(0), elo: 1400, teacher: null, ownSide: 'black' as const, helps: { hints: 0, bests: 0, repertoire: 0 } }
  assert.equal(gameRecord({ ...base, outcome: { winner: null, reason: 'remis' } }).result, '1/2-1/2')
  assert.equal(gameRecord({ ...base, outcome: { winner: 'white', reason: 'aufgabe' } }).result, '1-0')
  assert.equal(gameRecord({ ...base, outcome: { winner: null, reason: 'abbruch' } }).result, '*')
})

test('gameRecord copies the moves: later changes of the live game do not touch the record (and a record can be stored)', () => {
  const live = ['f2f3', 'e7e5']
  const r = gameRecord({ startFen: START, ucis: live, outcome: { winner: null, reason: 'remis' }, date: new Date(0), elo: 1400, teacher: null, ownSide: 'white', helps: { hints: 0, bests: 0, repertoire: 0 } })
  live.push('g2g4')
  assert.deepEqual(r.ucis, ['f2f3', 'e7e5'])
  assert.notEqual(r.ucis, live)
})

test('bookPliesOf: how many moves of the game are in the repertoire tree of the player (longest of the own openings)', () => {
  assert.equal(bookPliesOf(both, ['e2e4', 'e7e5', 'g1f3', 'a7a6'], START, {}, 'white'), 3)
  assert.equal(bookPliesOf(both, ['d2d4', 'd7d5'], START, {}, 'white'), 2)
  assert.equal(bookPliesOf(both, ['a2a3', 'e7e5'], START, {}, 'white'), 0)
  assert.equal(bookPliesOf(both, ['e2e4'], START, {}, 'black'), 0, 'no opening of that side')
  assert.equal(bookPliesOf(both, ['e2e4', 'e7e5', 'g1f3'], START, {}, 'white'), 3, 'the whole game in the book')
  assert.equal(bookPliesOf(null, ['e2e4'], START, {}, 'white'), null, 'no opening data: not known')
})
