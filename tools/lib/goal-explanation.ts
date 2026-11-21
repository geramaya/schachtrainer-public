import { Chess } from 'chess.js'
import type { Color } from 'chess.js'
import type { Explanation, Variation } from '../../src/content/types.ts'

const NAME: Record<Color, string> = { w: 'Weiß', b: 'Schwarz' }
const HOME: Record<Color, Record<string, string[]>> = {
  w: { n: ['b1', 'g1'], b: ['c1', 'f1'] },
  b: { n: ['b8', 'g8'], b: ['c8', 'f8'] },
}

function stats(g: Chess, color: Color) {
  let pawns = 0
  let developed = 0
  for (const row of g.board()) for (const sq of row) {
    if (!sq || sq.color !== color) continue
    if (sq.type === 'p') pawns++
    if ((sq.type === 'n' || sq.type === 'b') && !HOME[color][sq.type]!.includes(sq.square)) developed++
  }
  const king = g.findPiece({ type: 'k', color })[0]
  const castled = king === (color === 'w' ? 'g1' : 'g8') || king === (color === 'w' ? 'c1' : 'c8')
  return { pawns, developed, castled }
}

function fileState(g: Chess): { open: string[]; half: Record<Color, string[]> } {
  const open: string[] = []
  const half: Record<Color, string[]> = { w: [], b: [] }
  for (const f of 'abcdefgh') {
    const has: Record<Color, boolean> = { w: false, b: false }
    for (let r = 1; r <= 8; r++) {
      const p = g.get(`${f}${r}` as never)
      if (p?.type === 'p') has[p.color] = true
    }
    if (!has.w && !has.b) open.push(f)
    else if (!has.w) half.w.push(f)
    else if (!has.b) half.b.push(f)
  }
  return { open, half }
}

/** Facts read from the position only (no move claims). German, for the "Worum es jetzt geht" explanation. */
export function goalText(fen: string): string {
  const g = new Chess(fen)
  const w = stats(g, 'w')
  const b = stats(g, 'b')
  const files = fileState(g)
  const parts = [
    `${NAME.w} hat ${w.pawns} Bauern, ${NAME.b} ${b.pawns}.`,
    `${NAME.w} hat ${w.developed} Leichtfiguren entwickelt, ${NAME.b} ${b.developed}.`,
    `${NAME.w} ${w.castled ? 'hat rochiert' : 'hat noch nicht rochiert'}, ${NAME.b} ${b.castled ? 'hat rochiert' : 'hat noch nicht rochiert'}.`,
  ]
  const lines: string[] = []
  if (files.open.length) lines.push(`offen: ${files.open.join(', ')}`)
  for (const c of ['w', 'b'] as Color[]) if (files.half[c].length) lines.push(`halboffen für ${NAME[c]}: ${files.half[c].join(', ')}`)
  if (lines.length) parts.push(`Linien: ${lines.join('; ')}.`)
  parts.push('Pläne: die restlichen Figuren entwickeln, den König sichern, offene und halboffene Linien mit den Türmen besetzen.')
  return parts.join(' ')
}

/** One "Worum es jetzt geht" explanation per variation end (the target position), unless that position is explained already. */
export function goalExplanations(opening: string, variations: Variation[], explainedKeys: Set<string>): Explanation[] {
  const seen = new Set(explainedKeys)
  const out: Explanation[] = []
  for (const v of variations) {
    const key = v.keyPositions[v.keyPositions.length - 1]!
    if (seen.has(key)) continue
    seen.add(key)
    const g = new Chess()
    for (const san of v.line) g.move(san)
    out.push({
      id: `${opening}/${v.id}/goal`, key, title: 'Worum es jetzt geht', text: goalText(g.fen()), arrows: [], claims: [],
      status: 'entwurf', source: { kind: 'autor', ref: 'aus der Zielstellung der Variante abgelesen (Zählung, keine Wertung)' },
    })
  }
  return out
}
