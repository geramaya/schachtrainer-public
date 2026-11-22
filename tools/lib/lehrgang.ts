import { Chess } from 'chess.js'
import type { ExplorerMove } from './explorer.ts'

/**
 * Tiers (owner decision 22.11.): Kern = the 6 most frequent varieties of the Lehrgang (a course of a manageable size, whatever
 * their cumulative share); Erweiterung = the following ones until the cumulative share (Kern included) reaches 95 %; the rest is Nachschlagen.
 * Constants, not settings: changing them changes every tier, so it is a content decision.
 */
export const KERN_COUNT = 6
export const ERWEITERUNG_CUM = 0.95
/** A path is dropped when its probability (product of the reply shares) falls below this: keeps the number of varieties writable. */
export const MIN_PATH = 0.02
/** Plies from the start position (10 moves): the course teaches 8-12 moves deep. */
export const MAX_PLY = 20
/** Fewer games than this at a position: the shares are noise, the line ends there. */
export const MIN_GAMES = 30

export type Stufe = 'kern' | 'erweiterung' | 'nachschlagen'
export type Grund = 'tiefe' | 'luecke' | 'wenig-partien' | 'selten'

export function einstufen<T extends { anteil: number }>(items: T[]): (T & { stufe: Stufe; kumuliert: number })[] {
  const sorted = [...items].sort((a, b) => b.anteil - a.anteil)
  let before = 0
  return sorted.map((v, i) => {
    const stufe: Stufe = i < KERN_COUNT ? 'kern' : before < ERWEITERUNG_CUM ? 'erweiterung' : 'nachschlagen'
    const out = { ...v, stufe, kumuliert: before + v.anteil }
    before += v.anteil
    return out
  })
}

export interface WalkOptions {
  entry: string[]
  side: 'white' | 'black'
  maxPly: number
  minPath: number
  minGames: number
  /** The own move (UCI) of the repertoire at this position, or null if the repertoire has none (a gap). */
  ownMove: (fen: string) => string | null
  /** Opponent replies by frequency; null = the explorer failed (the walk stops, nothing half-finished is written). */
  replies: (fen: string) => Promise<ExplorerMove[] | null>
}
export interface DatenKnoten { san: string; uci: string; eigen: boolean; spiele?: number; anteil?: number; kinder: DatenKnoten[] }
export interface RohVariante { line: string[]; anteil: number; grund: Grund }
export interface WalkResult { baum: DatenKnoten[]; varianten: RohVariante[] }

const turnSide = (c: Chess): 'white' | 'black' => (c.turn() === 'w' ? 'white' : 'black')

export async function walkLehrgang(o: WalkOptions): Promise<WalkResult> {
  const start = new Chess()
  for (const san of o.entry) start.move(san)
  const varianten: RohVariante[] = []

  async function rec(c: Chess, line: string[], p: number, into: DatenKnoten[]): Promise<void> {
    const leaf = (grund: Grund) => { varianten.push({ line, anteil: p, grund }) }
    if (line.length >= o.maxPly) return leaf('tiefe')
    if (turnSide(c) === o.side) {
      const u = o.ownMove(c.fen())
      if (u === null) return leaf('luecke')
      const next = new Chess(c.fen())
      const m = next.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] })
      const node: DatenKnoten = { san: m.san, uci: u, eigen: true, kinder: [] }
      into.push(node)
      return rec(next, [...line, m.san], p, node.kinder)
    }
    const moves = await o.replies(c.fen())
    if (moves === null) throw new Error(`Explorer ohne Antwort bei ${c.fen()} (Cache bleibt erhalten, Kommando wiederholen)`)
    const total = moves.reduce((n, m) => n + m.games, 0)
    if (total < o.minGames) return leaf('wenig-partien')
    const kept = [...moves].sort((a, b) => b.games - a.games).filter((m) => (p * m.games) / total >= o.minPath)
    if (kept.length === 0) return leaf('selten')
    for (const m of kept) {
      const next = new Chess(c.fen())
      const mv = next.move({ from: m.uci.slice(0, 2), to: m.uci.slice(2, 4), promotion: m.uci[4] })
      const node: DatenKnoten = { san: mv.san, uci: m.uci, eigen: false, spiele: m.games, anteil: m.games / total, kinder: [] }
      into.push(node)
      await rec(next, [...line, mv.san], (p * m.games) / total, node.kinder)
    }
  }

  const baum: DatenKnoten[] = []
  await rec(start, [...o.entry], 1, baum)
  return { baum, varianten }
}
