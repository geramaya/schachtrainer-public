import { publicUrl } from '../ui/assetBase.ts'
import { parseBestMove, parseInfo } from './uci.ts'

export interface EngineIO {
  post(cmd: string): void
  onLine(cb: (l: string) => void): void
  /** Reports a dead engine (worker load/runtime error, process exit); after it no more lines come. */
  onError?(cb: (e: Error) => void): void
  /** Releases the underlying worker/process after `quit`. */
  close?(): void
}

export interface AnalysisLine {
  uci: string
  cp: number | null
  mate: number | null
  pv: string[]
}

/** Scores are from the point of view of the side to move (as UCI reports them). */
export interface Analysis {
  bestUci: string
  lines: AnalysisLine[]
  depth: number
}

/** A running streaming analysis: `done` settles at the depth limit (or rejects), `stop` aborts it unless it is already over. */
export interface LiveHandle {
  done: Promise<Analysis>
  stop(): void
}

export interface Engine {
  analyse(fen: string, opts: { depth: number; multipv?: number }): Promise<Analysis>
  /** Like `analyse`, but calls `onInfo` with the best-so-far analysis after every new `info` line. */
  analyseLive(fen: string, opts: { depth: number; multipv?: number }, onInfo: (a: Analysis) => void): LiveHandle
  play(fen: string, opts: { elo: number; movetimeMs: number }): Promise<string>
  cancel(): void
  dispose(): void
}

export class CancelledError extends Error {
  constructor() {
    super('engine job cancelled')
    this.name = 'CancelledError'
  }
}

/** The engine is unusable (no handshake, unresponsive after stop, worker/process failure). */
export class EngineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EngineError'
  }
}

export const HANDSHAKE_TIMEOUT_MS = 15_000
export const DRAIN_TIMEOUT_MS = 5_000

export interface EngineTimeouts {
  handshakeTimeoutMs?: number
  drainTimeoutMs?: number
}

type Info = NonNullable<ReturnType<typeof parseInfo>>

interface Job {
  cmds: string[]
  infos: Map<number, Info>
  onInfo?: () => void
  done(bestmove: string | null, infos: Map<number, Info>): void
  fail(e: Error): void
}

const DEFAULT_ELO_MIN = 1320

