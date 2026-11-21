import { Chess } from 'chess.js'
import { toGermanSan } from '../chess/notation.ts'
import type { GameStatus } from '../chess/status.ts'
import { pieceName, the } from '../coach/texts.ts'
import type { PieceType } from '../coach/texts.ts'
import type { Rating } from './judge.ts'
import type { RepertoireNote } from './repertoire.ts'
import type { QuipCategory, QuipFacts } from './quips.ts'

/** True if the piece on `to` (just moved, colour `by`) attacks the enemy king. */
function givesCheckItself(c: Chess, by: 'w' | 'b', to: string): boolean {
  const king = c.board().flat().find((p) => p?.type === 'k' && p.color !== by)
  return !!king && c.attackers(king.square, by).includes(to as never)
}

/** Facts for the placeholders, taken from the move on the real position; empty if the move is not legal. */
export function moveFacts(fenBefore: string, uci: string): QuipFacts {
  try {
    const c = new Chess(fenBefore)
    const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
    const t = m.piece as PieceType
    if (c.inCheck() && !givesCheckItself(c, m.color, m.to)) return { zug: toGermanSan(m.san) } // discovered check: the moved piece is not the checker
    return { zug: toGermanSan(m.san), figur: pieceName(t), figur_akk: the(t, true) }
  } catch {
    return {}
  }
}

export interface MoveContext {
  /** the player moved (otherwise the engine) */
  mine: boolean
  check: boolean
  status: GameStatus
  rating: Rating | null
  note: RepertoireNote | null
}

/** Categories for one half-move in priority order; the first one with a quip is spoken. */
export function quipCategories(c: MoveContext): QuipCategory[] {
  if (c.status.over) return c.status.winner === null ? ['patt_remis'] : [c.mine ? 'matt_gesetzt' : 'matt_bekommen']
  if (!c.mine) return c.note?.kind === 'gegner' ? ['gegner_verlaesst_theorie'] : []
  const out: QuipCategory[] = []
  if (c.rating === 'patzer' || c.rating === 'fehler') out.push(c.rating)
  if (c.check) out.push('schach_gegeben')
  if (c.rating === 'ungenau') out.push('ungenau')
  if (c.rating === 'best') out.push('bester_zug')
  if (c.note?.kind === 'abweichung') out.push('repertoire_abweichung')
  if (c.note?.kind === 'treffer') out.push('repertoire_treffer')
  if (c.rating === 'gut' || c.rating === 'excellent') out.push('gut')
  return out
}
