import { Chess } from 'chess.js'
import type { Analysis, AnalysisLine, Engine } from '../../src/engine/service.ts'
import type { Claim, Explanation } from '../../src/content/types.ts'

export const BEST_TOP_N = 3
export const BEST_TOLERANCE_CP = 30
export const THREAT_GAIN_CP = 150
export const BLUNDER_LOSS_CP = 150
const MATE_CP = 10000

export class ClaimCheckError extends Error {
  readonly failures: string[]
  constructor(explanationId: string, failures: string[]) {
    super(`Behauptungen von ${explanationId} nicht belegt:\n- ${failures.join('\n- ')}`)
    this.name = 'ClaimCheckError'
    this.failures = failures
  }
}

/** Centipawns from the side to move's point of view; mate scores become +-(10000 - distance). */
export function score(l: AnalysisLine): number {
  if (l.mate !== null) return Math.sign(l.mate) * (MATE_CP - Math.abs(l.mate))
  return l.cp ?? 0
}

export function applyUci(c: Chess, uci: string): boolean {
  try {
    c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
    return true
  } catch {
    return false
  }
}

/**
 * Engine analysis, except for positions without legal moves: the wasm Stockfish crashes on those
 * (RuntimeError: unreachable), so mate (side to move loses) and stalemate are scored here.
 */
export async function analyseSafe(engine: Engine, fen: string, opts: { depth: number; multipv?: number }): Promise<Analysis> {
  const c = new Chess(fen)
  if (c.moves().length > 0) return engine.analyse(fen, opts)
  const cp = c.isCheckmate() ? -MATE_CP : 0
  return { bestUci: '', depth: 0, lines: [{ uci: '', cp, mate: null, pv: [] }] }
}

const top = (a: Analysis): AnalysisLine => a.lines[0]!

/** Same placement and castling, other side to move, no en passant; null if that position cannot occur. */
export function nullMoveFen(fen: string): string | null {
  const f = fen.split(' ')
  const mover = f[1] === 'w' ? 'w' : 'b'
  const other = mover === 'w' ? 'b' : 'w'
  const flipped = [f[0], other, f[2], '-', f[4], f[5]].join(' ')
  try {
    const c = new Chess(flipped)
    // the side that "passed" must not be in check from the side now to move
    const king = c.findPiece({ type: 'k', color: mover })[0]
    if (!king || c.isAttacked(king, other)) return null
  } catch {
    return null
  }
  return flipped
}

type Check = (claim: Claim) => Promise<{ ok: true; evalCp: number; depth: number } | { ok: false; why: string }>

/**
 * Verifies every claim of an explanation with the engine. All pass: status `engine-geprüft` and the evidence
 * on each claim; otherwise ClaimCheckError listing every failed claim. Explanations without claims are unchanged.
 * threat: gain of the side NOT to move, who plays the claimed move in the null-move position, measured against
 * that side's evaluation of the current position (the threat only counts if it is worth >= 150 cp more).
 * Ruling Hauptsitzung 2026-11-20: this reading of "gegenüber Nullzug-Stellung" stands.
 */
export async function checkClaims(e: Explanation, fen: string, engine: Engine, depth = 18): Promise<Explanation> {
  if (e.claims.length === 0) return e
  const best = await analyseSafe(engine, fen, { depth, multipv: BEST_TOP_N })
  const bestCp = score(top(best))

  const afterMove = async (f: string, uci: string): Promise<{ cp: number; depth: number } | null> => {
    const c = new Chess(f)
    if (!applyUci(c, uci)) return null
    const a = await analyseSafe(engine, c.fen(), { depth })
    return { cp: -score(top(a)), depth: a.depth }
  }

  const checks: Record<Claim['kind'], Check> = {
    async best(c) {
      const i = best.lines.findIndex((l) => l.uci === c.uci)
      if (i < 0 || i >= BEST_TOP_N) return { ok: false, why: `${c.uci} nicht unter den Top ${BEST_TOP_N}` }
      const cp = score(best.lines[i]!)
      if (bestCp - cp > BEST_TOLERANCE_CP) return { ok: false, why: `${c.uci} ${bestCp - cp} cp schlechter als der beste Zug` }
      return { ok: true, evalCp: cp, depth: best.depth }
    },
    async threat(c) {
      const nullFen = nullMoveFen(fen)
      if (!nullFen) return { ok: false, why: `Nullzug-Stellung illegal (Seite am Zug steht im Schach gegenüber ${c.uci})` }
      const r = await afterMove(nullFen, c.uci)
      if (!r) return { ok: false, why: `${c.uci} illegal in der Nullzug-Stellung` }
      const gain = r.cp - -bestCp
      if (gain < THREAT_GAIN_CP) return { ok: false, why: `${c.uci} gewinnt nur ${gain} cp (nötig ${THREAT_GAIN_CP})` }
      return { ok: true, evalCp: r.cp, depth: r.depth }
    },
    async blunder(c) {
      const r = await afterMove(fen, c.uci)
      if (!r) return { ok: false, why: `${c.uci} illegal` }
      const loss = bestCp - r.cp
      if (loss < BLUNDER_LOSS_CP) return { ok: false, why: `${c.uci} verliert nur ${loss} cp (nötig ${BLUNDER_LOSS_CP})` }
      return { ok: true, evalCp: r.cp, depth: r.depth }
    },
  }

  const failures: string[] = []
  const claims: Claim[] = []
  for (const c of e.claims) {
    if (!applyUci(new Chess(fen), c.uci) && c.kind !== 'threat') {
      failures.push(`${c.kind} ${c.uci}: illegal`)
      claims.push(c)
      continue
    }
    const r = await checks[c.kind](c)
    if (r.ok) claims.push({ ...c, verified: { evalCp: r.evalCp, depth: r.depth } })
    else {
      failures.push(`${c.kind} ${c.uci}: ${r.why}`)
      claims.push(c)
    }
  }
  if (failures.length > 0) throw new ClaimCheckError(e.id, failures)
  return { ...e, claims, status: 'engine-geprüft' }
}
