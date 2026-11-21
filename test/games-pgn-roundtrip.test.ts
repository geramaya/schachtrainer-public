import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { parsePgn, toPgn } from '../src/games/pgn.ts'
import { storedFromRecord } from '../src/games/model.ts'
import type { StoredGame } from '../src/games/model.ts'

const START = new Chess().fen()

/** A stored game made from real moves (SAN and UCI from chess.js). */
function game(startFen: string, sans: string[], over: Partial<StoredGame> = {}): StoredGame {
  const c = new Chess(startFen)
  const ucis = sans.map((s) => { const m = c.move(s); return m.from + m.to + (m.promotion ?? '') })
  return {
    ...storedFromRecord({ startFen, ucis, sans: c.history(), result: '1-0', reason: 'aufgabe', date: '2026-11-21T10:00:00.000Z', elo: 1500, teacher: null, ownSide: 'white', helps: { hints: 0, bests: 0, repertoire: 0 } },
      { source: 'free', opening: null, retractions: [], review: null }),
    ...over,
  }
}

test('quotes, backslashes and line breaks in tag values survive the roundtrip', () => {
  const g = game(START, ['e4', 'e5'], { white: 'O"Brien \\ x', black: 'Zeile\neins', opening: 'Sicilian "Najdorf" \\' })
  const pgn = toPgn(g)
  assert.match(pgn, /\[White "O\\"Brien \\\\ x"\]/)
  assert.doesNotMatch(pgn, /Zeile\n/)
  const { games, errors } = parsePgn(pgn)
  assert.deepEqual(errors, [])
  assert.equal(games[0]!.white, 'O"Brien \\ x')
  assert.equal(games[0]!.black, 'Zeile eins')
  assert.equal(games[0]!.opening, 'Sicilian "Najdorf" \\')
})

test('a Lichess file with escaped quotes in a name is read', () => {
  const { games, errors } = parsePgn('[Event "x"]\n[White "O\\"Brien"]\n[Black "b"]\n[Result "1-0"]\n\n1. e4 e5 1-0\n')
  assert.deepEqual(errors, [])
  assert.equal(games[0]!.white, 'O"Brien')
})

const cases: [string, string, string[]][] = [
  ['custom FEN and SetUp', '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1', ['e4', 'Kd7']],
  ['black to move', 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', ['e5', 'Nf3']],
  ['both castlings', 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1', ['O-O', 'O-O-O']],
  ['en passant', 'rnbqkbnr/ppp1pppp/8/8/3pP3/5N2/PPPP1PPP/RNBQKB1R b KQkq e3 0 3', ['dxe3', 'dxe3']],
  ['promotion to queen and knight', '8/4P1k1/8/8/8/8/6K1/8 w - - 0 1', ['e8=Q', 'Kh7']],
  ['underpromotion', '8/4P1k1/8/8/8/8/6K1/8 w - - 0 1', ['e8=N+', 'Kf7']],
]
for (const [name, fen, sans] of cases) {
  test(`roundtrip: ${name}`, () => {
    const g = game(fen, sans)
    const { games, errors } = parsePgn(toPgn(g))
    assert.deepEqual(errors, [])
    assert.equal(games[0]!.startFen, new Chess(fen).fen())
    assert.deepEqual(games[0]!.ucis, g.ucis)
    assert.deepEqual(games[0]!.sans, g.sans)
  })
}

test('a variant file is refused with a clear message instead of a parser error', () => {
  const { games, errors } = parsePgn('[Event "x"]\n[Variant "Crazyhouse"]\n\n1. e4 e5 *\n')
  assert.equal(games.length, 0)
  assert.match(errors[0]!.message, /Variante.*Crazyhouse/)
  assert.equal(parsePgn('[Event "x"]\n[Variant "Standard"]\n\n1. e4 e5 *\n').games.length, 1)
})

test('trainer data (evaluation, retractions, reason, source) survives export and import', () => {
  const g = game(START, ['e4', 'e5', 'Nf3'], {
    reason: 'aufgabe', source: 'sparring',
    review: { marks: [{ ply: 1, severity: 'fehler', lossCp: 130, betterSan: 'Nf6' }], bookExit: 2 },
    retractions: [{ ply: 0, san: 'a3', severity: 'patzer', betterSan: 'e4' }],
  })
  const p = parsePgn(toPgn(g)).games[0]!
  assert.deepEqual(p.data, { source: 'sparring', reason: 'aufgabe', retractions: g.retractions, review: g.review, notes: {}, comments: {} })
})

test('broken trainer data is ignored, the game itself is still imported', () => {
  const g = parsePgn('[Event "x"]\n[Trainer "{kaputt"]\n\n1. e4 e5 *\n')
  assert.equal(g.games.length, 1)
  assert.equal(g.games[0]!.data, null)
  const wrong = parsePgn('[Event "x"]\n[Trainer "{\\"review\\":{\\"marks\\":\\"nein\\"}}"]\n\n1. e4 e5 *\n')
  assert.equal(wrong.games[0]!.data?.review ?? null, null)
})
