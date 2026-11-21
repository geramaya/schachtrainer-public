import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createArbiter } from '../src/engine/arbiter.ts'
import { CancelledError, EngineError } from '../src/engine/service.ts'
import type { Analysis, Engine } from '../src/engine/service.ts'

/** Engine with the real service semantics: one job at a time, a new job or cancel() rejects the running one with CancelledError. */
function manualEngine() {
  let current: { reject: (e: Error) => void; resolve: (v: never) => void; name: string } | null = null
  const log: string[] = []
  const start = <T>(name: string) => new Promise<T>((resolve, reject) => {
    current?.reject(new CancelledError())
    current = { resolve: resolve as never, reject, name }
    log.push(`start ${name}`)
  })
  let liveInfo: (a: Analysis) => void = () => {}
  const engine: Engine = {
    analyse: () => start<Analysis>('analyse'),
    analyseLive: (_fen, _opts, onInfo) => {
      liveInfo = onInfo
      const mine = start<Analysis>('live')
      return { done: mine, stop: () => engine.cancel() }
    },
    play: () => start<string>('play'),
    cancel: () => { log.push('cancel'); current?.reject(new CancelledError()); current = null },
    dispose() { engine.cancel() }, // like the service: a disposed engine rejects its running job as cancelled
  }
  return { engine, log, info: (x: Analysis) => liveInfo(x), finishCurrent: (v: unknown) => current?.resolve(v as never) }
}
const a: Analysis = { bestUci: 'e2e4', lines: [], depth: 1 }

test('coach cancel while a game move is running does not cancel the move', async () => {
  const m = manualEngine()
  const arb = createArbiter(m.engine)
  const coach = arb.low.analyse('x', { depth: 14 })
  const coachResult = coach.then(() => 'done', (e: Error) => e.name)
  const move = arb.high.play('x', { elo: 1500, movetimeMs: 10 })
  arb.low.cancel() // panel reacts to the position change after the game move started
  m.finishCurrent('e7e5')
  assert.equal(await move, 'e7e5')
  assert.equal(await coachResult, 'CancelledError')
  assert.ok(!m.log.includes('cancel'), 'raw engine.cancel() must not be called')
})

test('coach cancel stops a running coach job', async () => {
  const m = manualEngine()
  const arb = createArbiter(m.engine)
  const coach = arb.low.analyse('x', { depth: 14 }).then(() => 'done', (e: Error) => e.name)
  arb.low.cancel()
  assert.equal(await coach, 'CancelledError')
  assert.deepEqual(m.log, ['start analyse', 'cancel'])
})

test('coach job requested while a game job runs is refused without touching the engine', async () => {
  const m = manualEngine()
  const arb = createArbiter(m.engine)
  const move = arb.high.play('x', { elo: 1500, movetimeMs: 10 })
  await assert.rejects(arb.low.analyse('x', { depth: 14 }), CancelledError)
  assert.deepEqual(m.log, ['start play'])
  m.finishCurrent('e7e5')
  assert.equal(await move, 'e7e5')
  assert.equal(arb.highBusy(), false)
})

test('coach analysis result passes through when nothing else runs', async () => {
  const m = manualEngine()
  const arb = createArbiter(m.engine)
  const p = arb.low.analyse('x', { depth: 14 })
  m.finishCurrent(a)
  assert.equal(await p, a)
})

test('the old coach job finishing late does not disarm the cancel of the new coach job', async () => {
  const m = manualEngine()
  const arb = createArbiter(m.engine)
  const first = arb.low.analyse('x', { depth: 14 }).then(() => 'done', (e: Error) => e.name)
  const second = arb.low.analyse('y', { depth: 14 }).then(() => 'done', (e: Error) => e.name)
  assert.equal(await first, 'CancelledError') // replaced by the second job
  arb.low.cancel()
  assert.ok(m.log.includes('cancel'), 'the second job must still be cancellable')
  assert.equal(await second, 'CancelledError')
})

const tick = () => new Promise<void>((r) => setImmediate(r))
const OPTS = { depth: 22, multipv: 3 }

test('live analysis runs on the engine, streams infos and resolves', async () => {
  const m = manualEngine()
  const arb = createArbiter(m.engine)
  const seen: number[] = []
  const h = arb.low.analyseLive('x', OPTS, (x) => seen.push(x.depth))
  await tick()
  m.info({ ...a, depth: 7 })
  m.finishCurrent({ ...a, depth: 22 })
  assert.equal((await h.done).depth, 22)
  assert.deepEqual(seen, [7])
})

