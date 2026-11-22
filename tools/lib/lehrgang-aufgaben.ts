import { Chess } from 'chess.js'
import type { Square } from 'chess.js'
import { toGermanSan } from '../../src/chess/notation.ts'
import { features } from '../../src/coach/features.ts'
import type { Opening, Variation } from '../../src/content/types.ts'
import { frequencyText } from '../../src/lehrgang/frequency.ts'
import type { Analysis } from '../../src/engine/service.ts'
import { EVAL_DEPTH, introFacts } from './intro-facts.ts'
import type { DocLine, IntroFacts } from './intro-facts.ts'
import { normalizeCastling } from './explorer.ts'
import type { ExplorerMove } from './explorer.ts'
import type { DatenKnoten } from './lehrgang.ts'
import { stellungsSchluessel } from './lehrgang-stellungen.ts'
import type { Stellung } from './lehrgang-stellungen.ts'

/** Analysis cache of the Lehrgang run: key `fen|depth|multipv`, centipawns from the point of view of the side to move. */
export type AnalysisStore = Record<string, Analysis>
export const evalKey = (fen: string): string => `${fen}|${EVAL_DEPTH}|1`

const NAME = { p: 'Bauer', n: 'Springer', b: 'Läufer', r: 'Turm', q: 'Dame', k: 'König' } as const
const CENTER: Square[] = ['d4', 'e4', 'd5', 'e5']
const HOME = { w: ['b1', 'g1', 'c1', 'f1'], b: ['b8', 'g8', 'c8', 'f8'] }
const SQUARES = Array.from({ length: 64 }, (_x, i) => `${'abcdefgh'[i % 8]}${8 - Math.floor(i / 8)}` as Square)

export interface ZugFakten {
  entwickeltFigur: { figur: string; von: string; nach: string } | null
  rochiert: boolean
  schlaegt: { figur: string; feld: string } | null
  schach: boolean
  zentrumBesetzt: boolean
  /** Centre squares the moved piece attacks from its new square. */
  zentrumKontrolle: string[]
  greiftAn: { figur: string; feld: string }[]
  deckt: { figur: string; feld: string }[]
  /** Pawn structure of the mover that changed with this move (only pawn moves and captures). */
  bauernstruktur: { neuIsoliert: string[]; neuDoppelt: string[]; neuFreibauern: string[] }
}

/** What the move does, observed on the board (no wording): the sheet an author writes the sentence from. */
export function zugFakten(fenVorher: string, san: string): ZugFakten {
  const g = new Chess(fenVorher)
  const m = g.move(san)
  const color = m.color
  const side = color === 'w' ? 0 : 1
  const hits = (sq: Square) => g.attackers(sq, color).includes(m.to)
  const attacked = SQUARES.filter((sq) => sq !== m.to && g.get(sq) && hits(sq))
  const nameAt = (sq: Square) => ({ figur: NAME[g.get(sq)!.type], feld: sq })
  const before = features(fenVorher)[side]!
  const after = features(g.fen())[side]!
  const neu = (a: string[], b: string[]) => b.filter((x) => !a.includes(x))
  return {
    entwickeltFigur: (m.piece === 'n' || m.piece === 'b') && HOME[color].includes(m.from) ? { figur: NAME[m.piece], von: m.from, nach: m.to } : null,
    rochiert: san.startsWith('O-O'),
    schlaegt: m.captured ? { figur: NAME[m.captured], feld: m.flags.includes('e') ? `${m.to[0]}${m.from[1]}` : m.to } : null,
    schach: g.inCheck(),
    zentrumBesetzt: CENTER.includes(m.to),
    zentrumKontrolle: CENTER.filter((sq) => sq !== m.to && hits(sq)),
    greiftAn: attacked.filter((sq) => g.get(sq)!.color !== color).map(nameAt),
    deckt: attacked.filter((sq) => g.get(sq)!.color === color && g.get(sq)!.type !== 'k').map(nameAt),
    bauernstruktur: m.piece === 'p' || m.captured ? { neuIsoliert: neu(before.isolated, after.isolated), neuDoppelt: neu(before.doubled, after.doubled), neuFreibauern: neu(before.passed, after.passed) } : { neuIsoliert: [], neuDoppelt: [], neuFreibauern: [] },
  }
}

