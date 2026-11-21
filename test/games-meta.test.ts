import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { MemoryStore } from './games-memory-store.ts'
import { enrichAll, exportPgn, filterGames, importGames, listGames, saveGame } from '../src/games/library.ts'
import { dateDe, dateLabel, dateNote, siteLink, storedFromRecord } from '../src/games/model.ts'
import type { StoredGame } from '../src/games/model.ts'
import { parsePgn, toPgn } from '../src/games/pgn.ts'
import { enrichOpening } from '../src/openings/enrich.ts'
import { ecoEntriesFromTsv, parseEcoTable } from '../src/openings/eco.ts'

const START = new Chess().fen()
const TSV = `eco\tname\tpgn
B10\tCaro-Kann Defense\t1. e4 c6
B12\tCaro-Kann Defense: Advance Variation\t1. e4 c6 2. d4 d5 3. e5
`
const table = () => parseEcoTable({ version: 1, entries: ecoEntriesFromTsv(TSV) })!

const own = (over: Partial<StoredGame> = {}): StoredGame => ({
  ...storedFromRecord({ startFen: START, ucis: ['e2e4', 'c7c6', 'd2d4'], sans: ['e4', 'c6', 'd4'], result: '1-0', reason: 'aufgabe', date: '2026-11-21T10:00:00.000Z', elo: 1500, teacher: null, ownSide: 'white', helps: { hints: 0, bests: 0, repertoire: 0 } },
    { source: 'free', opening: 'Caro-Kann', eco: 'B12', repertoire: 'Schottische Partie', retractions: [], review: null, playerName: 'Anna' }),
  ...over,
})

const LICHESS = `[Event "Rated Blitz game"]
[Site "https://lichess.org/abc"]
[Date "2026.??.??"]
[White "alice"]
[Black "bob"]
[Result "1-0"]
[WhiteElo "1800"]
[BlackElo "1750"]
[TimeControl "180+0"]
[ECO "B12"]
[Opening "Caro-Kann Defense: Advance Variation"]

1. e4 c6 2. d4 d5 3. e5 Bf5 1-0
`

test('own game: the player name and the engine as names, tags White/Black/BlackElo correct, ECO and Opening and Repertoire written', () => {
  const pgn = toPgn(own())
  assert.match(pgn, /\[White "Anna"\]/)
  assert.match(pgn, /\[Black "Stockfish"\]/)
  assert.match(pgn, /\[BlackElo "1500"\]/)
  assert.doesNotMatch(pgn, /WhiteElo/)
  assert.match(pgn, /\[ECO "B12"\]/)
  assert.match(pgn, /\[Opening "Caro-Kann"\]/)
  assert.match(pgn, /\[Repertoire "Schottische Partie"\]/)
})

test('a game as black: the player name goes to Black, the engine strength to WhiteElo', () => {
  const g = storedFromRecord({ startFen: START, ucis: ['e2e4'], sans: ['e4'], result: '*', reason: 'abbruch', date: '2026-11-21T10:00:00.000Z', elo: 1700, teacher: null, ownSide: 'black', helps: { hints: 0, bests: 0, repertoire: 0 } }, { source: 'sparring', opening: null, retractions: [], review: null, playerName: 'Anna' })
  const pgn = toPgn(g)
  assert.match(pgn, /\[White "Stockfish"\]/)
  assert.match(pgn, /\[Black "Anna"\]/)
  assert.match(pgn, /\[WhiteElo "1700"\]/)
})

test('import: ECO, opening, event, site, time control, both Elo numbers and an incomplete date are read', () => {
  const g = parsePgn(LICHESS).games[0]!
  assert.equal(g.eco, 'B12')
  assert.equal(g.opening, 'Caro-Kann Defense: Advance Variation')
  assert.deepEqual(g.meta, { event: 'Rated Blitz game', site: 'https://lichess.org/abc', timeControl: '180+0', whiteElo: 1800, blackElo: 1750, dateText: '2026.??.??' })
  assert.equal(g.date, '')
})

