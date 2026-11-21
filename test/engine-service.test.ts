import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEngine, CancelledError, EngineError } from '../src/engine/service.ts'
import type { EngineIO } from '../src/engine/service.ts'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

/** Scripted engine: answers `uci` itself; `go` output is emitted by the test. */
function fakeIO(eloMin = 1320, answerUci = true) {
  const posted: string[] = []
  let cb: (l: string) => void = () => {}
  let errCb: (e: Error) => void = () => {}
  let closed = false
  const io: EngineIO = {
    post(cmd) {
      posted.push(cmd)
      if (cmd === 'uci' && answerUci) {
        cb(`option name UCI_Elo type spin default 1320 min ${eloMin} max 3190`)
        cb('uciok')
      }
    },
    onLine(f) { cb = f },
    onError(f) { errCb = f },
    close() { closed = true },
  }
  return { io, posted, emit: (l: string) => cb(l), fail: (e: Error) => errCb(e), isClosed: () => closed }
}

test('analyse returns lines from side to move and bestmove', async () => {
  const f = fakeIO()
  const eng = createEngine(f.io)
  const p = eng.analyse(START, { depth: 10, multipv: 2 })
  assert.ok(f.posted.includes('setoption name MultiPV value 2'))
  assert.ok(f.posted.includes(`position fen ${START}`))
  assert.ok(f.posted.includes('go depth 10'))
  f.emit('info depth 9 multipv 1 score cp 10 pv e2e4')
  f.emit('info depth 10 multipv 1 score cp 30 pv e2e4 e7e5')
  f.emit('info depth 10 multipv 2 score mate 2 pv d2d4')
  f.emit('bestmove e2e4 ponder e7e5')
  const a = await p
  assert.equal(a.bestUci, 'e2e4')
  assert.equal(a.depth, 10)
  assert.deepEqual(a.lines, [
    { uci: 'e2e4', cp: 30, mate: null, pv: ['e2e4', 'e7e5'] },
    { uci: 'd2d4', cp: null, mate: 2, pv: ['d2d4'] },
  ])
})

test('second analyse cancels the first and gets its own answer', async () => {
  const f = fakeIO()
  const eng = createEngine(f.io)
  const first = eng.analyse(START, { depth: 20 })
  const second = eng.analyse('4k3/8/8/8/8/8/8/4K2R w K - 0 1', { depth: 5 })
  await assert.rejects(first, CancelledError)
  assert.equal(f.posted.filter((c) => c === 'stop').length, 1)
  const goCount = () => f.posted.filter((c) => c.startsWith('go ')).length
  assert.equal(goCount(), 1, 'new go must wait for the old bestmove')
  f.emit('bestmove e2e4') // answer of the cancelled job: discarded
  assert.equal(goCount(), 2)
  f.emit('info depth 5 multipv 1 score cp 900 pv h1h8')
  f.emit('bestmove h1h8')
  const a = await second
  assert.equal(a.bestUci, 'h1h8')
  assert.equal(a.lines[0]?.cp, 900)
})

test('cancel sends stop and rejects with CancelledError', async () => {
  const f = fakeIO()
  const eng = createEngine(f.io)
  const p = eng.analyse(START, { depth: 20 })
  eng.cancel()
  await assert.rejects(p, CancelledError)
  assert.ok(f.posted.includes('stop'))
  f.emit('bestmove e2e4')
  // engine is usable again afterwards
  const q = eng.analyse(START, { depth: 1 })
  f.emit('info depth 1 multipv 1 score cp 5 pv d2d4')
  f.emit('bestmove d2d4')
  assert.equal((await q).bestUci, 'd2d4')
})

test('play limits strength and raises Elo to the engine minimum', async () => {
  const f = fakeIO(1320)
  const eng = createEngine(f.io)
  const p = eng.play(START, { elo: 800, movetimeMs: 200 })
  assert.ok(f.posted.includes('setoption name UCI_LimitStrength value true'))
  assert.ok(f.posted.includes('setoption name UCI_Elo value 1320'))
  assert.ok(f.posted.includes('go movetime 200'))
  f.emit('bestmove g1f3')
  assert.equal(await p, 'g1f3')
})

test('analyse after play turns strength limit off again', async () => {
  const f = fakeIO()
  const eng = createEngine(f.io)
  const p = eng.play(START, { elo: 1500, movetimeMs: 50 })
  f.emit('bestmove g1f3')
  await p
  const a = eng.analyse(START, { depth: 1 })
  const idx = f.posted.lastIndexOf('setoption name UCI_LimitStrength value false')
  assert.ok(idx > f.posted.lastIndexOf('setoption name UCI_LimitStrength value true'))
  f.emit('info depth 1 multipv 1 score cp 5 pv d2d4')
  f.emit('bestmove d2d4')
  await a
})

test('bestmove (none) rejects with an error', async () => {
  const f = fakeIO()
  const eng = createEngine(f.io)
  const p = eng.analyse(START, { depth: 1 })
  f.emit('bestmove (none)')
  await assert.rejects(p, /no legal move/)
})

test('dispose posts quit', () => {
  const f = fakeIO()
  createEngine(f.io).dispose()
  assert.ok(f.posted.includes('quit'))
})

test('after dispose, a late analyse on the old reference rejects with EngineError instead of hanging', async () => {
  const f = fakeIO()
  const eng = createEngine(f.io)
  eng.dispose()
  const hang = new Promise((_, rej) => setTimeout(() => rej(new Error('analyse never settled')), 100))
  await assert.rejects(Promise.race([eng.analyse(START, { depth: 1 }), hang]), (e: unknown) => e instanceof EngineError && /disposed/.test((e as Error).message))
})

