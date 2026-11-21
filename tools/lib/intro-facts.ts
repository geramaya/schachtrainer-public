import { Chess } from 'chess.js'
import { toGermanSan } from '../../src/chess/notation.ts'
import { features } from '../../src/coach/features.ts'
import { VALUE } from '../../src/coach/texts.ts'
import type { PieceType } from '../../src/coach/texts.ts'
import type { Opening, Side, Variation } from '../../src/content/types.ts'
import { normalizeCastling } from './explorer.ts'
import type { ExplorerMove } from './explorer.ts'

/**
 * Fact sheet of one variation: observations only (line, branch, Stockfish values from the cache, opponent move
 * frequencies from the explorer cache, features of the last position, excerpt of the repertoire document). No wording.
 * The keys of the top level are the "Belegschlüssel" an intro text may refer to (see intro-check.ts).
 */

export const EVAL_DEPTH = 18
/** |cp| from which the verdict is "white/black better"; below it "ausgeglichen". */
export const VERDICT_CP = 50
const ALTERNATIVES = 3

type Verdict = 'weiss' | 'ausgeglichen' | 'schwarz'
export interface DocLine { z: number; text: string }
export interface EvalPoint { ply: number; zug: string; cpWeiss: number | null; matt: number | null }
export interface FactSources {
  /** Analysis cache of the build: key `fen|depth|multipv`, centipawns from the side to move. */
  analysis: Record<string, { lines: { cp: number | null; mate: number | null }[] }>
  /** Explorer cache of the build: key fen. */
  explorer: Record<string, ExplorerMove[]>
  /** Lines of the document block(s) of the opening (docExcerpt); decides `doc.bezug`. */
  dokument?: DocLine[]
}

/** File content of content-src/intro-facts/<openingId>.json: the document excerpt once, the sheets per variation. */
export interface FactsFile { schema: 1; openingId: string; dokument: DocLine[]; varianten: Record<string, IntroFacts> }
export interface SideStructure { isoliert: string[]; doppelt: string[]; freibauern: string[]; laeuferpaar: boolean; koenigsschutzBauern: number; entwickelteLeichtfiguren: number; rochiertInLinie: boolean }
export interface IntroFacts {
  schema: 1
  variationId: string
  name: string
  seite: Side
  zugfolge: { de: string[]; text: string; plies: number }
  abzweigung: { ply: number; zug: string; san: string; seite: Side; vonEigenerSeite: boolean } | null
  etappe: { partOf: string | null; enthaeltEtappen: string[] }
  bewertung: {
    tiefe: number
    schwelleCp: number
    entlangLinie: EvalPoint[]
    wendepunkte: (EvalPoint & { von: Verdict; nach: Verdict })[]
    kritischerZug: { ply: number; zug: string; zieher: Side; vonCp: number; nachCp: number; sprungCp: number } | null
    /** Last evaluated ply; `amLinienende` false when the last position of the line was never analysed. */
    endbewertung: (EvalPoint & { cpEigen: number | null; amLinienende: boolean }) | null
  }
  gegnerzuege: { ply: number; zug: string; gespielt: { de: string; partien: number | null; anteilProzent: number | null }; alternativen: { de: string; partien: number; anteilProzent: number }[]; summePartien: number }[]
  endstellung: {
    fen: string
    /** Count of the last position as it is (pawn 1, minor 3, rook 5, queen 9). */
    material: {
      weiss: number; schwarz: number; differenzEigen: number
      /** true when the line ends with a capture the side to move can answer on the same square (exchange not finished) */
      schlagfolgeOffen: boolean
      /** count after the open exchange is played out by simple recaptures (least valuable piece first); equals the strict count when nothing is open */
      beruhigt: { weiss: number; schwarz: number; differenzEigen: number }
      /** readable balance of the settled position from the repertoire side: "ausgeglichen", "+1 Bauer", "Qualität weniger, −1 Bauer" */
      bilanz: string
    }
    offeneLinien: string[]
    halboffeneLinien: { weiss: string[]; schwarz: string[] }
    eigen: SideStructure
    gegner: SideStructure
    rochade: { eigen: boolean; gegner: boolean }
  }
  /**
   * Relation to the repertoire document: `identisch` (same line as a move line of the document, or built from it),
   * `unterhalb` (starts with its move line or, without one, with the entry of the opening: the document block treats this system),
   * `teil` (shorter than the document line), `keiner`. `codeZeile` = line number of the matching move line.
   */
  doc: { quelle: string; /** the document has a block for the opening (a side line of it can still have bezug `keiner`) */ eroeffnungImDokument: boolean; variantImDokument: boolean; bezug: 'identisch' | 'unterhalb' | 'teil' | 'keiner'; codeZeile: number | null }
}

