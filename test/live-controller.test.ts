import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLiveController } from '../src/engine/liveController.ts'
import type { LiveState } from '../src/engine/liveController.ts'
import { CancelledError, EngineError } from '../src/engine/service.ts'
import type { Analysis, Engine } from '../src/engine/service.ts'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const MATED = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'
const an = (depth: number): Analysis => ({ bestUci: 'e2e4', depth, lines: [{ uci: 'e2e4', cp: depth, mate: null, pv: ['e2e4'] }] })
const tick = () => new Promise<void>((r) => setImmediate(r))
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Engine whose live jobs are driven by the test. */
function scripted() {
  const jobs: { fen: string; info: (a: Analysis) => void; resolve: (a: Analysis) => void; reject: (e: Error) => void; stopped: boolean }[] = []
  const engine = {
    analyseLive(fen: string, _o: unknown, info: (a: Analysis) => void) {
      let resolve!: (a: Analysis) => void
      let reject!: (e: Error) => void
      const done = new Promise<Analysis>((res, rej) => { resolve = res; reject = rej })
      const job = { fen, info, resolve, reject, stopped: false }
      jobs.push(job)
      return { done, stop() { job.stopped = true; reject(new CancelledError()) } }
    },
  } as unknown as Engine
  return { engine, jobs }
}

function setup(intervalMs = 1000) {
  const s = scripted()
  const states: LiveState[] = []
  let errors = 0
  const c = createLiveController({ engine: () => s.engine, onState: (x) => states.push(x), onEngineError: () => { errors++ }, intervalMs })
  return { ...s, c, states, errors: () => errors }
}
const OPTS = { multipv: 3, depth: 22 }

test('first info shows at once, infos within the interval are dropped, the final result always shows', async () => {
  const t = setup(10_000)
  t.c.run(START, OPTS)
  assert.deepEqual(t.states.at(-1), { fen: START, running: true, analysis: null, error: '', ended: false })
  t.jobs[0]!.info(an(5))
  t.jobs[0]!.info(an(6))
  t.jobs[0]!.info(an(7))
  assert.deepEqual(t.states.filter((s) => s.analysis).map((s) => s.analysis!.depth), [5])
  t.jobs[0]!.resolve(an(22))
  await tick()
  const last = t.states.at(-1)!
  assert.equal(last.running, false)
  assert.equal(last.analysis!.depth, 22)
})

test('the newest dropped info is shown after the interval (trailing update)', async () => {
  const t = setup(30)
  t.c.run(START, OPTS)
  t.jobs[0]!.info(an(5))
  t.jobs[0]!.info(an(6))
  t.jobs[0]!.info(an(7))
  await sleep(80)
  assert.deepEqual(t.states.filter((s) => s.analysis).map((s) => s.analysis!.depth), [5, 7])
  t.c.stop()
})

test('a new run drops everything the old run still reports', async () => {
  const t = setup(0)
  t.c.run(START, OPTS)
  t.c.run(START.replace(' w ', ' b '), OPTS)
  t.jobs[0]!.info(an(9))
  t.jobs[0]!.resolve(an(22))
  await tick()
  assert.ok(t.jobs[0]!.stopped)
  assert.ok(t.states.every((s) => s.analysis === null || s.fen !== START))
  t.jobs[1]!.info(an(3))
  assert.equal(t.states.at(-1)!.analysis!.depth, 3)
})

test('a finished position is not sent to the engine', () => {
  const t = setup()
  t.c.run(MATED, OPTS)
  assert.equal(t.jobs.length, 0)
  assert.deepEqual(t.states.at(-1), { fen: MATED, running: false, analysis: null, error: '', ended: true })
})

test('stop ends the run quietly and silences later infos', async () => {
  const t = setup(0)
  t.c.run(START, OPTS)
  t.jobs[0]!.info(an(4))
  t.c.stop()
  await tick()
  const n = t.states.length
  t.jobs[0]!.info(an(8))
  assert.equal(t.states.length, n)
  assert.equal(t.states.at(-1)!.running, false)
  assert.equal(t.states.at(-1)!.error, '')
})

test('an engine failure becomes an error text and resets the engine', async () => {
  const t = setup()
  t.c.run(START, OPTS)
  t.jobs[0]!.reject(new EngineError('engine did not answer uci with uciok within 15000 ms'))
  await tick()
  const last = t.states.at(-1)!
  assert.equal(last.running, false)
  assert.match(last.error, /uciok/)
  assert.equal(t.errors(), 1)
})
