import { checkIntro, lineFacts, splitSentences } from '../../src/content/intro.ts'
import type { DocLine, IntroFacts } from './intro-facts.ts'
import { checkClaims } from './intro-claims.ts'

/**
 * Check of an authored intro text (content-src/intros/<openingId>.ts) against its fact sheet.
 *  - moves and pieces on squares: `checkIntro` (must be on the line); bare squares: some piece must stand on them or move there
 *  - evaluations (+1,5 / −0,3 / 1,2 Bauerneinheiten / 120 cp): a value of the sheet, sign included for signed ones, +-10 cp
 *  - percentages: a share of the sheet, +-1 point; game counts: a count of the sheet, +-5 %
 *  - sentences about "Plan"/"Idee"/"Ziel"/...: only with evidence keys (`belege`); every key must exist and carry content
 */

export interface IntroEntry { text: string; belege: string[] }

export const MAX_SENTENCES = 3
export const MAX_CHARS = 700
export const TOLERANCE_CP = 10
export const TOLERANCE_PERCENT_POINTS = 1
export const TOLERANCE_GAMES = 0.05

/** What a `belege` entry may name. `doc:Z<n>` = line n of the repertoire document excerpt of the opening. */
export const BELEG_KEYS = ['zugfolge', 'abzweigung', 'etappe', 'entlangLinie', 'wendepunkte', 'kritischerZug', 'endbewertung', 'gegnerzuege', 'material', 'struktur', 'offeneLinien', 'rochade', 'koenigssicherheit', 'entwicklung'] as const

const PLAN_WORDS = /\b(Plan|Pläne|Plans|Idee|Ideen|Ziel|Ziele|Gedanke|Gedanken|Strategie|Absicht)\b/
const SIGNED_EVAL = /(?<![\w.,])([+−–-])(\d+(?:[.,]\d+)?)(?![\d.,]*\s*(?:%|Prozent))/g
const PAWN_UNITS = /(?<![\w.,+−–-])(\d+(?:[.,]\d+)?)\s*(?:Bauerneinheit(?:en)?|Bauern(?=\s+(?:Vorteil|Plus|Rückstand)))/g
const CENTIPAWNS = /(?<![\w.,+−–-])(\d+)\s*(?:cp|Centipawns?)\b/g
const PERCENT = /(\d+(?:[.,]\d+)?)\s*(?:%|Prozent)/g
const GAMES = /(\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?)\s*(Millionen|Mio\.|Tausend)?\s*Partien/g
const BARE_SQUARE = /\b[a-h][1-8]\b/g
const num = (s: string) => Number(s.replace(',', '.'))

function beleg(key: string, f: IntroFacts, dokument: DocLine[]): string | null {
  const doc = /^doc:Z(\d+)$/.exec(key)
  if (doc) return dokument.some((d) => d.z === Number(doc[1])) ? null : `Beleg ${key}: Zeile steht nicht im Dokumentauszug des Faktenblatts`
  const has: Record<string, boolean> = {
    zugfolge: true, material: true, struktur: true, offeneLinien: true, rochade: true, koenigssicherheit: true, entwicklung: true,
    abzweigung: f.abzweigung !== null,
    etappe: f.etappe.partOf !== null || f.etappe.enthaeltEtappen.length > 0,
    entlangLinie: f.bewertung.entlangLinie.some((p) => p.cpWeiss !== null || p.matt !== null),
    wendepunkte: f.bewertung.wendepunkte.length > 0,
    kritischerZug: f.bewertung.kritischerZug !== null,
    endbewertung: f.bewertung.endbewertung !== null,
    gegnerzuege: f.gegnerzuege.length > 0,
  }
  if (!(key in has)) return `Beleg "${key}" ist kein Faktenschlüssel (erlaubt: ${BELEG_KEYS.join(', ')}, doc:Z<n>)`
  return has[key] ? null : `Beleg ${key}: das Faktenblatt hat dazu keinen Inhalt`
}

