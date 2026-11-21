import type { AnalysisLine, Engine } from '../engine/service.ts'
import { applyUci } from '../chess/game.ts'
import { gameStatus } from '../chess/status.ts'
import type { MoveEvals } from './judge.ts'

/**
 * Engine input for the teacher: the two best lines before the move (MultiPV 2), and the line of the played move.
 * A played move that is among them costs no further search; any other is searched from the position after it
 * (score and mate flipped back to the mover, pv starting with the move). Finished games are never sent to the engine.
 */
export async function evaluateMove(engine: Engine, fenBefore: string, uci: string, depth: number): Promise<MoveEvals> {
  const before = await engine.analyse(fenBefore, { depth, multipv: 2 })
  const best = before.lines[0]!
  const known = before.lines.find((l) => l.uci === uci)
  if (known) return { best, played: known }
  const next = applyUci(fenBefore, uci)
  if (!next) throw new Error(`illegal move ${uci}`)
  const end = gameStatus(next.fen, [])
  if (end.over) return { best, played: { uci, cp: end.winner === null ? 0 : null, mate: end.winner === null ? null : 1, pv: [uci] } }
  const a = (await engine.analyse(next.fen, { depth })).lines[0]!
  const flip = (n: number | null) => (n === null ? null : -n)
  return { best, played: { uci, cp: flip(a.cp), mate: flip(a.mate), pv: [uci, ...a.pv] } }
}
