import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { parsePgn, toPgn } from '../src/games/pgn.ts'
import { storedFromRecord } from '../src/games/model.ts'
import type { StoredGame } from '../src/games/model.ts'
import { buildAnalysis } from '../src/analysis/build.ts'
import { readEval } from '../src/games/annotations.ts'
import type { PositionEvals } from '../src/train/review.ts'

const START = new Chess().fen()
const UCIS = ['e2e4', 'e7e5', 'a2a3']
const EV: PositionEvals = {
  whiteCp: [30, 30, 25, -250],
  best: ['e2e4', 'e7e5', 'g1f3', 'a7a6'],
  detail: [
    { mate: null, pv: ['e2e4', 'e7e5'], second: { uci: 'd2d4', whiteCp: -120, mate: null, pv: ['d2d4'] } },
    { mate: null, pv: ['e7e5'], second: null },
    { mate: null, pv: ['g1f3', 'b8c6'], second: { uci: 'b1c3', whiteCp: 20, mate: null, pv: ['b1c3'] } },
    { mate: null, pv: ['a7a6'], second: null },
  ],
}
const game = (over: Partial<StoredGame> = {}): StoredGame => ({
  ...storedFromRecord({ startFen: START, ucis: UCIS, sans: ['e4', 'e5', 'a3'], result: '1-0', reason: 'aufgabe', date: '2026-11-21T10:00:00.000Z', elo: 1500, teacher: null, ownSide: 'white', helps: { hints: 0, bests: 0, repertoire: 0 } },
    { source: 'free', opening: null, retractions: [], review: null }),
  analysis: buildAnalysis(START, UCIS, EV, 12),
  ...over,
})

test('export: move signs, position signs and evaluations as NAGs and [%eval] comments, engine comment marked "Trainer:"', () => {
  const pgn = toPgn(game())
  assert.match(pgn, /1\. e4 \$1 \$14 \{ \[%eval 0\.30\] Trainer: Einziger Zug[^}]*\}/)
  assert.match(pgn, /e5 \$10 \{ \[%eval 0\.25\] \}/)
  assert.match(pgn, /2\. a3 \$4 \$19 \{ \[%eval -2\.50\] Trainer: [^}]*Besser war Sf3[^}]*\}/)
})

test('export: mate evaluations as #n', () => {
  const a = buildAnalysis(START, ['f2f3', 'e7e5', 'g2g4', 'd8h4'], {
    whiteCp: [0, 0, 0, 0, -10000], best: ['e2e4', 'e7e5', 'g1f3', 'd8h4', null],
    detail: [0, 1, 2, 3, 4].map((i) => ({ mate: i === 3 ? -1 : null, pv: [], second: null })),
  }, 12)
  const pgn = toPgn(game({ ucis: ['f2f3', 'e7e5', 'g2g4', 'd8h4'], sans: ['f3', 'e5', 'g4', 'Qh4#'], analysis: a }))
  assert.match(pgn, /2\. g4 \$19 \{ \[%eval #-1\] \}/)
  assert.match(pgn, /Qh4# \$19 1-0/, 'the mated position has no evaluation to write')
})

test('roundtrip: the stored analysis comes back complete (Trainer tag)', () => {
  const g = game()
  const back = parsePgn(toPgn(g)).games[0]!
  assert.deepEqual(back.analysis, g.analysis)
})

test('without the Trainer tag the NAGs and evaluations are read back (foreign files, Lichess)', () => {
  const pgn = toPgn(game()).split('\n').filter((l) => !l.startsWith('[Trainer ')).join('\n')
  const a = parsePgn(pgn).games[0]!.analysis!
  assert.equal(a.source, 'pgn')
  assert.deepEqual(a.moves.map((m) => m.cat), ['great', null, 'blunder'])
  assert.deepEqual(a.positions, [null, { cp: 30, mate: null }, { cp: 25, mate: null }, { cp: -250, mate: null }])
  assert.ok(a.lines.every((l) => l === null))
})

const LICHESS = `[Event "x"]
[White "a"]
[Black "b"]
[Result "1-0"]

1. e4 { [%eval 0.2] [%clk 0:03:00] } 1... e5 $2 { [%eval 0.3] Ein Kommentar } 2. Nf3 (2. Bc4 $4 { versteckt }) 2... Nc6 { [%eval #-3] } 3. Bb5! a6?! 1-0
`

test('a Lichess file: NAGs, "!"/"?!" suffixes, evaluations, mate; variations are ignored', () => {
  const g = parsePgn(LICHESS).games[0]!
  assert.deepEqual(g.analysis!.moves.map((m) => m.cat), [null, 'mistake', null, null, 'great', 'inaccuracy'])
  assert.equal(g.analysis!.positions[1]!.cp, 20)
  assert.equal(g.analysis!.positions[2]!.cp, 30)
  assert.deepEqual(g.analysis!.positions[4], { cp: -10000, mate: -3 })
})

test('foreign comments of a file are kept as "Fremdkommentar", not as own notes; clock tags, "Trainer:" comments and variation comments are not kept', () => {
  const g = parsePgn(LICHESS).games[0]!
  assert.deepEqual(g.comments, { 1: 'Ein Kommentar' })
  assert.deepEqual(g.notes, {})
})

test('own notes and foreign comments survive the roundtrip exactly (line breaks, braces, tags and "Trainer:" in the text)', () => {
  const notes = { 0: 'Trainer: mein Plan }{ [%eval 1.0] ok\nzweite Zeile', 2: 'Fehler (-1.0), besser: x' }
  const comments = { 1: 'Inaccuracy. Qd2 was best.' }
  const back = parsePgn(toPgn(game({ notes, comments }))).games[0]!
  assert.deepEqual(back.notes, notes)
  assert.deepEqual(back.comments, comments)
})

test('readEval: a mate distance of 0 has no side, so it gives no evaluation', () => {
  assert.equal(readEval(['[%eval #0]']), null)
  assert.deepEqual(readEval(['[%eval #-3]']), { cp: -10000, mate: -3 })
})

test('export: the own note as a separate comment (braces in it are made harmless)', () => {
  const pgn = toPgn(game({ notes: { 1: 'Nachher {unklar}' } }))
  assert.match(pgn, /e5 \$10 \{ \[%eval 0\.25\] \} \{ Nachher \(unklar\) \}/)
})

test('a game without analysis exports as before (no NAGs, no evals)', () => {
  const pgn = toPgn(game({ analysis: null }))
  assert.doesNotMatch(pgn, /\$\d|%eval/)
  assert.match(pgn, /1\. e4 e5 2\. a3 1-0/)
})

test('a file without any annotation has no analysis', () => {
  assert.equal(parsePgn('[Event "x"]\n\n1. e4 e5 *\n').games[0]!.analysis, null)
})
