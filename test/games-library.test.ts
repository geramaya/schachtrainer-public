import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { MemoryStore } from './games-memory-store.ts'
import { addAnalysis, addReview, exportPgn, setNote, filterGames, importGames, listGames, removeGame, saveGame, storageErrorOf } from '../src/games/library.ts'
import { resultLabel, storedFromRecord } from '../src/games/model.ts'
import type { StoredGame } from '../src/games/model.ts'

const START = new Chess().fen()
const game = (date: string, over: Partial<StoredGame> = {}): StoredGame => ({
  ...storedFromRecord({ startFen: START, ucis: ['e2e4', 'e7e5'], sans: ['e4', 'e5'], result: '1-0', reason: 'matt', date, elo: 1500, teacher: null, ownSide: 'white', helps: { hints: 0, bests: 0, repertoire: 0 } }, { source: 'sparring', opening: 'Schottische Partie', retractions: [], review: null }),
  ...over,
})

test('saveGame stores the game; listGames returns newest first', async () => {
  const s = new MemoryStore()
  const first = game('2026-01-01T00:00:00.000Z')
  assert.deepEqual(await saveGame(s, first), { ok: true, id: first.id })
  await saveGame(s, game('2026-03-01T00:00:00.000Z'))
  await saveGame(s, game('2026-02-01T00:00:00.000Z'))
  assert.deepEqual((await listGames(s)).map((g) => g.date.slice(0, 7)), ['2026-03', '2026-02', '2026-01'])
})

test('every stored game has its own id (two identical games the same day do not overwrite each other); the content key finds duplicates', async () => {
  const a = game('2026-01-01T00:00:00.000Z')
  const b = game('2026-01-01T00:00:00.000Z')
  assert.notEqual(a.id, b.id)
  assert.equal(a.key, b.key)
  assert.notEqual(a.key, game('2026-01-02T00:00:00.000Z').key)
  const s = new MemoryStore()
  await saveGame(s, a)
  await saveGame(s, b)
  assert.equal((await listGames(s)).length, 2)
})

test('a quota error becomes a clear message, nothing is thrown', async () => {
  const s = new MemoryStore()
  s.fail = Object.assign(new Error('full'), { name: 'QuotaExceededError' })
  const r = await saveGame(s, game('2026-01-01T00:00:00.000Z'))
  assert.equal(r.ok, false)
  assert.match((r as { message: string }).message, /Speicher.*voll/i)
})

test('storageErrorOf maps browser errors by kind', () => {
  assert.equal(storageErrorOf(Object.assign(new Error('x'), { name: 'QuotaExceededError' })).kind, 'quota')
  assert.equal(storageErrorOf(Object.assign(new Error('x'), { name: 'SecurityError' })).kind, 'unavailable')
  assert.equal(storageErrorOf(Object.assign(new Error('x'), { name: 'InvalidStateError' })).kind, 'unavailable')
  assert.equal(storageErrorOf(new Error('boom')).kind, 'failed')
  assert.match(storageErrorOf(new Error('boom')).message, /boom/)
})

test('listGames on a blocked store throws a StorageError with a message', async () => {
  const s = new MemoryStore()
  s.fail = Object.assign(new Error('denied'), { name: 'SecurityError' })
  await assert.rejects(() => listGames(s), /nicht verfügbar|privat/i)
})

test('addReview adds the evaluation to a stored game; an unknown id is a message', async () => {
  const s = new MemoryStore()
  const g = game('2026-01-01T00:00:00.000Z')
  await saveGame(s, g)
  const review = { marks: [{ ply: 1, severity: 'patzer' as const, lossCp: 300, betterSan: 'Nf6' }], bookExit: 1 }
  assert.deepEqual(await addReview(s, g.id, review), { ok: true, id: g.id })
  assert.deepEqual((await s.get(g.id))!.review, review)
  assert.equal((await addReview(s, 'nope', review)).ok, false)
})

