import { Chess } from 'chess.js'
import { positionKey } from '../../src/chess/position.ts'

/** Key of a sentence in stellungen.json: the position before the move (FEN without move counters) and the move in English SAN. */
export const stellungsSchluessel = (fenBefore: string, san: string): string => `${positionKey(fenBefore)}|${san}`

export interface Stellung {
  schluessel: string
  fenVorher: string
  san: string
  /** Moves up to and including this one. */
  line: string[]
  ply: number
  zieher: 'white' | 'black'
  eigen: boolean
  varianten: string[]
  /** Sum of the shares of the varieties that contain the move. */
  anteil: number
  /** Some variety got this move from the depth extension (a new sentence is needed). */
  neu?: boolean
}

/** Every position+move of the varieties once: this is the unit a sentence is written for (owner decision: texts per position, not per variety). */
export function eindeutigeStellungen(varianten: { id: string; anteil: number | null; zuege: { san: string; neu?: true }[] }[], side: 'white' | 'black'): Stellung[] {
  const out = new Map<string, Stellung>()
  for (const v of varianten) {
    const g = new Chess()
    v.zuege.forEach((z, ply) => {
      const fenVorher = g.fen()
      const schluessel = stellungsSchluessel(fenVorher, z.san)
      g.move(z.san)
      const hit = out.get(schluessel)
      if (hit) { hit.varianten.push(v.id); hit.anteil += v.anteil ?? 0; if (z.neu) hit.neu = true; return }
      const zieher = ply % 2 === 0 ? 'white' : 'black'
      out.set(schluessel, { schluessel, fenVorher, san: z.san, line: v.zuege.slice(0, ply + 1).map((x) => x.san), ply, zieher, eigen: zieher === side, varianten: [v.id], anteil: v.anteil ?? 0, ...(z.neu ? { neu: true } : {}) })
    })
  }
  return [...out.values()]
}

/** Keys of the last move of every data line that ends in a gap (the repertoire has no own answer there). */
export function lueckenSchluessel(daten: { line: string[]; grund: string }[]): Set<string> {
  const out = new Set<string>()
  for (const d of daten) {
    if (d.grund !== 'luecke') continue
    const g = new Chess()
    d.line.slice(0, -1).forEach((s) => g.move(s))
    out.add(stellungsSchluessel(g.fen(), d.line.at(-1)!))
  }
  return out
}
