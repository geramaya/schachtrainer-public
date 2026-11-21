import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMaiaClient } from '../src/maia/client.ts'
import type { MaiaStatus } from '../src/maia/client.ts'
import { MOVE_INDEX } from '../src/maia/vocab.ts'
import type { FromWorker, ToWorker, WorkerLike } from '../src/maia/protocol.ts'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

class FakeWorker implements WorkerLike {
  onmessage: WorkerLike['onmessage'] = null
  onerror: WorkerLike['onerror'] = null
  sent: ToWorker[] = []
  terminated = false
  script: (m: ToWorker, reply: (f: FromWorker) => void) => void
  constructor(script: (m: ToWorker, reply: (f: FromWorker) => void) => void) { this.script = script }
  postMessage(m: ToWorker) { this.sent.push(m); queueMicrotask(() => this.script(m, (f) => this.onmessage?.({ data: f }))) }
  terminate() { this.terminated = true }
}
const okScript = (best: string) => (m: ToWorker, reply: (f: FromWorker) => void) => {
  if (m.type === 'load') { reply({ type: 'progress', phase: 'download', loaded: 40, total: 100 }); reply({ type: 'progress', phase: 'verify' }); reply({ type: 'ready' }) }
  else { const logits = new Float32Array(1880).fill(-9); logits[MOVE_INDEX.get(best)!] = 5; reply({ type: 'result', id: m.id, logits }) }
}

test('load: forwards progress, ends ready, and a second load() does not ask the worker again', async () => {
  const w = new FakeWorker(okScript('e2e4'))
  const c = createMaiaClient(() => w, '/maia2/maia_rapid.onnx')
  const seen: MaiaStatus[] = []
  c.subscribe((s) => seen.push(s))
  assert.deepEqual(c.status(), { state: 'idle' })
  await Promise.all([c.load(), c.load()])
  await c.load()
  assert.equal(w.sent.filter((m) => m.type === 'load').length, 1)
  assert.deepEqual(w.sent[0], { type: 'load', url: '/maia2/maia_rapid.onnx' })
  assert.deepEqual(seen.map((s) => s.state === 'loading' ? `${s.phase}:${s.loaded}/${s.total}` : s.state), ['download:0/0', 'download:40/100', 'verify:40/100', 'ready'])
  assert.deepEqual(c.status(), { state: 'ready' })
})

test('load error: rejects with the message, status error, and the next load() tries again', async () => {
  let first = true
  const w = new FakeWorker((m, reply) => { if (m.type === 'load' && first) { first = false; reply({ type: 'loadError', message: 'checksum mismatch' }) } else okScript('e2e4')(m, reply) })
  const c = createMaiaClient(() => w, '/m')
  await assert.rejects(c.load(), /checksum mismatch/)
  assert.deepEqual(c.status(), { state: 'error', message: 'checksum mismatch' })
  await c.load()
  assert.deepEqual(c.status(), { state: 'ready' })
})

test('move: loads on demand, sends the encoded position and returns the legal move of the logits (greedy)', async () => {
  const w = new FakeWorker(okScript('d2d4'))
  const c = createMaiaClient(() => w, '/m')
  assert.equal(await c.move(START, 1500, { temperature: 0 }), 'd2d4')
  const run = w.sent.find((m) => m.type === 'run')
  assert.ok(run && run.type === 'run' && run.boards.length === 18 * 64 && run.eloSelf === 5 && run.eloOppo === 5)
})

test('move: a model answer without any legal move is an error, never played', async () => {
  const w = new FakeWorker((m, reply) => { if (m.type === 'load') reply({ type: 'ready' }); else reply({ type: 'result', id: m.id, logits: new Float32Array(10) }) })
  const c = createMaiaClient(() => w, '/m')
  await assert.rejects(c.move(START, 1500, { temperature: 0 }), /legal/i)
})

test('move: a failing run rejects; a crashed worker rejects the waiting move and sets the error state', async () => {
  const w = new FakeWorker((m, reply) => { if (m.type === 'load') reply({ type: 'ready' }); else reply({ type: 'runError', id: m.id, message: 'Gather indices' }) })
  const c = createMaiaClient(() => w, '/m')
  await assert.rejects(c.move(START, 1500), /Gather indices/)
  const hang = new FakeWorker((m, reply) => { if (m.type === 'load') reply({ type: 'ready' }) })
  const c2 = createMaiaClient(() => hang, '/m')
  const p = c2.move(START, 1500)
  await new Promise((r) => setTimeout(r, 5))
  hang.onerror?.({ message: 'worker died' })
  await assert.rejects(p, /worker died/)
  assert.equal(c2.status().state, 'error')
})

test('dispose terminates the worker', async () => {
  const w = new FakeWorker(okScript('e2e4'))
  const c = createMaiaClient(() => w, '/m')
  await c.load()
  c.dispose()
  assert.equal(w.terminated, true)
  assert.equal(c.status().state, 'idle')
})
