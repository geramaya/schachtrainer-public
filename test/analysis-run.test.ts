import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { fakeEngine } from './fake-engine.ts'
import { MemoryStore } from './games-memory-store.ts'
import { analyseStored } from '../src/analysis/run.ts'
import { addResults, saveGame, setNote } from '../src/games/library.ts'
import { storedFromRecord } from '../src/games/model.ts'
import type { StoredGame } from '../src/games/model.ts'

const START = new Chess().fen()
const game = (): StoredGame => storedFromRecord({ startFen: START, ucis: ['e2e4', 'e7e5', 'g1f3'], sans: ['e4', 'e5', 'Nf3'], result: '1-0', reason: 'aufgabe', date: '2026-01-01T00:00:00.000Z', elo: 1500, teacher: null, ownSide: 'white', helps: { hints: 0, bests: 0, repertoire: 0 } }, { source: 'free', opening: null, retractions: [], review: null })
const setup = async () => { const s = new MemoryStore(); const g = game(); await saveGame(s, g); return { s, g } }

test('the analysis is stored and the returned game is the CURRENT one: a note written while the engine ran is not lost', async () => {
  const { s, g } = await setup()
  let wrote = false
  const r = await analyseStored(s, fakeEngine({}), g, { depth: 12, onProgress: () => { if (!wrote) { wrote = true; void setNote(s, g.id, 0, 'Notiz während der Analyse') } } })
  assert.equal(r.kind, 'done')
  const done = r as Extract<typeof r, { kind: 'done' }>
  assert.ok(done.game.analysis)
  assert.equal(done.game.analysis!.moves.length, 3)
  assert.deepEqual(done.game.notes, { 0: 'Notiz während der Analyse' })
  assert.deepEqual((await s.get(g.id))!.notes, { 0: 'Notiz während der Analyse' })
  assert.ok((await s.get(g.id))!.analysis)
})

test('the engine is asked for two lines per position', async () => {
  const { s, g } = await setup()
  const eng = fakeEngine({})
  await analyseStored(s, eng, g, { depth: 10 })
  assert.ok(eng.calls.length >= 4 && eng.calls.every((c) => c.multipv === 2 && c.depth === 10))
})

test('a result for a game that is no longer shown (stale) is thrown away: nothing is stored, the old game is not returned', async () => {
  const { s, g } = await setup()
  let stale = false
  const r = await analyseStored(s, fakeEngine({}), g, { depth: 12, onProgress: (d) => { if (d === 2) stale = true }, isStale: () => stale })
  assert.equal(r.kind, 'stale')
  assert.equal((await s.get(g.id))!.analysis, null)
})

test('cancelling stops the run without storing anything', async () => {
  const { s, g } = await setup()
  let n = 0
  const r = await analyseStored(s, fakeEngine({}), g, { depth: 12, onProgress: () => { n++ }, isCancelled: () => n >= 2 })
  assert.equal(r.kind, 'cancelled')
  assert.equal((await s.get(g.id))!.analysis, null)
})

test('an engine failure and a storage failure are reported as messages', async () => {
  const { s, g } = await setup()
  const bad = { ...fakeEngine({}), analyse: async () => { throw new Error('Engine tot') } }
  const r1 = await analyseStored(s, bad, g, { depth: 12 })
  assert.deepEqual(r1.kind === 'failed' && r1.message, 'Analyse nicht möglich (Engine tot).')
  s.fail = Object.assign(new Error('full'), { name: 'QuotaExceededError' })
  const r2 = await analyseStored(s, fakeEngine({}), g, { depth: 12 })
  assert.equal(r2.kind, 'failed')
  assert.match((r2 as { message: string }).message, /voll/)
})

test('addResults stores review and analysis in ONE write (no lost update between the two)', async () => {
  const { s, g } = await setup()
  const analysis = { version: 2, bookPlies: null, source: 'engine' as const, depth: 12, positions: [{ cp: 0, mate: null }], moves: [], lines: [null] }
  const review = { marks: [], bookExit: null }
  const before = s.writes
  assert.deepEqual(await addResults(s, g.id, { review, analysis }), { ok: true, id: g.id })
  assert.equal(s.writes - before, 1)
  const back = (await s.get(g.id))!
  assert.deepEqual(back.review, review)
  assert.deepEqual(back.analysis, analysis)
})

test('bookPlies: the opening book moves are classified as book', async () => {
  const { s, g } = await setup()
  const r = await analyseStored(s, fakeEngine({}), g, { depth: 12, bookPlies: 2 })
  const done = r as Extract<typeof r, { kind: 'done' }>
  assert.deepEqual(done.game.analysis!.moves.slice(0, 2).map((m) => m.cat), ['book', 'book'])
  assert.equal(done.game.analysis!.bookPlies, 2)
})
