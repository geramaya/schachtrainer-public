import { CancelledError, EngineError } from './service.ts'
import type { Engine, LiveHandle } from './service.ts'

export interface Arbiter {
  /** Game jobs (engine move, review, draw check): always win. */
  high: Engine
  /** Coach jobs: yield to every high job and can only cancel their own job. */
  low: Engine
  highBusy(): boolean
  /** Disposes the engine and ends every live analysis (a disposed engine would otherwise look like "preempted" to it). */
  dispose(): void
}

/** Splits one engine into a high-priority and a low-priority view (the service itself runs one job at a time and lets a new job replace the running one). */
export function createArbiter(engine: Engine): Arbiter {
  let highActive = 0
  let lowActive = 0
  let stopLive: (() => void) | null = null
  let disposed = false
  const waiters = new Set<() => void>()
  const idle = () => highActive === 0 && lowActive === 0
  const wake = () => { for (const w of [...waiters]) w() }
  const waitForChange = () => new Promise<void>((resolve) => {
    const w = () => { waiters.delete(w); resolve() }
    waiters.add(w)
  })
  const high: Engine = {
    ...engine,
    async analyse(fen, opts) { highActive++; try { return await engine.analyse(fen, opts) } finally { highActive--; wake() } },
    async play(fen, opts) { highActive++; try { return await engine.play(fen, opts) } finally { highActive--; wake() } },
  }
  const low: Engine = {
    ...engine,
    async analyse(fen, opts) {
      if (highActive > 0) throw new CancelledError()
      lowActive++
      try { return await engine.analyse(fen, opts) } finally { lowActive--; wake() }
    },
    /** Live analysis is the lowest lane: it waits for game and coach jobs, yields to them mid-run and then starts over; only `stop` or a real engine error ends it early. */
    analyseLive(fen, opts, onInfo): LiveHandle {
      stopLive?.()
      let stopped = false
      let running: LiveHandle | null = null
      const run = async () => {
        for (;;) {
          if (stopped) throw new CancelledError()
          if (disposed) throw new EngineError('engine disposed')
          if (!idle()) { await waitForChange(); continue }
          running = engine.analyseLive(fen, opts, (x) => { if (!stopped) onInfo(x) })
          try {
            return await running.done
          } catch (e) {
            if (disposed) throw new EngineError('engine disposed')
            if (!(e instanceof CancelledError) || stopped) throw e // else: preempted by another job
          } finally {
            running = null
          }
        }
      }
      const done = run()
      const stop = () => {
        stopped = true
        if (stopLive === stop) stopLive = null
        if (running && idle()) running.stop() // only then the running job is ours; otherwise a game/coach job already replaced it
        wake()
      }
      stopLive = stop
      done.catch(() => {})
      return { done, stop }
    },
    play: () => Promise.reject(new Error('the coach never plays')),
    cancel() { if (lowActive > 0 && highActive === 0) engine.cancel() },
  }
  return { high, low, highBusy: () => highActive > 0, dispose() { disposed = true; engine.dispose(); wake() } }
}
