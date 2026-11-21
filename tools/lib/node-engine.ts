import { createRequire } from 'node:module'
import { createEngine } from '../../src/engine/service.ts'
import type { Engine, EngineIO } from '../../src/engine/service.ts'

interface StockfishModule {
  listener: ((line: string) => void) | undefined
  processCommand(cmd: string): void
  terminate(): void
}

type StockfishFactory = (variant: string) => StockfishModule

/** Stockfish (lite, single-threaded WASM) from node_modules, running in-process. */
export function nodeEngineIO(): EngineIO {
  const factory = createRequire(import.meta.url)('stockfish') as StockfishFactory
  const sf = factory('lite-single')
  return {
    post: (cmd) => sf.processCommand(cmd),
    onLine: (cb) => {
      sf.listener = cb
    },
    close: () => sf.terminate(),
  }
}

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export async function nodeEngine(): Promise<Engine> {
  const io = nodeEngineIO()
  const engine = createEngine(io)
  // The first job is started from inside Stockfish's own `uciok` callback; a long search started there
  // crashes the wasm build (RuntimeError: unreachable, seen at depth >= 14). A depth-1 warm-up takes that
  // re-entrant start; later jobs begin from the caller's continuation.
  await engine.analyse(START_FEN, { depth: 1 })
  // Build runs must be reproducible: every analysis starts with a cleared hash table. Only in this Node
  // path; the browser service is unchanged. Jobs run one at a time here, so nothing is in flight.
  return {
    ...engine,
    analyse: (fen, opts) => {
      io.post('ucinewgame')
      return engine.analyse(fen, opts)
    },
  }
}

if (process.argv[2] === '--selftest') {
  const { Chess } = await import('chess.js')
  const eng = await nodeEngine()
  try {
    const a = await eng.analyse(new Chess().fen(), { depth: 8, multipv: 2 })
    const g = new Chess()
    g.move({ from: a.bestUci.slice(0, 2), to: a.bestUci.slice(2, 4), promotion: a.bestUci[4] })
    const p = await eng.play(new Chess().fen(), { elo: 800, movetimeMs: 100 })
    new Chess().move({ from: p.slice(0, 2), to: p.slice(2, 4), promotion: p[4] })
    console.log(`selftest ok: best=${a.bestUci} depth=${a.depth} lines=${a.lines.length} play(elo800)=${p}`)
  } finally {
    eng.dispose()
  }
}
