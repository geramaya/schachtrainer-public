import { Chess } from 'chess.js'
import type { Puzzle } from '../../src/content/types.ts'
import { SYSTEM_IDEE_IDS, SYSTEM_IDEE_TITEL, TODO } from '../../src/lehrgang/types.ts'
import type { Herkunft } from '../../src/lehrgang/types.ts'
import type { ExplorerMove } from './explorer.ts'
import { verlaengereLinie } from './lehrgang-tiefe.ts'
import type { TiefeOptions } from './lehrgang-tiefe.ts'
import type { KandidatSrc, MotivSrc, RaetselSrc, SystemSrc, SystemZugSrc } from './lehrgang-system.ts'

export const RATING_MIN = 1200
export const RATING_MAX = 1600
const GENERISCH = new Set(['short', 'long', 'veryLong', 'oneMove', 'opening', 'middlegame', 'endgame', 'advantage', 'crushing', 'equality', 'master', 'masterVsMaster', 'superGM'])
const popularity = (p: Puzzle) => (p.popularity ?? 0) * 1e9 + (p.nbPlays ?? 0)
/** The motif of a puzzle: its first theme that says what happens (not length or phase). */
const motivThema = (themes: string[]) => themes.find((t) => !GENERISCH.has(t)) ?? 'sonstige'

export const kandidatAusPuzzle = (p: Puzzle): KandidatSrc => ({ puzzleId: p.id, fen: p.fen, moves: p.moves, rating: p.rating, themes: p.themes, url: `https://lichess.org/training/${p.id}` })

/** `n` candidates of rating 1200 to 1600, most popular first, taken round-robin over the motif themes so that the offer is varied. */
export function waehleKandidaten(puzzles: Puzzle[], n: number): KandidatSrc[] {
  const gruppen = new Map<string, Puzzle[]>()
  for (const p of [...puzzles].filter((x) => x.rating >= RATING_MIN && x.rating <= RATING_MAX).sort((a, b) => popularity(b) - popularity(a))) {
    const t = motivThema(p.themes)
    gruppen.set(t, [...(gruppen.get(t) ?? []), p])
  }
  const out: Puzzle[] = []
  for (let runde = 0; out.length < n; runde++) {
    const dran = [...gruppen.values()].filter((g) => g[runde])
    if (!dran.length) break
    for (const g of dran) if (out.length < n) out.push(g[runde]!)
  }
  return out.map(kandidatAusPuzzle)
}

/** A candidate as puzzle: the first move belongs to the opponent and is played, the rest is the solution (UCI). */
function raetselAusKandidat(k: KandidatSrc, nr: number): RaetselSrc {
  const g = new Chess(k.fen)
  g.move({ from: k.moves[0]!.slice(0, 2), to: k.moves[0]!.slice(2, 4), promotion: k.moves[0]![4] })
  return { id: `r${nr}`, fen: g.fen(), loesung: k.moves.slice(1), hinweis: TODO, satz: TODO, platzhalter: true, puzzleId: k.puzzleId, rating: k.rating, themes: k.themes, url: k.url }
}

const MOTIVE_MAX = 4
function motive(kandidaten: KandidatSrc[]): MotivSrc[] {
  const gruppen = new Map<string, KandidatSrc[]>()
  for (const k of kandidaten) gruppen.set(motivThema(k.themes), [...(gruppen.get(motivThema(k.themes)) ?? []), k])
  let nr = 0
  return [...gruppen.values()].sort((a, b) => b.length - a.length).slice(0, MOTIVE_MAX).map((g, i) => {
    const raetsel = g.slice(0, 2).map((k) => raetselAusKandidat(k, ++nr))
    return { id: `m${i + 1}`, titel: TODO, satz: TODO, fen: raetsel[0]!.fen, raetsel }
  })
}