export interface Aufgabe {
  schluessel: string
  /** SAN (English) of the moves up to and including this one. */
  zugfolge: string[]
  zugfolgeText: string
  ply: number
  zieher: 'white' | 'black'
  eigen: boolean
  zug: string
  haeufigkeit: { anteil: number; text: string }
  bewertung: { tiefe: number; vorCpWeiss: number | null; nachCpWeiss: number | null }
  /** After this move the repertoire has no own answer (the line ends in a gap). */
  luecke: boolean
  zugFakten: ZugFakten
  /** Fact sheet of the line up to here (the same structure the intro checker uses). */
  fakten: IntroFacts
  varianten: string[]
  /** From the depth extension: no sentence exists yet. */
  neu: boolean
}

export interface AufgabeContext {
  opening: Pick<Opening, 'id' | 'side' | 'entry' | 'docRef'>
  analysis: AnalysisStore
  explorer: Record<string, ExplorerMove[]>
  dokument: DocLine[]
  /** Keys of the positions after which the repertoire has no own answer. */
  luecken: Set<string>
}

export const cpWeiss = (analysis: AnalysisStore, fen: string): number | null => {
  const l = analysis[evalKey(fen)]?.lines[0]
  return l && l.cp !== null && l.mate === null ? (fen.split(' ')[1] === 'w' ? l.cp : -l.cp) : null
}