test('removeGame deletes one game', async () => {
  const s = new MemoryStore()
  const g = game('2026-01-01T00:00:00.000Z')
  await saveGame(s, g)
  await removeGame(s, g.id)
  assert.deepEqual(await listGames(s), [])
})

test('importGames adds new games, skips duplicates, reports broken ones, never aborts', async () => {
  const s = new MemoryStore()
  const text = '[Event "a"]\n[Date "2024.01.02"]\n[White "x"]\n[Black "y"]\n[Result "1-0"]\n\n1. e4 e5 1-0\n\n[Event "b"]\n\n1. e4 e5 2. Ke3 *\n'
  const r1 = await importGames(s, text)
  assert.deepEqual({ added: r1.added, duplicates: r1.duplicates, errors: r1.errors.length }, { added: 1, duplicates: 0, errors: 1 })
  const r2 = await importGames(s, text)
  assert.deepEqual({ added: r2.added, duplicates: r2.duplicates }, { added: 0, duplicates: 1 })
  const g = (await listGames(s))[0]!
  assert.equal(g.source, 'import')
  assert.equal(g.white, 'x')
})

test('importGames on a failing store reports the storage problem instead of throwing', async () => {
  const s = new MemoryStore()
  s.fail = Object.assign(new Error('full'), { name: 'QuotaExceededError' })
  const r = await importGames(s, '[Event "a"]\n\n1. e4 e5 *\n')
  assert.equal(r.added, 0)
  assert.match(r.storageError ?? '', /voll/i)
})

test('exportPgn joins games with a blank line and re-imports completely', async () => {
  const a = game('2026-01-01T00:00:00.000Z')
  const b = game('2026-01-02T00:00:00.000Z', { ucis: ['d2d4', 'd7d5'], sans: ['d4', 'd5'] })
  const s = new MemoryStore()
  const r = await importGames(s, exportPgn([a, b]))
  assert.equal(r.added, 2)
  assert.deepEqual(r.errors, [])
})

test('filterGames: free text over opening, players and teacher; result; own side', () => {
  const a = game('2026-01-01T00:00:00.000Z')
  const b = game('2026-01-02T00:00:00.000Z', { opening: 'Caro-Kann', result: '0-1', ownSide: 'black', teacher: 'fuchs', ucis: ['d2d4'], sans: ['d4'] })
  assert.deepEqual(filterGames([a, b], { text: 'caro' }).map((g) => g.opening), ['Caro-Kann'])
  assert.deepEqual(filterGames([a, b], { text: 'fuchs' }).length, 1)
  assert.equal(filterGames([a, b], { result: '0-1' }).length, 1)
  assert.equal(filterGames([a, b], { side: 'white' }).length, 1)
  assert.equal(filterGames([a, b], {}).length, 2)
})

test('resultLabel: from the player view for own games, raw result for foreign ones', () => {
  const d = '2026-01-01T00:00:00.000Z'
  assert.equal(resultLabel(game(d)), 'Sieg')
  assert.equal(resultLabel(game(d, { ownSide: 'black' })), 'Niederlage')
  assert.equal(resultLabel(game(d, { result: '1/2-1/2' })), 'Remis')
  assert.equal(resultLabel(game(d, { result: '*' })), 'offen')
  assert.equal(resultLabel(game(d, { ownSide: null })), '1-0')
})

const many = (n: number) => Array.from({ length: n }, (_, i) => `[Event "g${i}"]\n[Date "2024.01.02"]\n[White "w${i}"]\n[Black "b"]\n[Result "1-0"]\n\n1. e4 e5 1-0\n`).join('\n')

test('importGames parses in slices: yields to the browser, reports progress', async () => {
  let yields = 0
  const progress: [number, number][] = []
  const r = await importGames(new MemoryStore(), many(5), { sliceMs: 0, yieldFn: async () => { yields++ }, onProgress: (d, t) => progress.push([d, t]) })
  assert.equal(r.added, 5)
  assert.ok(yields >= 4, `yielded ${yields}x`)
  assert.deepEqual(progress.at(-1), [5, 5])
})

