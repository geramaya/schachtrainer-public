import { maiaInput } from './encode.ts'
import { chooseMove } from './policy.ts'
import type { WorkerLike } from './protocol.ts'

export type MaiaStatus =
  | { state: 'idle' }
  | { state: 'loading'; phase: 'download' | 'verify'; loaded: number; total: number }
  | { state: 'ready' }
  | { state: 'error'; message: string }

/** Temperature of the move choice: low, so Maia plays like a human of that level but rarely a far-fetched move. */
export const DEFAULT_TEMPERATURE = 0.5

export interface MoveOptions {
  /** 0 = always the most probable legal move */
  temperature?: number
  random?: () => number
}

export interface MaiaClient {
  status(): MaiaStatus
  subscribe(cb: (s: MaiaStatus) => void): () => void
  /** Loads and checks the model once; several callers share one load; after an error the next call tries again. */
  load(): Promise<void>
  move(fen: string, level: number, opts?: MoveOptions): Promise<string>
  /** Terminates the worker; the model is loaded again on next use. */
  dispose(): void
}

/** The page side of Maia-2: the model runs in a worker, encoding and the choice among the legal moves happen here (tested without a browser). */
export function createMaiaClient(spawn: () => WorkerLike, modelUrl: string): MaiaClient {
  let worker: WorkerLike | null = null
  let status: MaiaStatus = { state: 'idle' }
  let loading: Promise<void> | null = null
  let settleLoad: { ok: () => void; fail: (e: Error) => void } | null = null
  let nextId = 0
  const runs = new Map<number, { ok: (l: Float32Array) => void; fail: (e: Error) => void }>()
  const listeners = new Set<(s: MaiaStatus) => void>()

  const set = (s: MaiaStatus) => { status = s; for (const cb of [...listeners]) cb(s) }
  const stop = () => { worker?.terminate(); worker = null; loading = null; settleLoad = null }
  function fail(message: string) {
    const e = new Error(message)
    settleLoad?.fail(e)
    for (const r of runs.values()) r.fail(e)
    runs.clear()
    stop()
    set({ state: 'error', message })
  }

  function load(): Promise<void> {
    if (status.state === 'ready') return Promise.resolve()
    if (loading) return loading
    const w = spawn()
    worker = w
    loading = new Promise<void>((ok, bad) => { settleLoad = { ok, fail: bad } })
    loading.catch(() => {}) // a failure reaches the callers; nobody else may leave it unhandled
    set({ state: 'loading', phase: 'download', loaded: 0, total: 0 })
    w.onerror = (e) => fail(e.message || 'Maia worker failed')
    w.onmessage = ({ data }) => {
      if (data.type === 'progress') {
        const prev = status.state === 'loading' ? status : { loaded: 0, total: 0 }
        set(data.phase === 'download' ? { state: 'loading', phase: 'download', loaded: data.loaded, total: data.total } : { state: 'loading', phase: 'verify', loaded: prev.loaded, total: prev.total })
      } else if (data.type === 'ready') { set({ state: 'ready' }); settleLoad?.ok(); settleLoad = null }
      else if (data.type === 'loadError') fail(data.message)
      else if (data.type === 'result') { runs.get(data.id)?.ok(data.logits); runs.delete(data.id) }
      else if (data.type === 'runError') { runs.get(data.id)?.fail(new Error(data.message)); runs.delete(data.id) }
    }
    w.postMessage({ type: 'load', url: modelUrl })
    return loading
  }

  async function move(fen: string, level: number, opts: MoveOptions = {}): Promise<string> {
    const input = maiaInput(fen, level)
    await load()
    const w = worker
    if (!w) throw new Error('Maia worker is gone')
    const id = nextId++
    const logits = await new Promise<Float32Array>((ok, bad) => {
      runs.set(id, { ok, fail: bad })
      w.postMessage({ type: 'run', id, boards: input.boards, eloSelf: input.eloSelf, eloOppo: input.eloOppo })
    })
    return chooseMove(logits, fen, { temperature: opts.temperature ?? DEFAULT_TEMPERATURE, random: opts.random ?? Math.random })
  }

  return {
    status: () => status,
    subscribe(cb) { listeners.add(cb); return () => { listeners.delete(cb) } },
    load,
    move,
    dispose() { stop(); runs.clear(); set({ state: 'idle' }) },
  }
}