export function createEngine(io: EngineIO, timeouts: EngineTimeouts = {}): Engine {
  const handshakeMs = timeouts.handshakeTimeoutMs ?? HANDSHAKE_TIMEOUT_MS
  const drainMs = timeouts.drainTimeoutMs ?? DRAIN_TIMEOUT_MS
  let eloMin = DEFAULT_ELO_MIN
  let initializing = true
  let draining = false // a cancelled job's bestmove is still due
  let current: Job | null = null
  let pending: Job | null = null
  let broken: EngineError | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  function setTimer(ms: number, what: string): void {
    clearTimeout(timer)
    timer = setTimeout(() => fatal(new EngineError(`engine did not ${what} within ${ms} ms`)), ms)
  }

  /** Marks the engine dead: rejects running and queued jobs; later jobs reject at once. */
  function fatal(e: EngineError): void {
    if (broken) return
    broken = e
    clearTimeout(timer)
    const jobs = [current, pending]
    current = null
    pending = null
    for (const j of jobs) j?.fail(e)
    io.close?.()
  }

  function startPending(): void {
    if (initializing || draining || current || !pending) return
    current = pending
    pending = null
    for (const c of current.cmds) io.post(c)
  }

  function cancelCurrent(): void {
    if (!current) return
    const job = current
    current = null
    draining = true
    io.post('stop')
    setTimer(drainMs, 'answer stop with bestmove')
    job.fail(new CancelledError())
  }

  io.onError?.((e) => fatal(new EngineError(`engine failed: ${e.message}`)))
  io.onLine((line) => {
    if (initializing) {
      const m = /^option name UCI_Elo type spin .* min (\d+)/.exec(line)
      if (m) eloMin = Number(m[1])
      if (line.trim() === 'uciok') {
        clearTimeout(timer)
        initializing = false
        startPending()
      }
      return
    }
    const info = parseInfo(line)
    if (info && current) {
      const prev = current.infos.get(info.multipv)
      if (!prev || info.depth >= prev.depth) current.infos.set(info.multipv, info)
      current.onInfo?.()
      return
    }
    if (!line.startsWith('bestmove')) return
    if (draining) {
      clearTimeout(timer)
      draining = false
      startPending()
      return
    }
    if (current) {
      const job = current
      current = null
      job.done(parseBestMove(line), job.infos)
      startPending()
    }
  })
  setTimer(handshakeMs, 'answer uci with uciok')
  io.post('uci')

  function toAnalysis(bestUci: string, infos: Map<number, Info>): Analysis {
    const sorted = [...infos.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1])
    return {
      bestUci,
      depth: sorted.reduce((d, i) => Math.max(d, i.depth), 0),
      lines: sorted.map((i) => ({ uci: i.pv[0] as string, cp: i.cp, mate: i.mate, pv: i.pv })),
    }
  }

  function submit<T>(cmds: string[], finish: (best: string, infos: Map<number, Info>) => T, onInfo?: (infos: Map<number, Info>) => void): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (broken) {
        reject(broken)
        return
      }
      const job: Job = {
        cmds,
        infos: new Map(),
        onInfo: onInfo && (() => onInfo(job.infos)),
        done(best, infos) {
          if (best === null) reject(new Error('engine has no legal move'))
          else {
            try { resolve(finish(best, infos)) } catch (e) { reject(e) } // done runs from the line handler, a throw would escape there
          }
        },
        fail: reject,
      }
      pending?.fail(new CancelledError())
      pending = job
      cancelCurrent()
      startPending()
    })
  }

  const analyseCmds = (fen: string, opts: { depth: number; multipv?: number }) => [
    'setoption name UCI_LimitStrength value false',
    `setoption name MultiPV value ${opts.multipv ?? 1}`,
    `position fen ${fen}`,
    `go depth ${opts.depth}`,
  ]

  const engine: Engine = {
    analyse(fen, opts) {
      return submit(analyseCmds(fen, opts), (best, infos) => {
        const a = toAnalysis(best, infos)
        // every info line may have been a bound (lowerbound/upperbound) and dropped; callers read lines[0]
        if (a.lines.length === 0) throw new Error('Die Engine hat keine Bewertung geliefert')
        return a
      })
    },
    analyseLive(fen, opts, onInfo) {
      let over = false
      const done = submit(
        analyseCmds(fen, opts),
        toAnalysis,
        (infos) => {
          const first = infos.get(1)
          if (first) onInfo(toAnalysis(first.pv[0] as string, infos))
        },
      ).finally(() => { over = true })
      done.catch(() => {}) // the caller handles rejections; this keeps an unobserved stop from being an unhandled rejection
      return { done, stop: () => { if (!over) engine.cancel() } }
    },
    play(fen, opts) {
      return submit(
        [
          'setoption name MultiPV value 1',
          'setoption name UCI_LimitStrength value true',
          `setoption name UCI_Elo value ${Math.max(opts.elo, eloMin)}`,
          `position fen ${fen}`,
          `go movetime ${opts.movetimeMs}`,
        ],
        (best) => best,
      )
    },
    cancel() {
      pending?.fail(new CancelledError())
      pending = null
      cancelCurrent()
    },
    dispose() {
      engine.cancel()
      broken ??= new EngineError('engine disposed') // a late call on this reference must reject, not wait for a dead worker
      clearTimeout(timer)
      io.post('quit')
      io.close?.()
    },
  }
  return engine
}

/** Stockfish as a Web Worker; the .js finds its .wasm next to itself. */
export function browserEngineIO(url = publicUrl('engine/stockfish-lite-single.js')): EngineIO {
  const worker = new Worker(url)
  return {
    post: (cmd) => worker.postMessage(cmd),
    onLine: (cb) => {
      worker.onmessage = (ev: MessageEvent) => {
        if (typeof ev.data === 'string') cb(ev.data)
      }
    },
    onError: (cb) => {
      worker.onerror = (ev: ErrorEvent) => cb(new Error(ev.message || `worker failed to load ${url}`))
      worker.onmessageerror = () => cb(new Error('worker message could not be deserialized'))
    },
    close: () => worker.terminate(),
  }
}
