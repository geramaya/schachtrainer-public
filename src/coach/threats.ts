import { Chess } from 'chess.js'
import type { Engine } from '../engine/service.ts'
import { scoreCp } from '../train/review.ts'
import { VALUE } from './texts.ts'
import type { PieceType } from './texts.ts'

export interface Threat { uci: string; gainCp: number; mateIn?: number }

/** A null move counts as a threat when the opponent would gain at least this much (below that it is a positional difference, not a threat). */
export const THREAT_MIN_CP = 150
const MAX_THREATS = 2

/** Material won by the side to move over the first three plies of a line (own, reply, own), in centipawns; stops at an illegal move. */
function materialOverPv(fen: string, pv: string[]): number {
  const chess = new Chess(fen)
  let net = 0
  for (let i = 0; i < Math.min(3, pv.length); i++) {
    let m
    try { m = chess.move({ from: pv[i]!.slice(0, 2), to: pv[i]!.slice(2, 4), promotion: pv[i]![4] }) } catch { break }
    if (m.captured) net += (i % 2 === 0 ? 1 : -1) * VALUE[m.captured as PieceType] * 100
  }
  return net
}

/** A real threat captures, gives check, mates, or its line wins at least THREAT_MIN_CP of material at once; quiet defences never qualify. */
function isThreat(nullFen: string, l: { uci: string; mate: number | null; pv: string[] }): boolean {
  if (l.mate !== null && l.mate > 0) return true
  const probe = new Chess(nullFen)
  let m
  try { m = probe.move({ from: l.uci.slice(0, 2), to: l.uci.slice(2, 4), promotion: l.uci[4] }) } catch { return false }
  return !!m.captured || probe.inCheck() || materialOverPv(nullFen, l.pv) >= THREAT_MIN_CP
}

/** FEN with the other side to move and no en passant square; null if the side to move is in check or the result has no legal move. */
export function nullMoveFen(fen: string): string | null {
  const chess = new Chess(fen)
  if (chess.inCheck()) return null
  const f = fen.split(' ')
  f[1] = f[1] === 'w' ? 'b' : 'w'
  f[3] = '-'
  const nullFen = f.join(' ')
  return new Chess(nullFen).moves().length === 0 || chess.moves().length === 0 ? null : nullFen
}

/**
 * What the opponent would do if the side to move passed: the engine's best replies on the passed position
 * whose score beats the opponent's baseline (the real position seen from the opponent) by THREAT_MIN_CP.
 */
export async function threatsByNullMove(fen: string, engine: Engine, depth: number): Promise<Threat[]> {
  const nullFen = nullMoveFen(fen)
  if (!nullFen) return []
  const base = await engine.analyse(fen, { depth })
  const baselineForOpponent = -scoreCp(base.lines[0]!)
  const after = await engine.analyse(nullFen, { depth, multipv: 3 })
  const seen = new Set<string>()
  const out: Threat[] = []
  for (const l of after.lines) {
    const gainCp = scoreCp(l) - baselineForOpponent
    const target = l.uci.slice(2, 4)
    if (gainCp < THREAT_MIN_CP || seen.has(target) || !isThreat(nullFen, l)) continue
    seen.add(target)
    out.push({ uci: l.uci, gainCp, ...(l.mate !== null && l.mate > 0 ? { mateIn: l.mate } : {}) })
  }
  return out.slice(0, MAX_THREATS)
}
