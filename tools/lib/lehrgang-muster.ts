import { Chess } from 'chess.js'
import { stellungsSchluessel } from './lehrgang-stellungen.ts'
import type { Stellung } from './lehrgang-stellungen.ts'

/** SAN moves of a PGN movetext: comments, variations, NAGs, headers, move numbers and the result are dropped. Legality is not checked here. */
export function parsePgnZuege(pgn: string): string[] {
  let t = pgn.replace(/\[[^\]]*\]/g, ' ').replace(/\{[^}]*\}/g, ' ').replace(/;[^\n]*/g, ' ')
  for (let prev = ''; prev !== t;) { prev = t; t = t.replace(/\([^()]*\)/g, ' ') }
  return t.replace(/\$\d+/g, ' ').replace(/\d+\s*\.(?:\s*\.\.)?/g, ' ').split(/\s+/).filter((x) => x && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(x))
}

/** Key (position before the move, move) of the move played at `ply` (1 = first move); null when the game is shorter or illegal there. */
export function musterSchluessel(pgn: string, ply: number): string | null {
  const g = new Chess()
  const sans = parsePgnZuege(pgn)
  if (ply < 1 || ply > sans.length) return null
  try {
    sans.slice(0, ply - 1).forEach((s) => g.move(s))
    const before = g.fen()
    return stellungsSchluessel(before, g.move(sans[ply - 1]!).san)
  } catch { return null }
}

/** The position+move of every commented ply of the games: what a fact sheet is made for (same unit as the sentences per position). */
export function musterStellungen(muster: { id: string; pgn: string; kommentare: { ply: number }[] }[], side: 'white' | 'black'): Stellung[] {
  const out: Stellung[] = []
  for (const m of muster) {
    const sans = parsePgnZuege(m.pgn)
    for (const ply of [...new Set(m.kommentare.map((k) => k.ply))].sort((a, b) => a - b)) {
      const g = new Chess()
      try { sans.slice(0, ply - 1).forEach((s) => g.move(s)) } catch { continue }
      const fenVorher = g.fen()
      let san: string
      try { san = g.move(sans[ply - 1] ?? '').san } catch { continue }
      const zieher = (ply - 1) % 2 === 0 ? 'white' : 'black'
      out.push({ schluessel: stellungsSchluessel(fenVorher, san), fenVorher, san, line: [...sans.slice(0, ply - 1), san], ply: ply - 1, zieher, eigen: zieher === side, varianten: [m.id], anteil: 0 })
    }
  }
  return out
}