test('roundtrip: the meta data of an imported game comes back in the export', () => {
  const s = new MemoryStore()
  return importGames(s, LICHESS, { eco: table() }).then(async () => {
    const stored = (await listGames(s))[0]!
    const pgn = toPgn(stored)
    assert.match(pgn, /\[Event "Rated Blitz game"\]/)
    assert.match(pgn, /\[Site "https:\/\/lichess\.org\/abc"\]/)
    assert.match(pgn, /\[TimeControl "180\+0"\]/)
    assert.match(pgn, /\[WhiteElo "1800"\]/)
    assert.match(pgn, /\[BlackElo "1750"\]/)
    assert.match(pgn, /\[Date "2026\.\?\?\.\?\?"\]/)
    assert.match(pgn, /\[ECO "B12"\]/)
  })
})

test('dateLabel: a full date as ISO day, an incomplete one as written in the file, none as a question mark', () => {
  assert.equal(dateLabel(own()), '2026-11-21')
  assert.equal(dateLabel({ date: '', meta: { dateText: '2026.??.??' } }), '2026.??.??')
  assert.equal(dateLabel({ date: '', meta: { dateText: null } }), '?')
})

test('import with an ECO tag: the tag is shown, our own detection stays as the check; without a tag the detection fills ECO and name', async () => {
  const s = new MemoryStore()
  const noTag = LICHESS.replace('[ECO "B12"]\n', '').replace('[Opening "Caro-Kann Defense: Advance Variation"]\n', '').replace('[White "alice"]', '[White "carol"]')
  const r = await importGames(s, `${LICHESS}\n${noTag}`, { eco: table() })
  assert.equal(r.added, 2)
  const all = await listGames(s)
  const tagged = all.find((g) => g.white === 'alice')!
  assert.deepEqual([tagged.eco, tagged.opening, tagged.enriched], ['B12', 'Caro-Kann Defense: Advance Variation', true])
  assert.deepEqual(tagged.detected, { eco: 'B12', name: 'Caro-Kann Defense: Advance Variation' })
  const plain = all.find((g) => g.white === 'carol')!
  assert.deepEqual([plain.eco, plain.opening], ['B12', 'Caro-Kann Defense: Advance Variation'])
})

test('import without the table (not loaded): the game is stored and marked for later enrichment', async () => {
  const s = new MemoryStore()
  await importGames(s, LICHESS.replace('[ECO "B12"]\n', '').replace('[Opening "Caro-Kann Defense: Advance Variation"]\n', ''), { eco: null })
  const g = (await listGames(s))[0]!
  assert.deepEqual([g.eco, g.opening, g.enriched], [null, null, false])
  await enrichAll(s, [g], table())
  const back = (await listGames(s))[0]!
  assert.deepEqual([back.eco, back.opening, back.enriched], ['B12', 'Caro-Kann Defense: Advance Variation', true])
})

test('enrichOpening: an old own game keeps its repertoire name as the repertoire mark and gets ECO and name from the table, without an engine', () => {
  const old = own({ eco: undefined as unknown as null, opening: 'Schottische Partie', repertoire: undefined as unknown as null, detected: undefined as unknown as null, enriched: undefined as unknown as boolean, meta: undefined as unknown as StoredGame['meta'] })
  const g = enrichOpening(old, table())
  assert.deepEqual([g.eco, g.opening, g.repertoire, g.enriched], ['B10', 'Caro-Kann Defense', 'Schottische Partie', true], 'e4 c6 d4: deepest known position is 1.e4 c6')
  assert.equal(enrichOpening(g, table()), g, 'already enriched: unchanged')
})

test('enrichOpening: an old imported game keeps the opening name of its file', () => {
  const old = own({ source: 'import', opening: 'Caro-Kann Defense', eco: undefined as unknown as null, repertoire: undefined as unknown as null, detected: undefined as unknown as null, enriched: undefined as unknown as boolean })
  const g = enrichOpening(old, table())
  assert.deepEqual([g.eco, g.opening, g.repertoire], ['B10', 'Caro-Kann Defense', null])
})