/** Empty = the text is backed by the sheet; otherwise one message per offender. */
export function checkAuthoredIntro(entry: IntroEntry, line: string[], facts: IntroFacts, dokument: DocLine[]): string[] {
  const { text } = entry
  if (JSON.stringify(facts.zugfolge.de) !== JSON.stringify(lineFacts(line).german)) return ['Faktenblatt gehört zu einer anderen Zugfolge (veraltet): node tools/intro-facts.ts neu ausführen']
  const problems = checkIntro(text, line)
  const sentences = splitSentences(text).filter((x) => x.trim() !== '').length
  if (sentences < 1 || sentences > MAX_SENTENCES) problems.push(`${sentences} Sätze, erlaubt sind 1 bis ${MAX_SENTENCES}`)
  if (text.length > MAX_CHARS) problems.push(`${text.length} Zeichen, erlaubt sind höchstens ${MAX_CHARS}`)

  const squares = new Set([...lineFacts(line).occupied].map((p) => p.slice(1)))
  for (const m of text.matchAll(BARE_SQUARE)) if (!squares.has(m[0]) && !problems.some((p) => p.includes(` ${m[0]} `))) problems.push(`Feld ${m[0]} kommt in der Linie nicht vor`)

  const own = facts.seite === 'white' ? 1 : -1
  const signed = new Set<number>()
  for (const p of facts.bewertung.entlangLinie) if (p.cpWeiss !== null) { signed.add(p.cpWeiss); signed.add(own * p.cpWeiss) }
  const k = facts.bewertung.kritischerZug
  if (k) [k.vonCp, k.nachCp, k.sprungCp].forEach((c) => signed.add(c))
  const near = (cp: number, set: Iterable<number>, abs: boolean) => [...set].some((s) => Math.abs((abs ? Math.abs(s) : s) - cp) <= TOLERANCE_CP + 1e-9)
  for (const m of text.matchAll(SIGNED_EVAL)) {
    const cp = Math.round(num(m[2]!) * 100) * (m[1] === '+' ? 1 : -1)
    if (!near(cp, signed, false)) problems.push(`Bewertung ${m[0]} steht nicht im Faktenblatt (±${TOLERANCE_CP} cp, mit Vorzeichen)`)
  }
  for (const m of text.matchAll(PAWN_UNITS)) if (!near(Math.round(num(m[1]!) * 100), signed, true)) problems.push(`Bewertung ${m[0]} steht nicht im Faktenblatt (±${TOLERANCE_CP} cp)`)
  for (const m of text.matchAll(CENTIPAWNS)) if (!near(Number(m[1]), signed, true)) problems.push(`Bewertung ${m[0]} steht nicht im Faktenblatt (±${TOLERANCE_CP} cp)`)

  const shares: number[] = []
  const counts: number[] = []
  for (const z of facts.gegnerzuege) {
    if (z.gespielt.anteilProzent !== null) shares.push(z.gespielt.anteilProzent)
    if (z.gespielt.partien !== null) counts.push(z.gespielt.partien)
    for (const a of z.alternativen) { shares.push(a.anteilProzent); counts.push(a.partien) }
    counts.push(z.summePartien)
  }
  for (const m of text.matchAll(PERCENT)) if (!shares.some((s) => Math.abs(s - num(m[1]!)) <= TOLERANCE_PERCENT_POINTS + 1e-9)) problems.push(`Anteil ${m[0]} steht nicht im Faktenblatt (±${TOLERANCE_PERCENT_POINTS} Prozentpunkt)`)
  for (const m of text.matchAll(GAMES)) {
    const scale = m[2] === 'Tausend' ? 1e3 : m[2] ? 1e6 : 0
    const n = scale ? num(m[1]!) * scale : Number(m[1]!.replaceAll('.', ''))
    if (!counts.some((c) => Math.abs(c - n) <= c * TOLERANCE_GAMES)) problems.push(`Partienzahl "${m[0]}" steht nicht im Faktenblatt (±${TOLERANCE_GAMES * 100} %)`)
  }

  problems.push(...checkClaims(text, line, facts, splitSentences))

  const keyProblems = entry.belege.flatMap((key) => beleg(key, facts, dokument) ?? [])
  problems.push(...keyProblems)
  if (entry.belege.length === 0) for (const s of splitSentences(text)) if (PLAN_WORDS.test(s)) problems.push(`Aussage über Plan/Idee ohne Beleg (belege leer): "${s}"`)
  return problems
}
