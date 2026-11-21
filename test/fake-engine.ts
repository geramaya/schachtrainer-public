import { Chess } from 'chess.js'
import { positionKey } from '../src/chess/position.ts'
import type { Analysis, AnalysisLine, Engine } from '../src/engine/service.ts'

export interface FakeEval {
  /** Lines in rank order; cp is from the point of view of the side to move. */
  lines: { uci: string; cp?: number; mate?: number; pv?: string[] }[]
}

export interface FakeEngine extends Engine {
  calls: { fen: string; depth: number; multipv: number }[]
  disposed: boolean
}

/** Deterministic stand-in for Stockfish. Unknown positions: first legal move, 0 cp. */
export function fakeEngine(table: Record<string, FakeEval> = {}, byKey = true): FakeEngine {
  const calls: FakeEngine['calls'] = []
  const eng: FakeEngine = {
    calls,
    disposed: false,
    async analyse(fen, opts) {
      calls.push({ fen, depth: opts.depth, multipv: opts.multipv ?? 1 })
      // the real wasm Stockfish crashes (RuntimeError: unreachable) on positions without legal moves
      if (new Chess(fen).moves().length === 0) throw new Error('analyse called on a position without legal moves')
      const e = table[byKey ? positionKey(fen) : fen]
      const raw = e?.lines ?? [{ uci: firstMove(fen), cp: 0 }]
      const lines: AnalysisLine[] = raw.slice(0, opts.multipv ?? 1).map((l) => ({
        uci: l.uci,
        cp: l.mate === undefined ? (l.cp ?? 0) : null,
        mate: l.mate ?? null,
        pv: l.pv ?? [l.uci],
      }))
      const a: Analysis = { bestUci: lines[0]!.uci, lines, depth: opts.depth }
      return a
    },
    analyseLive(fen, opts, onInfo) {
      const done = eng.analyse(fen, opts).then((a) => { onInfo(a); return a })
      return { done, stop() {} }
    },
    async play() {
      throw new Error('not used')
    },
    cancel() {},
    dispose() {
      eng.disposed = true
    },
  }
  return eng
}

function firstMove(fen: string): string {
  const m = new Chess(fen).moves({ verbose: true })[0]!
  return m.from + m.to + (m.promotion ?? '')
}

/** FEN after playing SAN moves from the start position. */
export function fenAfter(sans: string[]): string {
  const c = new Chess()
  for (const s of sans) c.move(s)
  return c.fen()
}