const pgnOf = (sans: string[]) => sans.map((s, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${s}` : s)).join(' ')

export interface GeruestOptionen extends Pick<TiefeOptions, 'side' | 'zielPly' | 'minPartien' | 'ownMove' | 'engineBest'> {
  id: string
  /** Name of the system (given by the owner); a placeholder when absent. */
  titel?: string
  /** The moves that define the system. */
  zuege: string[]
  anzahlAeste: number
  explorer: (fen: string) => ExplorerMove[] | null
  kandidaten: KandidatSrc[]
  /** Other lines (e.g. existing varieties of the Lehrgang) used as stand-ins for model games besides the main line. */
  musterQuellen: string[][]
}

/** Scaffold of a system with placeholders: main line (own moves repertoire, else engine; opponent = most frequent cached move, else engine), the most frequent opponent deviations as branches, puzzle placeholders from the candidates, stand-in model games. Authors write the texts. */
export async function baueGeruest(o: GeruestOptionen): Promise<SystemSrc> {
  const tiefe = (line: string[], zielPly: number) => verlaengereLinie({ line, side: o.side, zielPly, minPartien: o.minPartien, ownMove: o.ownMove, explorer: o.explorer, engineBest: o.engineBest, ownFallback: o.engineBest })
  const eigen = (ply: number) => (ply % 2 === 0) === (o.side === 'white')
  const zug = (san: string, herkunft: Herkunft): SystemZugSrc => ({ san, satz: TODO, herkunft })
  const ext = await tiefe(o.zuege, o.zielPly)
  const hauptSans = [...o.zuege, ...ext.map((e) => e.san)]
  const haupt = [...o.zuege.map((s, i) => zug(s, eigen(i) ? 'repertoire' : 'daten')), ...ext.map((e) => zug(e.san, e.herkunft))]

  const abweichungen: { ab: number; san: string; uci: string; games: number; total: number }[] = []
  for (let ab = o.zuege.length; ab < hauptSans.length; ab++) {
    if (eigen(ab)) continue
    const g = new Chess()
    hauptSans.slice(0, ab).forEach((s) => g.move(s))
    const listed = o.explorer(g.fen()) ?? []
    const total = listed.reduce((n, m) => n + m.games, 0)
    const hauptUci = new Chess(g.fen()).move(hauptSans[ab]!)
    for (const m of listed) {
      if (m.games < o.minPartien || m.uci === hauptUci.from + hauptUci.to + (hauptUci.promotion ?? '')) continue
      const san = new Chess(g.fen()).move({ from: m.uci.slice(0, 2), to: m.uci.slice(2, 4), promotion: m.uci[4] }).san
      abweichungen.push({ ab, san, uci: m.uci, games: m.games, total })
    }
  }
  const aeste = await Promise.all(abweichungen.sort((a, b) => b.games - a.games).slice(0, o.anzahlAeste).map(async (d, i) => {
    const fortsetzung = await tiefe([...hauptSans.slice(0, d.ab), d.san], d.ab + 4)
    return { id: `ast${i + 1}`, ab: d.ab, satz: TODO, anteil: d.games / d.total, zuege: [zug(d.san, 'daten'), ...fortsetzung.map((e) => zug(e.san, e.herkunft))] }
  }))

  const bis = (n: number) => hauptSans.slice(0, Math.min(n, hauptSans.length))
  const stellung: Record<string, string[]> = { struktur: o.zuege, figuren: bis(o.zuege.length + 4), 'plan-schwarz': bis(o.zuege.length + 6), 'plan-weiss': bis(o.zuege.length + 6), achten: o.zuege }
  const quellen = [hauptSans, ...o.musterQuellen].slice(0, 3)
  if (quellen.length < 2) quellen.push(hauptSans.slice(0, Math.max(14, o.zuege.length + 2)))
  return {
    id: o.id, titel: o.titel ?? TODO, zuege: o.zuege,
    idee: SYSTEM_IDEE_IDS.map((id) => ({ id, titel: SYSTEM_IDEE_TITEL[id], satz: TODO, zuege: stellung[id] })),
    hauptlinie: { zuege: haupt, aeste },
    motive: motive(o.kandidaten),
    musterpartien: quellen.map((sans, i) => ({ id: `muster-${i + 1}`, titel: TODO, weiss: TODO, schwarz: TODO, jahr: TODO, event: TODO, quelle: TODO, platzhalter: true as const, pgn: pgnOf(sans), kommentare: [o.zuege.length, Math.floor(sans.length / 2), sans.length].map((ply) => ({ ply, satz: TODO })).filter((k, j, all) => all.findIndex((x) => x.ply === k.ply) === j && k.ply <= sans.length) })),
    kandidaten: o.kandidaten,
  }
}
