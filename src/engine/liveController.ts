import { Chess } from 'chess.js'
import { CancelledError, EngineError } from './service.ts'
import type { Analysis, Engine, LiveHandle } from './service.ts'

export interface LiveState {
  fen: string
  running: boolean
  analysis: Analysis | null
  error: string
  /** the position has no legal move: nothing to analyse */
  ended: boolean
}

export interface LiveOptions { multipv: number; depth: number }

export interface LiveControllerDeps {
  engine: () => Engine
  onState: (s: LiveState) => void
  /** an EngineError happened: the owner should throw the dead engine away */
  onEngineError?: () => void
  /** minimum time between two shown intermediate results */
  intervalMs?: number
}

export interface LiveController {
  /** Analyses `fen`; a running analysis is stopped first and its late results are dropped. */
  run(fen: string, opts: LiveOptions): void
  stop(): void
}

const DEFAULT_INTERVAL_MS = 250

export function createLiveController(deps: LiveControllerDeps): LiveController {
  const interval = deps.intervalMs ?? DEFAULT_INTERVAL_MS
  let token = 0
  let handle: LiveHandle | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  let shown: LiveState | null = null
  const emit = (st: LiveState) => { shown = st; deps.onState(st) }

  function halt() {
    token++
    clearTimeout(timer)
    handle?.stop()
    handle = null
  }

  /** Ends a running analysis; the shown state keeps its last result but no longer counts as running. */
  function stop() {
    const was = shown
    halt()
    if (was?.running) emit({ ...was, running: false })
  }

  function run(fen: string, opts: LiveOptions) {
    halt()
    const mine = token
    const base = { fen, running: false, analysis: null, error: '', ended: false }
    if (new Chess(fen).moves().length === 0) { // the wasm engine crashes on positions without legal moves
      emit({ ...base, ended: true })
      return
    }
    emit({ ...base, running: true })

    let lastShown = -Infinity
    let latest: Analysis | null = null
    const show = (a: Analysis) => {
      if (mine !== token) return
      lastShown = Date.now()
      emit({ ...base, running: true, analysis: a })
    }
    const onInfo = (a: Analysis) => {
      latest = a
      const wait = lastShown + interval - Date.now()
      if (wait <= 0) { clearTimeout(timer); show(a); return }
      clearTimeout(timer)
      timer = setTimeout(() => { if (latest) show(latest) }, wait)
    }

    handle = deps.engine().analyseLive(fen, opts, onInfo)
    handle.done.then(
      (a) => {
        if (mine !== token) return
        clearTimeout(timer)
        emit({ ...base, analysis: a })
      },
      (e: unknown) => {
        if (mine !== token) return
        clearTimeout(timer)
        if (e instanceof CancelledError) { emit({ ...base, analysis: latest }); return }
        if (e instanceof EngineError) deps.onEngineError?.()
        emit({ ...base, analysis: latest, error: (e as Error).message })
      },
    )
  }

  return { run, stop }
}