export function baueAufgabe(st: Stellung, c: AufgabeContext): Aufgabe {
  const variation = { id: `stellung-${st.ply}`, name: '', nameEn: '', line: st.line, keyPositions: [], fromDocument: false } as Variation
  const after = new Chess(st.fenVorher)
  after.move(st.san)
  return {
    schluessel: st.schluessel,
    zugfolge: st.line,
    zugfolgeText: st.line.map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}. ` : '') + toGermanSan(san)).join(' '),
    ply: st.ply, zieher: st.zieher, eigen: st.eigen, zug: toGermanSan(st.san),
    haeufigkeit: { anteil: st.anteil, text: frequencyText(st.anteil) },
    bewertung: { tiefe: EVAL_DEPTH, vorCpWeiss: cpWeiss(c.analysis, st.fenVorher), nachCpWeiss: cpWeiss(c.analysis, after.fen()) },
    luecke: c.luecken.has(st.schluessel),
    zugFakten: zugFakten(st.fenVorher, st.san),
    fakten: introFacts(c.opening, variation, { analysis: c.analysis, explorer: c.explorer, dokument: c.dokument }),
    varianten: st.varianten,
    neu: st.neu === true,
  }
}

/** Positions the engine has to evaluate: the start and the position after every move. */
export function benoetigteFens(stellungen: Stellung[]): string[] {
  const out = new Set<string>()
  for (const s of stellungen) {
    out.add(s.fenVorher)
    const g = new Chess(s.fenVorher)
    g.move(s.san)
    out.add(g.fen())
  }
  return [...out]
}

export interface FallenKandidat {
  zugfolge: string[]
  zug: string
  /** Share of this reply at its position and of the whole path (product of the opponent shares). */
  anteilImKnoten: number
  pfadAnteil: number
  /** What the engine says the move costs the opponent, in centipawns. */
  verlustCp: number
  fenNachFehler: string
  besterZug: string | null
}
export interface FallenOptionen { mindestAnteil: number; verlustCp: number; max: number }
/** Defaults: a reply of at least 3 % at its position that costs 2 pawns (200 cp) by the engine; 3 candidates per Lehrgang. */
export const FALLEN_DEFAULTS: FallenOptionen = { mindestAnteil: 0.03, verlustCp: 200, max: 3 }

/** Frequent opponent moves that lose material by the engine: candidates for "Falle für dich" (an author writes the trap, the checker verifies the claims). */
export function fallenKandidaten(baum: DatenKnoten[], entry: string[], analysis: AnalysisStore, o: FallenOptionen = FALLEN_DEFAULTS): FallenKandidat[] {
  const out: FallenKandidat[] = []
  const start = new Chess()
  entry.forEach((s) => start.move(s))
  const walk = (nodes: DatenKnoten[], g: Chess, line: string[], pfad: number) => {
    for (const n of nodes) {
      const next = new Chess(g.fen())
      next.move({ from: n.uci.slice(0, 2), to: n.uci.slice(2, 4), promotion: n.uci[4] })
      const l = [...line, n.san]
      if (!n.eigen) {
        const p = pfad * (n.anteil ?? 0)
        const [b, a] = [analysis[evalKey(g.fen())]?.lines[0], analysis[evalKey(next.fen())]?.lines[0]]
        if (b && a && b.cp !== null && a.cp !== null && b.mate === null && a.mate === null && (n.anteil ?? 0) >= o.mindestAnteil && b.cp + a.cp >= o.verlustCp) {
          out.push({ zugfolge: l, zug: toGermanSan(n.san), anteilImKnoten: n.anteil ?? 0, pfadAnteil: p, verlustCp: b.cp + a.cp, fenNachFehler: next.fen(), besterZug: analysis[evalKey(next.fen())]?.bestUci ?? null })
        }
        walk(n.kinder, next, l, p)
      } else walk(n.kinder, next, l, pfad)
    }
  }
  walk(baum, start, [...entry], 1)
  return out.sort((x, y) => y.pfadAnteil - x.pfadAnteil || x.zugfolge.join(' ').localeCompare(y.zugfolge.join(' '))).slice(0, o.max)
}

/** The walk dropped replies below 2 % of the whole path; a trap is often exactly such a rare reply. Adds the explorer replies with at least `minAnteil` at their position as leaves (the input stays untouched). */
export function mitSeltenenZuegen(baum: DatenKnoten[], entry: string[], explorer: Record<string, ExplorerMove[]>, minAnteil: number): DatenKnoten[] {
  const start = new Chess()
  entry.forEach((s) => start.move(s))
  const extend = (nodes: DatenKnoten[], g: Chess): DatenKnoten[] => {
    const opponent = nodes.length > 0 && nodes.every((n) => !n.eigen)
    const out = nodes.map((n) => {
      const next = new Chess(g.fen())
      next.move({ from: n.uci.slice(0, 2), to: n.uci.slice(2, 4), promotion: n.uci[4] })
      return { ...n, kinder: extend(n.kinder, next) }
    })
    if (!opponent) return out
    const listed = explorer[g.fen()] ?? []
    const total = listed.reduce((n, m) => n + m.games, 0)
    for (const m of listed) {
      const uci = normalizeCastling(g.fen(), m.uci)
      if (!total || m.games / total < minAnteil || out.some((n) => n.uci === uci)) continue
      const san = new Chess(g.fen()).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san
      out.push({ san, uci, eigen: false, spiele: m.games, anteil: m.games / total, kinder: [] })
    }
    return out
  }
  return extend(baum, start)
}

/** Every position of a tree (after the entry and after each node), each once: what the engine has to evaluate for the trap candidates. */
export function baumFens(baum: DatenKnoten[], entry: string[]): string[] {
  const out = new Set<string>()
  const start = new Chess()
  entry.forEach((s) => start.move(s))
  out.add(start.fen())
  const walk = (nodes: DatenKnoten[], g: Chess) => {
    for (const n of nodes) {
      const next = new Chess(g.fen())
      next.move({ from: n.uci.slice(0, 2), to: n.uci.slice(2, 4), promotion: n.uci[4] })
      out.add(next.fen())
      walk(n.kinder, next)
    }
  }
  walk(baum, start)
  return [...out]
}

/** Share of the games (after the entry) that reach each move, by stellungsSchluessel: entry moves 1, an opponent move multiplies its share, an own move keeps the share of its position. */
export function pfadAnteile(baum: DatenKnoten[], entry: string[]): Map<string, number> {
  const out = new Map<string, number>()
  const g = new Chess()
  for (const san of entry) { out.set(stellungsSchluessel(g.fen(), san), 1); g.move(san) }
  const walk = (nodes: DatenKnoten[], pos: Chess, p: number) => {
    for (const n of nodes) {
      const q = p * (n.eigen ? 1 : (n.anteil ?? 0))
      out.set(stellungsSchluessel(pos.fen(), n.san), q)
      const next = new Chess(pos.fen())
      next.move({ from: n.uci.slice(0, 2), to: n.uci.slice(2, 4), promotion: n.uci[4] })
      walk(n.kinder, next, q)
    }
  }
  walk(baum, g, 1)
  return out
}
