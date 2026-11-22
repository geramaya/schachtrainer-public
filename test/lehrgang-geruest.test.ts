import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { baueGeruest, kandidatAusPuzzle, waehleKandidaten } from '../tools/lib/lehrgang-geruest.ts'
import { baueSystem } from '../tools/lib/lehrgang-system.ts'
import { verlaengereLinie } from '../tools/lib/lehrgang-tiefe.ts'
import type { Puzzle } from '../src/content/types.ts'

const LINE = ['e4', 'c6', 'd4', 'd5', 'e5', 'Bf5']
const fenNach = (sans: string[]) => { const c = new Chess(); sans.forEach((s) => c.move(s)); return c.fen() }
const store: Record<string, { uci: string; games: number }[]> = {
  [fenNach(LINE)]: [{ uci: 'g1f3', games: 500 }, { uci: 'f1d3', games: 400 }, { uci: 'b1c3', games: 300 }, { uci: 'f2f4', games: 200 }, { uci: 'c2c3', games: 5 }],
}
const puzzle = (id: string, rating: number, themes: string[], popularity: number, fen: string, moves: string[]): Puzzle => ({ id, fen, moves, rating, popularity, nbPlays: 100, themes, openingTags: ['Caro-Kann_Defense_Advance_Variation'], url: `https://lichess.org/training/${id}` })
// after 1.e4 c6 2.d4 d5 3.e5 Bf5 4.Nf3: Black to move, the opponent move comes first in a Lichess puzzle -> start one ply earlier
const PFEN = fenNach([...LINE, 'Nf3'])
const kandidaten = [
  puzzle('aaa01', 1300, ['fork', 'short'], 90, PFEN, ['e7e6', 'f1b5', 'c6b5']),
  puzzle('aaa02', 1400, ['fork', 'middlegame'], 80, PFEN, ['e7e6', 'f1b5', 'c6b5']),
  puzzle('aaa03', 1500, ['pin', 'short'], 70, PFEN, ['e7e6', 'f1b5', 'c6b5']),
  puzzle('aaa04', 1250, ['sacrifice'], 60, PFEN, ['e7e6', 'f1b5', 'c6b5']),
  puzzle('aaa05', 1550, ['pin'], 50, PFEN, ['e7e6', 'f1b5', 'c6b5']),
].map(kandidatAusPuzzle)
const opts = () => ({
  id: 'vorstoss', zuege: LINE, side: 'black' as const, zielPly: 14, minPartien: 10, anzahlAeste: 3,
  ownMove: (fen: string) => (fen === fenNach([...LINE, 'Nf3']) ? 'e7e6' : null),
  explorer: (fen: string) => store[fen] ?? null,
  engineBest: async (fen: string) => { const g = new Chess(fen); return g.moves({ verbose: true }).map((m) => m.from + m.to)[0] ?? null },
  kandidaten, musterQuellen: [] as string[][],
})

test('verlaengere: when the repertoire has no own move the fallback (engine) decides and the move is marked engine', async () => {
  const r = await verlaengereLinie({ line: LINE, side: 'black', zielPly: 8, minPartien: 10, ownMove: () => null, explorer: (f) => store[f] ?? null, engineBest: async () => 'e7e6', ownFallback: async () => 'e7e6' })
  assert.deepEqual(r.map((x) => `${x.san}:${x.herkunft}`), ['Nf3:daten', 'e6:engine'])
})

test('geruest: the title is the given one, a placeholder without', async () => {
  assert.equal((await baueGeruest({ ...opts(), titel: 'Vorstoßvariante' })).titel, 'Vorstoßvariante')
  assert.equal((await baueGeruest(opts())).titel, 'TODO texter')
})

test('geruest: main line = system line + most frequent explorer move (>= 10 games) + own moves; the origin of every move is marked', async () => {
  const s = await baueGeruest(opts())
  assert.deepEqual(s.hauptlinie.zuege.slice(0, 8).map((z) => `${z.san}:${z.herkunft}`), ['e4:daten', 'c6:repertoire', 'd4:daten', 'd5:repertoire', 'e5:daten', 'Bf5:repertoire', 'Nf3:daten', 'e6:repertoire'])
  assert.ok(s.hauptlinie.zuege.length >= 14)
  assert.ok(s.hauptlinie.zuege.slice(8).every((z) => z.herkunft === 'engine' || z.herkunft === 'repertoire'))
})

test('geruest: exactly the 3 most frequent deviations of the opponent become branches (share of the position, at least 10 games), each short and starting with the deviating move', async () => {
  const s = await baueGeruest(opts())
  assert.deepEqual(s.hauptlinie.aeste.map((a) => a.zuege[0]!.san), ['Bd3', 'Nc3', 'f4'])
  assert.deepEqual(s.hauptlinie.aeste.map((a) => a.ab), [6, 6, 6])
  assert.equal(s.hauptlinie.aeste[0]!.anteil, 400 / 1405)
  assert.ok(s.hauptlinie.aeste.every((a) => a.zuege.length >= 2 && a.zuege.length <= 4 && a.satz.startsWith('TODO texter') && a.zuege.every((z) => z.satz.startsWith('TODO texter'))))
  assert.equal(s.hauptlinie.aeste.length, 3)
})

test('geruest: placeholder puzzles come from the candidates (solution = moves after the opponent move), motifs hold 1-2 each, 2 placeholder model games, and the whole scaffold builds', async () => {
  const s = await baueGeruest(opts())
  assert.ok(s.motive.length >= 2 && s.motive.every((m) => m.raetsel.length >= 1 && m.raetsel.length <= 2 && m.titel.startsWith('TODO texter')))
  const r = s.motive[0]!.raetsel[0]!
  assert.equal(r.puzzleId, 'aaa01')
  assert.equal(r.fen, fenNach([...LINE, 'Nf3', 'e6']), 'puzzle starts after the first (opponent) move')
  assert.deepEqual(r.loesung, ['f1b5', 'c6b5'])
  assert.equal(r.platzhalter, true)
  assert.ok(s.musterpartien.length >= 2 && s.musterpartien.every((m) => m.platzhalter))
  assert.equal(s.kandidaten!.length, kandidaten.length)
  const fehler: string[] = []
  assert.ok(baueSystem(s, 'caro-kann', fehler), fehler.join('\n'))
})

test('candidates: Lichess puzzle -> candidate; selection by popularity, spread over the first theme so that motifs differ, rating bounds respected', () => {
  const k = kandidatAusPuzzle(puzzle('x1', 1300, ['fork', 'short'], 9, PFEN, ['e7e6', 'f1b5']))
  assert.deepEqual([k.puzzleId, k.rating, k.themes, k.url], ['x1', 1300, ['fork', 'short'], 'https://lichess.org/training/x1'])
  const ps = [puzzle('a', 1300, ['fork'], 90, PFEN, ['e7e6', 'f1b5']), puzzle('b', 1300, ['fork'], 80, PFEN, ['e7e6', 'f1b5']), puzzle('c', 1300, ['pin'], 10, PFEN, ['e7e6', 'f1b5']), puzzle('d', 1700, ['pin'], 99, PFEN, ['e7e6', 'f1b5']), puzzle('e', 1100, ['pin'], 99, PFEN, ['e7e6', 'f1b5'])]
  assert.deepEqual(waehleKandidaten(ps, 3).map((x) => x.puzzleId), ['a', 'c', 'b'], 'round robin over themes, popular first; 1700 and 1100 are out of 1200-1600')
})
