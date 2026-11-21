import type { Engine } from './service.ts'
import { createArbiter } from './arbiter.ts'
import type { Arbiter } from './arbiter.ts'

/** Owner of the one shared engine; `make` creates a fresh engine (a worker in the browser). */
export function createRegistry(make: () => Engine) {
  let arbiter: Arbiter | null = null
  let epoch = 0

  function shared(): Arbiter {
    if (!arbiter) {
      arbiter = createArbiter(make())
      epoch++
    }
    return arbiter
  }

  return {
    /** The engine for game jobs (engine move, review, draw check), started on first use. */
    getEngine: (): Engine => shared().high,
    /** The same engine for the coach and the live analysis: yields to game jobs and never cancels them. */
    getCoachEngine: (): Engine => shared().low,
    /** Number of the current engine instance (grows with every new one); read it right after `getCoachEngine()`. */
    engineEpoch: (): number => epoch,
    /**
     * Throws the engine away (e.g. after an EngineError) so the next use starts a fresh worker. The coach may only do so while no game job runs.
     * With `forEpoch`, only the instance the caller used is discarded: a late failure report of an old worker never kills its healthy successor.
     */
    resetEngine(owner: 'game' | 'coach' = 'game', forEpoch?: number): void {
      if (forEpoch !== undefined && forEpoch !== epoch) return
      if (owner === 'coach' && arbiter?.highBusy()) return
      arbiter?.dispose()
      arbiter = null
    },
    /** Aborts a running engine job: the game's (default) or only the coach's own. */
    cancelEngine(owner: 'game' | 'coach' = 'game'): void {
      if (!arbiter) return
      if (owner === 'coach') arbiter.low.cancel()
      else arbiter.high.cancel()
    },
  }
}
