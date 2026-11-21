import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { parsePgn, toPgn } from '../src/games/pgn.ts'
import { storedFromRecord } from '../src/games/model.ts'
import type { StoredGame } from '../src/games/model.ts'

const START = new Chess().fen()

const own = (over: Partial<StoredGame> = {}): StoredGame => ({
  ...storedFromRecord({ startFen: START, ucis: ['e2e4', 'e7e5', 'g1f3'], sans: ['e4', 'e5', 'Nf3'], result: '1-0', reason: 'aufgabe', date: '2026-11-21T10:00:00.000Z', elo: 1500, teacher: 'meister', ownSide: 'white', helps: { hints: 3, bests: 1, repertoire: 2 } }, { source: 'free', opening: 'Schottische Partie', retractions: [], review: { marks: [{ ply: 1, severity: 'fehler', lossCp: 130, betterSan: 'Nf6' }], bookExit: 2 } }),
  ...over,
})

test('toPgn writes standard headers, moves and result; mistakes become comments', () => {
  const pgn = toPgn(own())
  assert.match(pgn, /\[Event "Schachtrainer: freie Partie"\]/)
  assert.match(pgn, /\[Date "2026\.11\.21"\]/)
  assert.match(pgn, /\[White "Ich"\]/)
  assert.match(pgn, /\[Black "Stockfish"\]/)
  assert.match(pgn, /\[BlackElo "1500"\]/)
  assert.match(pgn, /\[Result "1-0"\]/)
  assert.match(pgn, /\[Opening "Schottische Partie"\]/)
  assert.match(pgn, /\[Teacher "meister"\]/)
  assert.match(pgn, /\[Hints "3"\]/)
  assert.match(pgn, /\[BestMoves "1"\]/)
  assert.match(pgn, /\[RepertoireMoves "2"\]/)
  assert.match(pgn, /1\. e4 e5 \{[^}]*Fehler[^}]*Nf6[^}]*\} 2\. Nf3 1-0/)
})

test('toPgn from a custom start position carries SetUp and FEN', () => {
  const fen = '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1'
  const pgn = toPgn(own({ startFen: fen, ucis: ['e2e4', 'e8d7'], sans: ['e4', 'Kd7'], review: null }))
  assert.match(pgn, /\[SetUp "1"\]/)
  assert.match(pgn, new RegExp(`\\[FEN "${fen}"\\]`))
})

test('roundtrip: own export parses back to the same moves, result and tags', () => {
  const { games, errors } = parsePgn(toPgn(own()))
  assert.deepEqual(errors, [])
  assert.equal(games.length, 1)
  const g = games[0]!
  assert.deepEqual(g.ucis, ['e2e4', 'e7e5', 'g1f3'])
  assert.equal(g.startFen, START)
  assert.equal(g.result, '1-0')
  assert.equal(g.teacher, 'meister')
  assert.equal(g.ownSide, 'white')
  assert.equal(g.elo, 1500)
  assert.equal(g.opening, 'Schottische Partie')
  assert.deepEqual(g.helps, { hints: 3, bests: 1, repertoire: 2 })
  assert.equal(g.date, '2026-11-21')
})

const LICHESS = `[Event "Rated Blitz game"]
[Site "https://lichess.org/abc"]
[Date "2024.01.02"]
[White "alice"]
[Black "bob"]
[Result "1-0"]
[WhiteElo "1500"]
[BlackElo "1480"]
[Opening "Scotch Game"]

1. e4 { [%eval 0.2] [%clk 0:03:00] } 1... e5 $1 2. Nf3 (2. Bc4 Nf6 (2... Bc5)) 2... Nc6 3. d4 exd4 1-0
`

test('Lichess PGN with clock comments, NAGs and variations: main line only', () => {
  const { games, errors } = parsePgn(LICHESS)
  assert.deepEqual(errors, [])
  assert.deepEqual(games[0]!.ucis, ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'd2d4', 'e5d4'])
  assert.equal(games[0]!.white, 'alice')
  assert.equal(games[0]!.black, 'bob')
  assert.equal(games[0]!.ownSide, null)
  assert.equal(games[0]!.helps, null)
})

test('several games in one file; a broken one is reported and the rest still imported', () => {
  const text = `${LICHESS}\n[Event "Kaputt"]\n[Result "*"]\n\n1. e4 e5 2. Ke3 *\n\n[Event "Dritte"]\n[Result "0-1"]\n\n1. f3 e5 2. g4 Qh4# 0-1\n`
  const { games, errors } = parsePgn(text)
  assert.equal(games.length, 2)
  assert.equal(games[1]!.ucis.length, 4)
  assert.equal(errors.length, 1)
  assert.equal(errors[0]!.index, 2)
  assert.match(errors[0]!.message, /Ke3/)
})

test('games without any move and plain garbage are errors, not crashes', () => {
  assert.equal(parsePgn('[Event "x"]\n\n*').errors.length, 1)
  const r = parsePgn('das ist kein pgn')
  assert.equal(r.games.length, 0)
  assert.equal(r.errors.length, 1)
  assert.deepEqual(parsePgn('  \n').errors, [])
})

test('Windows line endings and a BOM are accepted', () => {
  const { games, errors } = parsePgn('﻿' + LICHESS.replace(/\n/g, '\r\n'))
  assert.deepEqual(errors, [])
  assert.equal(games.length, 1)
})

test('unfinished game keeps result "*"', () => {
  assert.equal(parsePgn('[Event "x"]\n\n1. e4 e5 *').games[0]!.result, '*')
})