test('dispose rejects a job that is still waiting', async () => {
  const f = fakeIO()
  const eng = createEngine(f.io)
  const p = eng.analyse(START, { depth: 20 })
  eng.dispose()
  await assert.rejects(p, CancelledError)
})

const FAST = { handshakeTimeoutMs: 20, drainTimeoutMs: 20 }

test('no uciok within handshake timeout rejects waiting jobs with EngineError', async () => {
  const f = fakeIO(1320, false)
  const eng = createEngine(f.io, FAST)
  await assert.rejects(eng.analyse(START, { depth: 1 }), EngineError)
  await assert.rejects(eng.play(START, { elo: 1500, movetimeMs: 10 }), EngineError)
})

test('no bestmove after stop rejects later jobs instead of hanging', async () => {
  const f = fakeIO()
  const eng = createEngine(f.io, FAST)
  const first = eng.analyse(START, { depth: 20 })
  const second = eng.analyse(START, { depth: 1 })
  await assert.rejects(first, CancelledError)
  await assert.rejects(second, EngineError)
  await assert.rejects(eng.analyse(START, { depth: 1 }), EngineError)
})

test('late bestmove after stop within drain timeout does not fail', async () => {
  const f = fakeIO()
  const eng = createEngine(f.io, { handshakeTimeoutMs: 20, drainTimeoutMs: 200 })
  const first = eng.analyse(START, { depth: 20 })
  eng.cancel()
  await assert.rejects(first, CancelledError)
  f.emit('bestmove e2e4')
  const q = eng.analyse(START, { depth: 1 })
  f.emit('info depth 1 multipv 1 score cp 10 pv d2d4')
  f.emit('bestmove d2d4')
  assert.equal((await q).bestUci, 'd2d4')
})

test('io error rejects running and queued jobs, then fails new jobs at once', async () => {
  const f = fakeIO()
  const eng = createEngine(f.io)
  const running = eng.analyse(START, { depth: 20 })
  const queued = eng.analyse(START, { depth: 5 })
  const r = assert.rejects(running, CancelledError) // superseded by queued
  await r
  f.fail(new Error('worker crashed'))
  await assert.rejects(queued, (e: Error) => e instanceof EngineError && /worker crashed/.test(e.message))
  await assert.rejects(eng.analyse(START, { depth: 1 }), EngineError)
  assert.ok(f.isClosed())
})

test('io error while a job is running rejects it with EngineError', async () => {
  const f = fakeIO()
  const eng = createEngine(f.io)
  const p = eng.analyse(START, { depth: 20 })
  f.fail(new Error('exit 1'))
  await assert.rejects(p, EngineError)
})

test('analyseLive streams a snapshot per info line and resolves with the final analysis', async () => {
  const f = fakeIO()
  const eng = createEngine(f.io)
  const seen: { depth: number; n: number }[] = []
  const h = eng.analyseLive(START, { depth: 12, multipv: 2 }, (a) => seen.push({ depth: a.depth, n: a.lines.length }))
  assert.ok(f.posted.includes('go depth 12'))
  assert.ok(f.posted.includes('setoption name MultiPV value 2'))
  f.emit('info depth 8 multipv 1 score cp 10 pv e2e4')
  f.emit('info depth 8 multipv 2 score cp 5 pv d2d4')
  f.emit('info depth 9 multipv 1 score cp 12 pv e2e4 e7e5')
  f.emit('bestmove e2e4')
  const a = await h.done
  assert.deepEqual(seen, [{ depth: 8, n: 1 }, { depth: 8, n: 2 }, { depth: 9, n: 2 }])
  assert.equal(a.bestUci, 'e2e4')
  assert.equal(a.lines.length, 2)
})

test('analyseLive stop sends stop and rejects with CancelledError; a stop after the end does nothing', async () => {
  const f = fakeIO()
  const eng = createEngine(f.io)
  const h = eng.analyseLive(START, { depth: 30 }, () => {})
  h.stop()
  assert.ok(f.posted.includes('stop'))
  await assert.rejects(h.done, CancelledError)
  f.emit('bestmove e2e4') // drains the cancelled job

  const h2 = eng.analyseLive(START, { depth: 5 }, () => {})
  f.emit('info depth 5 multipv 1 score cp 1 pv e2e4')
  f.emit('bestmove e2e4')
  await h2.done
  const stops = f.posted.filter((c) => c === 'stop').length
  h2.stop()
  assert.equal(f.posted.filter((c) => c === 'stop').length, stops)
})

test('a later job replaces a running live analysis (it rejects as cancelled)', async () => {
  const f = fakeIO()
  const eng = createEngine(f.io)
  const h = eng.analyseLive(START, { depth: 30 }, () => {})
  const p = eng.analyse(START, { depth: 5 })
  await assert.rejects(h.done, CancelledError)
  f.emit('bestmove e2e4') // drain
  f.emit('info depth 5 multipv 1 score cp 1 pv e2e4')
  f.emit('bestmove e2e4')
  await p
})

test('analyse without any exact info line rejects with a readable error instead of returning empty lines', async () => {
  const f = fakeIO()
  const eng = createEngine(f.io)
  const p = eng.analyse(START, { depth: 10 })
  f.emit('info depth 10 multipv 1 score cp 30 lowerbound pv e2e4')
  f.emit('bestmove e2e4')
  await assert.rejects(p, /keine Bewertung/)
})
