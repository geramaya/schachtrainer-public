import { Chess } from 'chess.js'
import type { ExplorerMove } from './explorer.ts'
import { TODO } from '../../src/lehrgang/types.ts'
import type { VarianteSrc } from './lehrgang-build.ts'

/** Where a move of a line comes from: the explorer data, the own repertoire tree, or the engine (Stockfish best move). */
export type Herkunft = 'daten' | 'repertoire' | 'engine'
export interface ZugErweiterung { san: string; uci: string; herkunft: Herkunft }
export interface TiefeOptions {
  line: string[]
  side: 'white' | 'black'
  /** Length of the line in plies at which the extension stops. */
  zielPly: number
  /** Cached explorer replies with fewer games than this do not count (the share is noise): the engine decides. */
  minPartien: number
  /** Own move (UCI) of the repertoire, null = the repertoire ends here. */
  ownMove: (fen: string) => string | null
  /** Explorer replies from the cache only (never a network call), null = position not cached. */
  explorer: (fen: string) => ExplorerMove[] | null
  engineBest: (fen: string) => Promise<string | null>
  /** Own move when the repertoire ends (the engine best move): marked `engine`; without it the line stops there. */
  ownFallback?: (fen: string) => Promise<string | null>
}

/** Continues a line beyond the data limit: own moves from the repertoire, opponent = most frequent explorer move (enough games), else the engine; stops at the target ply, at the end of the repertoire or when no legal move is found. */
export async function verlaengereLinie(o: TiefeOptions): Promise<ZugErweiterung[]> {
  const g = new Chess()
  for (const san of o.line) g.move(san)
  const out: ZugErweiterung[] = []
  while (o.line.length + out.length < o.zielPly && !g.isGameOver()) {
    const own = (g.turn() === 'w') === (o.side === 'white')
    let uci: string | null
    let herkunft: Herkunft
    if (own) {
      uci = o.ownMove(g.fen())
      herkunft = 'repertoire'
      if (uci === null && o.ownFallback) { uci = await o.ownFallback(g.fen()); herkunft = 'engine' }
    } else {
      const moves = o.explorer(g.fen())
      const total = moves?.reduce((n, m) => n + m.games, 0) ?? 0
      if (moves && total >= o.minPartien) {
        uci = [...moves].sort((a, b) => b.games - a.games)[0]!.uci
        herkunft = 'daten'
      } else {
        uci = await o.engineBest(g.fen())
        herkunft = 'engine'
      }
    }
    if (uci === null) break
    try {
      const m = g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
      out.push({ san: m.san, uci, herkunft })
    } catch { break }
  }
  return out
}

/** Adds the origin to every move that has none (own = repertoire, opponent = daten), appends the extension as new moves with a placeholder sentence, and gives a Kern variety its 3 goal placeholders. Idempotent. */
export function erweitereVariante(v: VarianteSrc, ext: ZugErweiterung[], side: 'white' | 'black'): VarianteSrc {
  const zuege = v.zuege.map((z, i) => (z.herkunft ? z : { ...z, herkunft: ((i % 2 === 0) === (side === 'white') ? 'repertoire' : 'daten') as Herkunft }))
  for (const e of ext) zuege.push({ san: e.san, satz: TODO, herkunft: e.herkunft, neu: true })
  return { ...v, zuege, ...(v.stufe === 'kern' && !v.ziel ? { ziel: [{ satz: TODO }, { satz: TODO }, { satz: TODO }] } : {}) }
}
