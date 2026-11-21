import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deferredNoteSave } from '../src/games/note-saver.ts'

test('a note typed before the finished game is stored waits for its id and is written under it', async () => {
  const written: [string, number, string][] = []
  let resolveId: (id: string | null) => void = () => {}
  const ids = new Map([['g1', new Promise<string | null>((r) => { resolveId = r })]])
  const save = deferredNoteSave((k) => ids.get(k) ?? Promise.resolve(null), async (id, ply, text) => { written.push([id, ply, text]); return { ok: true as const } })
  const p = save('g1', 4, 'Springer zu früh')
  await Promise.resolve()
  assert.deepEqual(written, [])
  resolveId('db-77')
  assert.deepEqual(await p, { ok: true })
  assert.deepEqual(written, [['db-77', 4, 'Springer zu früh']])
})

test('a game that could not be stored gives a readable error and writes nothing', async () => {
  let called = false
  const save = deferredNoteSave(() => Promise.resolve(null), async () => { called = true; return { ok: true as const } })
  const r = await save('g2', 0, 'x')
  assert.equal(r.ok, false)
  assert.match((r as { message: string }).message, /nicht gespeichert/)
  assert.equal(called, false)
})

test('a failure of the store is passed on', async () => {
  const save = deferredNoteSave(() => Promise.resolve('id'), async () => ({ ok: false as const, message: 'voll' }))
  assert.deepEqual(await save('g', 1, 't'), { ok: false, message: 'voll' })
})