test('importGames can be cancelled; what was read before is kept', async () => {
  const s = new MemoryStore()
  let n = 0
  const r = await importGames(s, many(10), { sliceMs: 0, yieldFn: async () => { n++ }, cancelled: () => n >= 3 })
  assert.equal(r.cancelled, true)
  assert.ok(r.added >= 1 && r.added < 10, `added ${r.added}`)
  assert.equal((await s.all()).length, r.added)
})

test('importGames writes in a few batches, not one transaction per game', async () => {
  const s = new MemoryStore()
  const r = await importGames(s, many(250), { batch: 100, sliceMs: 1000 })
  assert.equal(r.added, 250)
  assert.deepEqual(s.batches, [100, 100, 50])
})

test('a game without a Date keeps an empty date; importing the file again on another day finds the duplicates', async () => {
  const s = new MemoryStore()
  const text = '[Event "a"]\n[White "x"]\n[Black "y"]\n\n1. e4 e5 *\n'
  assert.equal((await importGames(s, text)).added, 1)
  assert.equal((await listGames(s))[0]!.date, '')
  const again = await importGames(s, text)
  assert.deepEqual({ added: again.added, duplicates: again.duplicates }, { added: 0, duplicates: 1 })
})

test('trainer data comes back with the import (backup is complete)', async () => {
  const s = new MemoryStore()
  const g = game('2026-01-01T00:00:00.000Z', { review: { marks: [{ ply: 1, severity: 'fehler', lossCp: 130, betterSan: 'Nf6' }], bookExit: 1 }, retractions: [{ ply: 0, san: 'a3', severity: 'patzer', betterSan: 'e4' }] })
  await importGames(s, exportPgn([g]))
  const back = (await listGames(s))[0]!
  assert.deepEqual(back.review, g.review)
  assert.deepEqual(back.retractions, g.retractions)
  assert.equal(back.reason, g.reason)
  assert.equal(back.source, 'sparring')
})

test('addAnalysis stores the analysis with the game; an unknown id is a message', async () => {
  const s = new MemoryStore()
  const g = game('2026-01-01T00:00:00.000Z')
  await saveGame(s, g)
  const a = { version: 2, bookPlies: null, source: 'engine' as const, depth: 12, positions: [{ cp: 0, mate: null }, { cp: 10, mate: null }, { cp: 5, mate: null }], moves: [{ cat: null, lossCp: 0 }, { cat: 'inaccuracy' as const, lossCp: 55 }], lines: [null, null, null] }
  assert.deepEqual(await addAnalysis(s, g.id, a), { ok: true, id: g.id })
  assert.deepEqual((await s.get(g.id))!.analysis, a)
  assert.equal((await addAnalysis(s, 'nope', a)).ok, false)
})

test('setNote saves the own note of a move, an empty text removes it', async () => {
  const s = new MemoryStore()
  const g = game('2026-01-01T00:00:00.000Z')
  await saveGame(s, g)
  await setNote(s, g.id, 1, 'Hier hatte ich Angst')
  assert.deepEqual((await s.get(g.id))!.notes, { 1: 'Hier hatte ich Angst' })
  await setNote(s, g.id, 1, '   ')
  assert.deepEqual((await s.get(g.id))!.notes, {})
})

test('addAnalysis also accepts a reactive proxy (the browser database cannot clone those)', async () => {
  const s = new MemoryStore()
  const g = game('2026-01-01T00:00:00.000Z')
  await saveGame(s, g)
  const a = { version: 2, bookPlies: null, source: 'engine' as const, depth: 12, positions: [{ cp: 0, mate: null }], moves: [], lines: [null] }
  assert.deepEqual(await addAnalysis(s, g.id, new Proxy(a, {})), { ok: true, id: g.id })
  assert.deepEqual((await s.get(g.id))!.analysis, a)
})
