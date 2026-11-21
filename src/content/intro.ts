import { Chess } from 'chess.js'
import type { Move } from 'chess.js'
import type { Side } from './types.ts'
import { formatLine, toGermanSan } from '../chess/notation.ts'
import { features } from '../coach/features.ts'
import { VALUE, sideName, the } from '../coach/texts.ts'
import type { PieceType } from '../coach/texts.ts'

/**
 * Introductory texts of the variations (opening page). Two sources: the spoken "Idee" texts (shortened) and, for the
 * rest, a text built here from facts only: the line itself and the features of its last position. Nothing is invented,
 * and `checkIntro` proves that every move and every piece-on-square a text names occurs on the line.
 */

// ---------- check: what a text names must be on the line ----------

const SAN = /^(?:O-O(?:-O)?|[KDTLS]?[a-h]?[1-8]?x?[a-h][1-8](?:=[DTLS])?)[+#]?$/
const NUMBER = /^(\d+)(\.\.\.|…|\.)$/
const PIECE_ON_SQUARE = /\b(Bauern?|Springers?|Läufers?|Türme?|Turms?|Damen?|Königs?)\s+(?:(?:auf|nach)\s+)?([a-h][1-8])\b/g
const TYPE_OF: [RegExp, PieceType][] = [[/^Bauer/, 'p'], [/^Springer/, 'n'], [/^Läufer/, 'b'], [/^Türme?$|^Turms?$/, 'r'], [/^Dame/, 'q'], [/^König/, 'k']]

export function lineFacts(line: string[]) {
  const g = new Chess()
  const german: string[] = []
  const occupied = new Set<string>()
  const note = () => g.board().flat().forEach((p) => { if (p) occupied.add(`${p.type}${p.square}`) })
  note()
  for (const san of line) { g.move(san); german.push(toGermanSan(san)); note() }
  return { german, occupied }
}

/** Empty = the text names only moves and pieces that are on the line; otherwise one message per offender. */
export function checkIntro(text: string, line: string[]): string[] {
  const problems: string[] = []
  let facts: ReturnType<typeof lineFacts>
  try { facts = lineFacts(line) } catch { return ['Linie nicht spielbar'] }

  // move fragments: "4. Ld2", "3… exd4", "1. d4 Sf6 2. c4"
  const tokens = text.split(/\s+/).map((t) => { const u = t.replace(/^\(/, ''); return /^\d+\.$/.test(u) ? u : u.replace(/[.,;:!?)]+$/, '') })
  for (let i = 0; i < tokens.length; i++) {
    const m = NUMBER.exec(tokens[i]!)
    if (!m) continue
    const start = (Number(m[1]) - 1) * 2 + (m[2] === '.' ? 0 : 1)
    const sans: string[] = []
    let j = i + 1
    for (; j < tokens.length; j++) {
      const t = tokens[j]!
      const n = NUMBER.exec(t)
      if (n) {
        if ((Number(n[1]) - 1) * 2 + (n[2] === '.' ? 0 : 1) !== start + sans.length) break // not the continuation of this fragment
        continue
      }
      if (!SAN.test(t)) break
      sans.push(t)
    }
    if (sans.length === 0) continue
    const expected = facts.german.slice(start, start + sans.length)
    if (expected.length !== sans.length || expected.some((s, k) => s !== sans[k])) problems.push(`Zugfolge "${tokens[i]} ${sans.join(' ')}" steht nicht so in der Linie`)
    i = j - 1
  }

  // pieces on squares: "Läufer d2", "Springer auf f7"
  for (const m of text.matchAll(PIECE_ON_SQUARE)) {
    const type = TYPE_OF.find(([re]) => re.test(m[1]!))![1]
    if (!facts.occupied.has(`${type}${m[2]}`)) problems.push(`${m[1]} ${m[2]} kommt in der Linie nicht vor`)
  }
  return problems
}

// ---------- sentences ----------

/** Cuts after . ! ? unless the word is a bare move number ("4."). */
export function splitSentences(text: string): string[] {
  const out: string[] = []
  let cur: string[] = []
  const words = text.trim().split(/\s+/)
  words.forEach((w, i) => {
    cur.push(w)
    const next = words[i + 1]
    if (/[.!?]$/.test(w) && !/^\d+\.$/.test(w) && next !== undefined && /^[A-ZÄÖÜ0-9„"]/.test(next)) { out.push(cur.join(' ')); cur = [] }
  })
  if (cur.length) out.push(cur.join(' '))
  return out
}

/** The first (up to three) sentences of a spoken text that name only what is on the line; stops at the first that does not. */
export function shortenSpokenText(text: string, line: string[]): string | null {
  const kept: string[] = []
  for (const s of splitSentences(text)) {
    if (kept.length === 3 || checkIntro(s, line).length > 0) break
    kept.push(s)
  }
  return kept.length ? kept.join(' ') : null
}

// ---------- generator ----------

const START_MINORS: Record<'w' | 'b', string[]> = { w: ['b1', 'g1', 'c1', 'f1'], b: ['b8', 'g8', 'c8', 'f8'] }
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const label = (ply: number, san: string) => `${Math.floor(ply / 2) + 1}${ply % 2 ? '…' : '.'} ${toGermanSan(san)}`
const aCaptured = (t: PieceType) => (t === 'q' ? 'die Dame' : the(t, true).replace(/^den/, 'einen'))

/** "d-Linie" / "c- und f-Linie" (for "auf der …" and "die … ist/sind offen"). */
export const fileList = (files: string[]) => (files.length === 1 ? `${files[0]}-Linie` : `${files.slice(0, -1).map((f) => `${f}-`).join(', ')} und ${files.at(-1)}-Linie`)
/** "die offene d-Linie" / "die offenen d-, e- und f-Linien" */
const openNoun = (files: string[]) => (files.length === 1 ? `die offene ${fileList(files)}` : `die offenen ${fileList(files)}n`)

function describeMove(m: Move, own: Side): string {
  const mover: Side = m.color === 'w' ? 'white' : 'black'
  if (m.flags.includes('k') || m.flags.includes('q')) return `${mover === own ? 'Du rochierst' : `${sideName(mover)} rochiert`} ${m.flags.includes('k') ? 'kurz' : 'lang'}`
  const piece = m.piece as PieceType
  const check = m.san.includes('+') ? ' und gibt Schach' : ''
  if (m.captured) return `${cap(the(piece))} schlägt auf ${m.to} und nimmt ${aCaptured(m.captured as PieceType)}${check}`
  if (piece === 'p') return `${cap(the(piece))} rückt nach ${m.to}${check}`
  const develops = (piece === 'n' || piece === 'b') && START_MINORS[m.color].includes(m.from) ? ' und entwickelt sich damit' : ''
  return `${cap(the(piece))} geht nach ${m.to}${develops}${check}`
}

interface Fact { family: string; inv: string; normal: string }

function endFacts(own: Side, line: string[], fen: string): { facts: Fact[]; watch: { family: string; text: string }[] } {
  const [white, black] = features(fen)
  const f = { white: white!, black: black! }
  const foe: Side = own === 'white' ? 'black' : 'white'
  const subject = (s: Side) => (s === own ? { inv: 'du', verb: 'hast', pre: 'du' } : { inv: 'dein Gegner', verb: 'hat', pre: 'dein Gegner' })
  const has = (family: string, s: Side, what: string): Fact => ({ family, inv: `${subject(s).verb} ${subject(s).inv} ${what}`, normal: `${subject(s).pre} ${subject(s).verb} ${what}` })
  const facts: Fact[] = []
  const watch: { family: string; text: string }[] = []

  const board = new Chess(fen).board().flat()
  const material = (s: Side) => board.reduce((n, p) => (p && p.color === (s === 'white' ? 'w' : 'b') && p.type !== 'k' ? n + VALUE[p.type as PieceType] : n), 0)
  const diff = material(own) - material(foe)
  if (diff !== 0) {
    const mag = Math.abs(diff)
    const amount = mag === 1 ? 'einen Bauern' : `${mag} Materialpunkte`
    facts.push(has('material', own, `${amount} ${diff > 0 ? 'mehr' : 'weniger'}`))
  }
  const dev = f[own].development - f[foe].development

  for (const s of [own, foe]) {
    const d = f[s].doubled
    if (d.length) facts.push(has(s === own ? 'doubled-own' : 'doubled-foe', s, `Doppelbauern auf der ${fileList(d)}`))
    const iso = f[s].isolated
    if (iso.length) facts.push(has(s === own ? 'isolated-own' : 'isolated-foe', s, `${iso.length === 1 ? 'einen isolierten Bauern' : 'isolierte Bauern'} auf der ${fileList(iso)}`))
  }
  if (f[own].bishopPair !== f[foe].bishopPair) facts.push(has('pair', f[own].bishopPair ? own : foe, 'das Läuferpaar'))

  const castledOf = (s: Side) => line.some((san, i) => san.startsWith('O-O') && (i % 2 === 0) === (s === 'white'))
  const [co, cf] = [castledOf(own), castledOf(foe)]
  if (co !== cf) {
    facts.push(co
      ? { family: 'castle', inv: 'hast du schon rochiert, dein Gegner noch nicht', normal: 'du hast schon rochiert, dein Gegner noch nicht' }
      : { family: 'castle', inv: 'hat dein Gegner schon rochiert, du noch nicht', normal: 'dein Gegner hat schon rochiert, du noch nicht' })
  }

  const open = f.white.openFiles
  if (open.length) facts.push({ family: 'open', inv: `${open.length === 1 ? 'ist' : 'sind'} die ${fileList(open)} offen`, normal: `die ${fileList(open)} ${open.length === 1 ? 'ist' : 'sind'} offen` })

  if (Math.abs(dev) >= 2) {
    const [a, b] = dev > 0 ? [f[own].development, f[foe].development] : [f[foe].development, f[own].development]
    const who = dev > 0 ? 'du' : 'dein Gegner'
    facts.push({ family: 'dev', inv: `${dev > 0 ? 'bist' : 'ist'} ${who} besser entwickelt (${a} gegen ${b} Leichtfiguren)`, normal: `${who} ${dev > 0 ? 'bist' : 'ist'} besser entwickelt (${a} gegen ${b} Leichtfiguren)` })
  }

  // advice only where an observed fact carries it
  if (diff < 0 && dev >= 1) watch.push({ family: 'material', text: 'Das ist der Gedanke deines Dokuments: Material gegen Tempo und Aktivität.' })
  if (f[own].isolated.length) watch.push({ family: 'isolated-own', text: `Achte auf ${f[own].isolated.length === 1 ? 'deinen isolierten Bauern' : 'deine isolierten Bauern'} auf der ${fileList(f[own].isolated)}.` })
  if (f[foe].doubled.length) watch.push({ family: 'doubled-foe', text: `Achte auf die Doppelbauern deines Gegners auf der ${fileList(f[foe].doubled)}.` })
  if (open.length) watch.push({ family: 'open', text: `Achte auf ${openNoun(open)}.` })
  if (!co && cf) watch.push({ family: 'castle', text: 'Achte auf deinen König: Er hat in der Linie noch nicht rochiert.' })
  return { facts, watch }
}

/** Index of the first move of `line` that is not part of the shared entry (= line.length when the line stays on it). */
const branchIndex = (entry: string[], line: string[]): number => [...line.keys()].find((i) => line[i] !== entry[i]) ?? line.length

/** "ab 4. Ld2": the first move after the shared entry of the opening; null when the line does not leave it. */
export function branchLabel(entry: string[], line: string[]): string | null {
  const cp = branchIndex(entry, line)
  return cp < line.length ? `ab ${label(cp, line[cp]!)}` : null
}

/** Two or three sentences: where the variation branches and what the move does, what the last position looks like, what to watch. */
export function generateIntro(opening: { side: Side; entry: string[] }, line: string[]): string {
  const g = new Chess()
  const moves = line.map((san) => g.move(san))
  const cp = branchIndex(opening.entry, line)
  const sentences: string[] = []

  if (cp >= line.length) {
    sentences.push(`Das ist die Grundstellung nach ${formatLine(line)}.`)
  } else {
    const mover: Side = cp % 2 === 0 ? 'white' : 'black'
    const move = label(cp, line[cp]!)
    const what = describeMove(moves[cp]!, opening.side)
    sentences.push(cp > 0
      ? `Nach ${formatLine(line.slice(0, cp))} ${mover === opening.side ? 'wählst du' : `spielt ${sideName(mover)}`} ${move}: ${what}.`
      : `${mover === opening.side ? 'Du beginnst' : `${sideName(mover)} beginnt`} mit ${move}: ${what}.`)
  }

  const { facts, watch } = endFacts(opening.side, line, g.fen())
  const chosen = facts.slice(0, 2)
  if (chosen.length && line.length > 0) {
    const last = label(line.length - 1, line.at(-1)!)
    sentences.push(`Am Ende der Linie (nach ${last}) ${chosen[0]!.inv}${chosen[1] ? `, und ${chosen[1].normal}` : ''}.`)
    const used = new Set(chosen.map((c) => c.family))
    const w = watch.find((x) => !used.has(x.family))
    if (w) sentences.push(w.text)
  }
  return sentences.join(' ')
}