test('live analysis requested while a game job runs waits and starts after it', async () => {
  const m = manualEngine()
  const arb = createArbiter(m.engine)
  const move = arb.high.play('x', { elo: 1500, movetimeMs: 10 })
  const h = arb.low.analyseLive('x', OPTS, () => {})
  await tick()
  assert.deepEqual(m.log, ['start play'])
  m.finishCurrent('e7e5')
  await move
  await tick()
  assert.deepEqual(m.log, ['start play', 'start live'])
  m.finishCurrent(a)
  await h.done
})

test('a game job preempts the live analysis, which resumes afterwards instead of failing', async () => {
  const m = manualEngine()
  const arb = createArbiter(m.engine)
  const h = arb.low.analyseLive('x', OPTS, () => {})
  const outcome = h.done.then(() => 'done', (e: Error) => e.name)
  await tick()
  const move = arb.high.play('x', { elo: 1500, movetimeMs: 10 })
  await tick()
  m.finishCurrent('e7e5')
  await move
  await tick()
  assert.deepEqual(m.log, ['start live', 'start play', 'start live'])
  m.finishCurrent(a)
  assert.equal(await outcome, 'done')
})

test('a coach analysis preempts the live analysis, which resumes after the coach finished', async () => {
  const m = manualEngine()
  const arb = createArbiter(m.engine)
  const h = arb.low.analyseLive('x', OPTS, () => {})
  await tick()
  const coach = arb.low.analyse('x', { depth: 14 })
  await tick()
  m.finishCurrent(a)
  await coach
  await tick()
  assert.deepEqual(m.log, ['start live', 'start analyse', 'start live'])
  m.finishCurrent(a)
  await h.done
})

test('stop aborts a running live analysis, and a waiting one without ever starting it', async () => {
  const m = manualEngine()
  const arb = createArbiter(m.engine)
  const h = arb.low.analyseLive('x', OPTS, () => {})
  const out = h.done.then(() => 'done', (e: Error) => e.name)
  await tick()
  h.stop()
  assert.equal(await out, 'CancelledError')
  assert.deepEqual(m.log, ['start live', 'cancel'])

  const move = arb.high.play('x', { elo: 1500, movetimeMs: 10 })
  const w = arb.low.analyseLive('x', OPTS, () => {})
  const wOut = w.done.then(() => 'done', (e: Error) => e.name)
  await tick()
  w.stop()
  assert.equal(await wOut, 'CancelledError')
  assert.ok(!m.log.slice(2).includes('cancel'), 'stopping a waiting live job must not cancel the game move')
  assert.ok(!m.log.slice(2).includes('start live'))
  m.finishCurrent('e7e5')
  assert.equal(await move, 'e7e5')
})

test('coach cancel does not touch a running live analysis', async () => {
  const m = manualEngine()
  const arb = createArbiter(m.engine)
  const h = arb.low.analyseLive('x', OPTS, () => {})
  await tick()
  arb.low.cancel()
  assert.ok(!m.log.includes('cancel'))
  m.finishCurrent(a)
  await h.done
})

test('a new live analysis stops the previous one', async () => {
  const m = manualEngine()
  const arb = createArbiter(m.engine)
  const first = arb.low.analyseLive('x', OPTS, () => {})
  const firstOut = first.done.then(() => 'done', (e: Error) => e.name)
  await tick()
  const second = arb.low.analyseLive('y', OPTS, () => {})
  await tick()
  assert.equal(await firstOut, 'CancelledError')
  m.finishCurrent(a)
  await second.done
})

test('dispose ends a running live analysis with an EngineError instead of leaving it waiting', async () => {
  const m = manualEngine()
  const arb = createArbiter(m.engine)
  const h = arb.low.analyseLive('x', OPTS, () => {})
  const out = h.done.then(() => 'done', (e: Error) => e)
  await tick()
  arb.dispose()
  const e = await Promise.race([out, new Promise((r) => setTimeout(() => r('hangs'), 100))])
  assert.ok(e instanceof EngineError, `expected EngineError, got ${String(e)}`)
})

test('dispose also ends a live analysis that is waiting for a game job', async () => {
  const m = manualEngine()
  const arb = createArbiter(m.engine)
  void arb.high.play('x', { elo: 1500, movetimeMs: 10 }).catch(() => {})
  const h = arb.low.analyseLive('x', OPTS, () => {})
  const out = h.done.then(() => 'done', (e: Error) => e)
  await tick()
  arb.dispose()
  const e = await Promise.race([out, new Promise((r) => setTimeout(() => r('hangs'), 100))])
  assert.ok(e instanceof EngineError)
})