const label = (ply: number, san: string) => `${Math.floor(ply / 2) + 1}${ply % 2 ? '…' : '.'} ${toGermanSan(san)}`
const sideOfPly = (ply: number): Side => (ply % 2 === 0 ? 'white' : 'black')
const verdict = (cp: number): Verdict => (cp >= VERDICT_CP ? 'weiss' : cp <= -VERDICT_CP ? 'schwarz' : 'ausgeglichen')
const round1 = (x: number) => Math.round(x * 10) / 10

/** Bold headings in the repertoire document that open the block of an opening (sections 5, 6 and 8). */
const DOC_HEADINGS: Record<string, RegExp[]> = {
  scotch: [/Schottische Partie/, /Schottisches Gambit/],
  italian: [/Italienische Partie/, /Italienisches Spiel/],
  'smith-morra': [/Smith-Morra/],
  alapin: [/Alapin/],
  'caro-kann': [/Caro-Kann/],
  budapest: [/Budapester/],
  'nimzo-indian': [/Nimzo/],
  tarrasch: [/Tarrasch/],
  'kings-indian': [/Königsindischer/],
  vienna: [/Wiener Partie/],
}

/** Lines of the document blocks of an opening (a block runs from its bold heading to the next heading or blank line before a new block), with 1-based line numbers. */
export function docExcerpt(doc: string, openingId: string): DocLine[] {
  const heads = DOC_HEADINGS[openingId] ?? []
  const lines = doc.split('\n')
  const out: DocLine[] = []
  let inBlock = false
  lines.forEach((text, i) => {
    const bold = /^\*\*.+\*\*\s*$/.test(text)
    if (bold || /^#/.test(text)) inBlock = bold && heads.some((re) => re.test(text))
    if (inBlock && text.trim() !== '') out.push({ z: i + 1, text })
  })
  return out
}

export type Counts = Record<'q' | 'r' | 'b' | 'n' | 'p', number>
export const NAMES: [keyof Counts, string, string][] = [['q', 'Dame', 'Damen'], ['r', 'Turm', 'Türme'], ['b', 'Läufer', 'Läufer'], ['n', 'Springer', 'Springer'], ['p', 'Bauer', 'Bauern']]

/** Piece-count difference (own minus foe) as words: one exchange named as "Qualität", the rest by piece. */
export function bilanzText(d: Counts): string {
  const c = { ...d }
  const parts: string[] = []
  const minor = c.b !== 0 && Math.sign(c.b) === -Math.sign(c.r) ? 'b' : c.n !== 0 && Math.sign(c.n) === -Math.sign(c.r) ? 'n' : null
  if (c.r !== 0 && minor) {
    parts.push(c.r > 0 ? 'Qualität mehr' : 'Qualität weniger')
    c.r -= Math.sign(c.r)
    c[minor] -= Math.sign(c[minor])
  }
  for (const [t, one, many] of NAMES) if (c[t] !== 0) parts.push(`${c[t] > 0 ? '+' : '−'}${Math.abs(c[t])} ${Math.abs(c[t]) === 1 ? one : many}`)
  return parts.length ? parts.join(', ') : 'ausgeglichen'
}

/** Plays out an unfinished exchange: while the last move was a capture and the side to move can capture on that square, it does so with its least valuable piece. */
export function settle(line: string[]): { board: Chess; open: boolean } {
  const g = new Chess()
  for (const san of line) g.move(san)
  let open = false
  for (let i = 0; i < 8; i++) {
    const last = g.history({ verbose: true }).at(-1)
    const options = last?.captured ? g.moves({ verbose: true }).filter((m) => m.to === last.to && m.captured) : []
    if (options.length === 0) break
    open = true
    options.sort((a, b) => VALUE[a.piece as PieceType] - VALUE[b.piece as PieceType])
    g.move(options[0]!)
  }
  return { board: g, open }
}

export const count = (g: Chess, c: 'w' | 'b'): Counts => {
  const n: Counts = { q: 0, r: 0, b: 0, n: 0, p: 0 }
  for (const p of g.board().flat()) if (p && p.color === c && p.type !== 'k') n[p.type]++
  return n
}
const worth = (n: Counts) => n.q * 9 + n.r * 5 + (n.b + n.n) * 3 + n.p

const GERMAN_TO_ENGLISH: Record<string, string> = { S: 'N', L: 'B', T: 'R', D: 'Q' }

/** Move lines of the document ("- Code: 1. e4 c6 2. d4 d5", "- Züge: ..."), German or English SAN, as English SAN; reading stops at the first word that is no legal move. */
export function docSequences(lines: DocLine[]): { z: number; moves: string[] }[] {
  const out: { z: number; moves: string[] }[] = []
  for (const { z, text } of lines) {
    const m = /^\s*-\s*(?:Code|Züge):\s*(.*)$/.exec(text)
    if (!m) continue
    const g = new Chess()
    const moves: string[] = []
    for (const raw of m[1]!.split(/\s+/)) {
      if (/^\d+\.(\.\.)?$/.test(raw)) continue
      const word = raw.replace(/[!?]+$/, '')
      const candidates = [word, word.replace(/^[SLTD]/, (c) => GERMAN_TO_ENGLISH[c]!).replace(/=([SLTD])/, (_x, c: string) => `=${GERMAN_TO_ENGLISH[c]}`)]
      const san = candidates.find((c) => { try { return new Chess(g.fen()).move(c) !== null } catch { return false } })
      if (!san) break
      moves.push(g.move(san).san)
    }
    if (moves.length) out.push({ z, moves })
  }
  return out
}

const startsWith = (line: string[], prefix: string[]) => prefix.length <= line.length && prefix.every((x, i) => x === line[i])

/** How the variation relates to the document block of its opening (see `IntroFacts.doc`). */
function docRelation(opening: Pick<Opening, 'entry'>, v: Variation, dokument: DocLine[]): { bezug: 'identisch' | 'unterhalb' | 'teil' | 'keiner'; codeZeile: number | null } {
  const seqs = docSequences(dokument)
  const same = seqs.find((s) => s.moves.length === v.line.length && startsWith(v.line, s.moves))
  if (same) return { bezug: 'identisch', codeZeile: same.z }
  if (v.fromDocument) return { bezug: 'identisch', codeZeile: null }
  const below = seqs.find((s) => s.moves.length < v.line.length && startsWith(v.line, s.moves))
  if (below) return { bezug: 'unterhalb', codeZeile: below.z }
  const part = seqs.find((s) => v.line.length < s.moves.length && startsWith(s.moves, v.line))
  if (part) return { bezug: 'teil', codeZeile: part.z }
  if (dokument.length > 0 && opening.entry.length > 0 && startsWith(v.line, opening.entry)) return { bezug: 'unterhalb', codeZeile: null }
  return { bezug: 'keiner', codeZeile: null }
}

function structure(side: Side, f: ReturnType<typeof features>, castled: boolean): SideStructure {
  const s = f[side === 'white' ? 0 : 1]!
  return { isoliert: s.isolated, doppelt: s.doubled, freibauern: s.passed, laeuferpaar: s.bishopPair, koenigsschutzBauern: s.kingShelter, entwickelteLeichtfiguren: s.development, rochiertInLinie: castled }
}

export function introFacts(opening: Pick<Opening, 'id' | 'side' | 'entry' | 'docRef'>, v: Variation, src: FactSources, siblings: Variation[] = []): IntroFacts {
  const own = opening.side
  const g = new Chess()
  const points: EvalPoint[] = []
  const gegnerzuege: IntroFacts['gegnerzuege'] = []

  v.line.forEach((san, ply) => {
    const before = g.fen()
    g.move(san)
    const entry = src.analysis[`${g.fen()}|${EVAL_DEPTH}|1`]?.lines[0]
    const sign = ply % 2 === 0 ? -1 : 1 // after ply: the other side is to move; its cp/mate is flipped to white
    points.push({ ply, zug: label(ply, san), cpWeiss: entry && entry.cp !== null && entry.mate === null ? sign * entry.cp : null, matt: entry && entry.mate !== null ? sign * entry.mate : null })

    const listed = sideOfPly(ply) !== own ? src.explorer[before] : undefined
    if (listed && listed.length) {
      const moves = listed.map((m) => ({ uci: normalizeCastling(before, m.uci), games: m.games }))
      const total = moves.reduce((n, m) => n + m.games, 0)
      const played = new Chess(before).move(san)
      const playedUci = played.from + played.to + (played.promotion ?? '')
      const hit = moves.find((m) => m.uci === playedUci)
      const deOf = (uci: string) => toGermanSan(new Chess(before).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san)
      gegnerzuege.push({
        ply, zug: label(ply, san),
        gespielt: { de: toGermanSan(san), partien: hit?.games ?? null, anteilProzent: hit && total ? round1((hit.games / total) * 100) : null },
        alternativen: moves.filter((m) => m !== hit).slice(0, ALTERNATIVES).map((m) => ({ de: deOf(m.uci), partien: m.games, anteilProzent: round1((m.games / total) * 100) })),
        summePartien: total,
      })
    }
  })

  const evaluated = points.filter((p) => p.cpWeiss !== null)
  const wendepunkte: IntroFacts['bewertung']['wendepunkte'] = []
  for (let i = 1; i < evaluated.length; i++) {
    const [a, b] = [verdict(evaluated[i - 1]!.cpWeiss!), verdict(evaluated[i]!.cpWeiss!)]
    if (a !== b) wendepunkte.push({ ...evaluated[i]!, von: a, nach: b })
  }
  let kritischerZug: IntroFacts['bewertung']['kritischerZug'] = null
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1]!.cpWeiss, points[i]!.cpWeiss]
    if (a === null || b === null) continue
    if (!kritischerZug || Math.abs(b - a) > Math.abs(kritischerZug.sprungCp)) kritischerZug = { ply: i, zug: points[i]!.zug, zieher: sideOfPly(i), vonCp: a, nachCp: b, sprungCp: b - a }
  }
  const last = points.findLast((p) => p.cpWeiss !== null || p.matt !== null)
  const endbewertung = last ? { ...last, cpEigen: last.cpWeiss === null ? null : own === 'white' ? last.cpWeiss : -last.cpWeiss, amLinienende: last.ply === points.length - 1 } : null

  const cp = v.line.findIndex((san, i) => san !== opening.entry[i])
  const branchAt = cp === -1 ? (v.line.length > opening.entry.length ? opening.entry.length : -1) : cp
  const abzweigung = branchAt >= 0 && branchAt < v.line.length ? { ply: branchAt, zug: label(branchAt, v.line[branchAt]!), san: toGermanSan(v.line[branchAt]!), seite: sideOfPly(branchAt), vonEigenerSeite: sideOfPly(branchAt) === own } : null

  const fen = g.fen()
  const f = features(fen)
  const [w, b] = [worth(count(g, 'w')), worth(count(g, 'b'))]
  const settled = settle(v.line)
  const [sw, sb] = [count(settled.board, 'w'), count(settled.board, 'b')]
  const [ownC, foeC] = own === 'white' ? [sw, sb] : [sb, sw]
  const diffC = Object.fromEntries((['q', 'r', 'b', 'n', 'p'] as const).map((t) => [t, ownC[t] - foeC[t]])) as Counts
  const castledOf = (s: Side) => v.line.some((san, i) => san.startsWith('O-O') && sideOfPly(i) === s)
  const foe: Side = own === 'white' ? 'black' : 'white'

  return {
    schema: 1,
    variationId: v.id,
    name: v.name,
    seite: own,
    zugfolge: { de: v.line.map(toGermanSan), text: v.line.map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}. ` : '') + toGermanSan(san)).join(' '), plies: v.line.length },
    abzweigung,
    etappe: { partOf: v.partOf ?? null, enthaeltEtappen: siblings.filter((s) => s.partOf === v.id).map((s) => s.id) },
    bewertung: { tiefe: EVAL_DEPTH, schwelleCp: VERDICT_CP, entlangLinie: points, wendepunkte, kritischerZug, endbewertung },
    gegnerzuege,
    endstellung: {
      fen,
      material: {
        weiss: w, schwarz: b, differenzEigen: own === 'white' ? w - b : b - w,
        schlagfolgeOffen: settled.open,
        beruhigt: { weiss: worth(sw), schwarz: worth(sb), differenzEigen: own === 'white' ? worth(sw) - worth(sb) : worth(sb) - worth(sw) },
        bilanz: bilanzText(diffC),
      },
      offeneLinien: f[0]!.openFiles,
      halboffeneLinien: { weiss: f[0]!.halfOpenFiles, schwarz: f[1]!.halfOpenFiles },
      eigen: structure(own, f, castledOf(own)),
      gegner: structure(foe, f, castledOf(foe)),
      rochade: { eigen: castledOf(own), gegner: castledOf(foe) },
    },
    doc: { quelle: opening.docRef, eroeffnungImDokument: (src.dokument ?? []).length > 0, ...(({ bezug, codeZeile }) => ({ variantImDokument: bezug !== 'keiner', bezug, codeZeile }))(docRelation(opening, v, src.dokument ?? [])) },
  }
}