test('enrichAll writes the enriched games back in one batch and survives a failing store', async () => {
  const s = new MemoryStore()
  const a = own({ enriched: false, eco: null, opening: null, repertoire: null, detected: null })
  await saveGame(s, a)
  const out = await enrichAll(s, [a], table())
  assert.equal(out[0]!.eco, 'B10')
  assert.equal((await s.get(a.id))!.enriched, true)
  s.fail = Object.assign(new Error('x'), { name: 'QuotaExceededError' })
  const again = await enrichAll(s, [own({ id: 'b', enriched: false, eco: null, opening: null, repertoire: null, detected: null })], table())
  assert.equal(again[0]!.eco, 'B10', 'the display still works, the write is retried next time')
})

test('search: names, ECO code, opening name, event and site; "abgebrochen" is its own filter value', () => {
  const imp = parsePgn(LICHESS).games[0]!
  const g = own({ white: imp.white, black: imp.black, eco: 'B12', opening: 'Caro-Kann Defense: Advance Variation', meta: { ...imp.meta } })
  const aborted = own({ id: 'x', result: '*', reason: 'abbruch', eco: null, opening: null })
  const open = own({ id: 'y', result: '*', reason: null, eco: null, opening: null })
  const all = [g, aborted, open]
  assert.deepEqual(filterGames(all, { text: 'b12' }).map((x) => x.id), [g.id])
  assert.deepEqual(filterGames(all, { text: 'advance' }).map((x) => x.id), [g.id])
  assert.deepEqual(filterGames(all, { text: 'alice' }).map((x) => x.id), [g.id])
  assert.deepEqual(filterGames(all, { text: 'rated blitz' }).map((x) => x.id), [g.id])
  assert.deepEqual(filterGames(all, { text: 'lichess.org' }).map((x) => x.id), [g.id])
  assert.deepEqual(filterGames(all, { result: 'abgebrochen' }).map((x) => x.id), ['x'])
  assert.deepEqual(filterGames(all, { result: '*' }).map((x) => x.id), ['y'], 'open does not contain the left games')
  assert.equal(exportPgn([g]).length > 0, true)
})

test('search by side uses the view of the player (imports recognised by name or account)', () => {
  const g = own({ ownSide: null, white: 'anna_schach', black: 'bob', source: 'import' })
  const me = { name: 'Anna', accounts: ['anna_schach'] }
  assert.equal(filterGames([g], { side: 'white' }, me).length, 1)
  assert.equal(filterGames([g], { side: 'black' }, me).length, 0)
})

test('dateDe: day.month.year for the list (no line break), an incomplete date as written, none as a question mark', () => {
  assert.equal(dateDe(own()), '21.11.2026')
  assert.equal(dateDe({ date: '2024-01-02', meta: { dateText: null } }), '02.01.2024')
  assert.equal(dateDe({ date: '', meta: { dateText: '2026.??.??' } }), '2026', 'only the known parts')
  assert.equal(dateDe({ date: '', meta: { dateText: '2026.03.??' } }), '03.2026')
  assert.equal(dateDe({ date: '', meta: { dateText: '????.??.??' } }), '?')
  assert.equal(dateNote({ date: '', meta: { dateText: '2026.??.??' } }), 'Tag und Monat unbekannt')
  assert.equal(dateNote({ date: '', meta: { dateText: '2026.03.??' } }), 'Tag unbekannt')
  assert.equal(dateNote(own()), '')
  assert.equal(dateDe({ date: '', meta: { dateText: null } }), '?')
})

test('siteLink: only http(s) addresses become links, shown without the protocol; anything else stays plain text', () => {
  assert.deepEqual(siteLink('https://lichess.org/abcd1234'), { href: 'https://lichess.org/abcd1234', label: 'lichess.org/abcd1234' })
  assert.deepEqual(siteLink('http://www.chess.com/game/live/1/'), { href: 'http://www.chess.com/game/live/1/', label: 'www.chess.com/game/live/1' })
  assert.equal(siteLink('javascript:alert(1)'), null)
  assert.equal(siteLink('data:text/html,x'), null)
  assert.equal(siteLink('Berlin'), null)
  assert.equal(siteLink(''), null)
})
