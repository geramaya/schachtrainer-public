import type { Side } from '../content/types.ts'
import type { AnalysisLine } from '../engine/service.ts'
import { applyUci } from '../chess/game.ts'
import { units } from '../teacher/blocks.ts'
import { formatLine, toGermanSan } from '../chess/notation.ts'
import { gameFens, scoreCp } from '../train/review.ts'
import { judgeMove } from '../teacher/judge.ts'
import type { RepertoireNote } from '../teacher/repertoire.ts'
import { moverAt } from './build.ts'
import type { GameAnalysis, PositionLines } from './build.ts'
import { ep } from './category.ts'
import { settleMaterial } from './nag.ts'
import type { Ev } from './nag.ts'

/** Half-move number of a position (0 = white to move in move 1). */
const plyOfFen = (fen: string): number => { const f = fen.split(' '); return (Number(f[5]) - 1) * 2 + (f[1] === 'b' ? 1 : 0) }
const pov = (cp: number, side: Side): number => (side === 'white' ? cp : -cp)
const povMate = (m: number | null, side: Side): number | null => (m === null ? null : side === 'white' ? m : -m)
const pawns = (cp: number): string => (Math.abs(cp) / 100).toFixed(1).replace('.', ',')

/** The line as German notation with move numbers, at most `max` half-moves. */
function lineText(fen: string, pv: string[], max = 6): string {
  const sans: string[] = []
  let cur = fen
  for (const u of pv.slice(0, max)) {
    const r = applyUci(cur, u)
    if (!r) break
    sans.push(r.san)
    cur = r.fen
  }
  return formatLine(sans, plyOfFen(fen))
}

/** An engine line from the mover's view, as the teacher's judgeMove expects it. */
function lineFor(uci: string, ev: Ev, pv: string[], mover: Side): AnalysisLine {
  const mate = povMate(ev.mate, mover)
  return { uci, cp: mate === null ? pov(ev.cp, mover) : null, mate, pv }
}

/** The line of the played move: the best or second line if it was one of them, otherwise derived from the position after the move. */
function playedLine(a: GameAnalysis, ply: number, uci: string, mover: Side, l: PositionLines): AnalysisLine | null {
  if (uci === l.best.uci) return lineFor(uci, a.positions[ply]!, l.best.pv, mover)
  if (l.second && uci === l.second.uci) return lineFor(uci, l.second.ev, l.second.pv, mover)
  const after = a.positions[ply + 1]
  if (!after) return null
  return lineFor(uci, after, [uci, ...(a.lines[ply + 1]?.best.pv ?? [])], mover)
}

/**
 * The automatic comment on a move; null if there is nothing proven to say.
 * After the game the better move may be named. Every statement comes from the engine lines or the position (teacher blocks and facts).
 */
export function moveComment(a: GameAnalysis, startFen: string, ucis: string[], ply: number, o: { repertoire?: RepertoireNote | null } = {}): string | null {
  const fens = gameFens(startFen, ucis)
  const fenBefore = fens[ply]
  const uci = ucis[ply]
  const m = a.moves[ply]
  if (!fenBefore || !uci || !m) return null
  const mover = moverAt(startFen, ply)
  const l = a.lines[ply]
  const before = a.positions[ply]
  const parts: string[] = []

  const loss = m.cat === 'inaccuracy' || m.cat === 'mistake' || m.cat === 'blunder' || m.cat === 'miss'
  if (l && before && loss) {
    const played = playedLine(a, ply, uci, mover, l)
    if (m.cat === 'miss') parts.push('Verpasst: Der Gegner hatte zuvor gepatzt, hier stand es für dich auf Gewinn.')
    if (played) {
      const j = judgeMove(fenBefore, uci, { best: lineFor(l.best.uci, before, l.best.pv, mover), played })
      if (j.rating === 'ungenau' || j.rating === 'fehler' || j.rating === 'patzer') parts.push(j.text)
      parts.push(j.reveal)
      parts.push(`Engine-Linie: ${lineText(fenBefore, l.best.pv)}.`)
    }
  } else if (l && before && (m.cat === 'great' || m.cat === 'brilliant')) {
    const line = uci === l.best.uci ? l.best.pv : l.second?.pv ?? l.best.pv
    const settled = settleMaterial(fenBefore, line, mover)
    if (l.second) {
      const secondSan = applyUci(fenBefore, l.second.uci)?.san
      const gap = pov(before.cp, mover) - pov(l.second.ev.cp, mover)
      const second2 = povMate(l.second.ev.mate, mover)
      const only = ep(before, mover) - ep(l.second.ev, mover) > 0.10
      const lead = only ? 'Einziger Zug' : 'Entscheidender Zug'
      if (secondSan && second2 !== null && second2 < 0) parts.push(`${lead}: ${toGermanSan(secondSan)} ließe Matt in ${Math.abs(second2)} zu.`)
      else if (secondSan && (only || m.cat === 'great')) parts.push(`${lead}: ${toGermanSan(secondSan)} wäre ${pawns(gap)} Bauerneinheiten schlechter.`)
    }
    if (m.cat === 'brilliant' && settled && settled.delta < 0) parts.push(`Er gibt Material: nach ${lineText(fenBefore, line, settled.plies)} steht die Materialbilanz ${units(Math.abs(settled.delta))} schlechter, die Engine hält die Stellung trotzdem.`)
  } else if (m.cat === 'book' && !o.repertoire) parts.push('Buchzug.')

  const rep = o.repertoire
  if (rep?.kind === 'treffer') parts.push('Repertoirezug.')
  if (rep?.kind === 'abweichung') parts.push(rep.plannedSan ? `Abweichung vom Repertoire: geplant war ${toGermanSan(rep.plannedSan)}.` : 'Abweichung vom Repertoire.')
  return parts.length ? parts.join(' ') : null
}
