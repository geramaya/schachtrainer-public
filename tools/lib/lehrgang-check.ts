import { Chess } from 'chess.js'
import { splitSentences } from '../../src/content/intro.ts'
import { isTodo } from '../../src/lehrgang/types.ts'
import { checkAuthoredIntro } from './intro-check.ts'
import type { Aufgabe } from './lehrgang-aufgaben.ts'
import type { StellungenFile } from './lehrgang-build.ts'
import { musterSchluessel } from './lehrgang-muster.ts'
import { linienSchluessel } from './lehrgang-system.ts'
import type { RaetselPruefung } from './lehrgang-system.ts'
import type { System } from '../../src/lehrgang/types.ts'

const STATUS = ['entwurf', 'geprueft']
const GERMAN_TO_ENGLISH: Record<string, string> = { S: 'N', L: 'B', T: 'R', D: 'Q' }
const SAN = /^(?:O-O(?:-O)?|[KDTLS]?[a-h]?[1-8]?x?[a-h][1-8](?:=[DTLS])?)[+#]?$/
const NUMBER = /^(\d+)(\.\.\.|…|\.)$/

/** The claims of a sentence against the fact sheet of its position (moves on the line, evaluation, material, shares, plan words need evidence). */
function pruefeAussage(satz: string, belege: string[], a: Aufgabe, fail: (why: string) => void) {
  for (const p of checkAuthoredIntro({ text: satz, belege }, a.zugfolge, a.fakten, [])) fail(p)
  for (const p of pruefeBewertungsworte(satz, a.bewertung.nachCpWeiss, a.fakten.seite)) fail(p)
}

/** What the move itself did (only for a sentence about this one move). */
function pruefeZugBehauptungen(satz: string, z: Aufgabe['zugFakten'], fail: (why: string) => void) {
  if (/rochier/i.test(satz) && !z.rochiert) fail('Satz spricht von Rochade, der Zug rochiert nicht')
  if (/\b(schlägt|schlägst|nimmt|nimmst|schlagen)\b/i.test(satz) && !z.schlaegt) fail('Satz spricht von einem Schlagzug, der Zug schlägt nichts')
  if (/\b(gibst|gibt|setzt|setzt du)\b[^.]*\bSchach\b/i.test(satz) && !z.schach) fail('Satz spricht von Schach, der Zug gibt kein Schach')
}

/** Checks every written sentence against the fact sheet of its position with the intro checker, plus what the move itself did. */
export function pruefeStellungen(stellungen: StellungenFile, aufgaben: Aufgabe[]): string[] {
  const byKey = new Map(aufgaben.map((a) => [a.schluessel, a]))
  const problems: string[] = []
  for (const [key, s] of Object.entries(stellungen)) {
    const a = byKey.get(key)
    const where = a ? `${a.zugfolgeText}` : key
    const fail = (why: string) => problems.push(`${where}: ${why}`)
    if (!STATUS.includes(s.status)) fail(`Status "${s.status}" unbekannt (entwurf | geprueft)`)
    if (typeof s.satz !== 'string' || s.satz.trim() === '') { fail('Satz ist leer'); continue }
    if (isTodo(s.satz)) continue
    if (!a) { fail('Stellung steht nicht in aufgaben.json (veraltet? npm run lehrgang:aufgaben)'); continue }
    pruefeAussage(s.satz, s.belege ?? [], a, fail)
    pruefeZugBehauptungen(s.satz, a.zugFakten, fail)
  }
  return problems
}

/** Comments of model games: each sentence against the fact sheet of the commented position (made by `lehrgang:aufgaben`), like a sentence per position. */
export function pruefeMuster(muster: { id: string; pgn: string; kommentare: { ply: number; satz: string; status?: string; belege?: string[] }[] }[], aufgaben: Aufgabe[], where: string): string[] {
  const byKey = new Map(aufgaben.map((a) => [a.schluessel, a]))
  const problems: string[] = []
  for (const m of muster) for (const k of m.kommentare) {
    const fail = (why: string) => problems.push(`${where}/${m.id} Halbzug ${k.ply}: ${why}`)
    if (k.status !== undefined && !STATUS.includes(k.status)) fail(`Status "${k.status}" unbekannt (entwurf | geprueft)`)
    if (typeof k.satz !== 'string' || k.satz.trim() === '') { fail('Satz ist leer'); continue }
    if (isTodo(k.satz)) continue
    const key = musterSchluessel(m.pgn, k.ply)
    const a = key ? byKey.get(key) : undefined
    if (!a) { fail('Stellung steht nicht in aufgaben.json (npm run lehrgang:aufgaben)'); continue }
    pruefeAussage(k.satz, k.belege ?? [], a, fail)
    pruefeZugBehauptungen(k.satz, a.zugFakten, fail)
  }
  return problems
}

/** Goal sentences of a variety against the fact sheet of its last position (the whole line); move facts do not apply, the sentence is about the idea, not one move. */
export function pruefeZiel(ziel: { satz: string; status?: string; belege?: string[] }[], a: Aufgabe | undefined, where: string): string[] {
  const problems: string[] = []
  for (const [i, z] of ziel.entries()) {
    const fail = (why: string) => problems.push(`${where} ziel ${i + 1}: ${why}`)
    if (z.status !== undefined && !STATUS.includes(z.status)) fail(`Status "${z.status}" unbekannt (entwurf | geprueft)`)
    if (typeof z.satz !== 'string' || z.satz.trim() === '') { fail('Satz ist leer'); continue }
    if (isTodo(z.satz)) continue
    if (!a) { fail('Faktenblatt der Variante fehlt in aufgaben.json (npm run lehrgang:aufgaben)'); continue }
    pruefeAussage(z.satz, z.belege ?? [], a, fail)
  }
  return problems
}

/** Moves named with a move number in the Spielplan must be legal in the entry line (from the position the number points to); only the entry is checkable, so a number beyond it is reported. */
export function pruefeSpielplan(plan: { titel: string; text: string }[], entry: string[]): string[] {
  const problems: string[] = []
  for (const sec of plan) {
    if (isTodo(sec.text)) continue
    const tokens = sec.text.split(/\s+/).map((t) => t.replace(/^\(/, '').replace(/[,;:!?)]+$/, ''))
    for (let i = 0; i < tokens.length; i++) {
      const n = NUMBER.exec(tokens[i]!)
      if (!n) continue
      const startPly = (Number(n[1]) - 1) * 2 + (n[2] === '.' ? 0 : 1)
      const fail = (m: string) => problems.push(`spielplan.md "${sec.titel}": ${m}`)
      if (startPly > entry.length) { fail(`"${tokens[i]} ${tokens[i + 1] ?? ''}" liegt hinter der Einstiegslinie ${entry.join(' ')} und ist nicht prüfbar`); continue }
      const g = new Chess()
      entry.slice(0, startPly).forEach((s) => g.move(s))
      for (let j = i + 1; j < tokens.length; j++) {
        const w = tokens[j]!.replace(/\.$/, '')
        if (NUMBER.test(w) || !SAN.test(w)) break
        const en = w.replace(/^[SLTD]/, (c) => GERMAN_TO_ENGLISH[c]!).replace(/=([SLTD])/, (_x, c: string) => `=${GERMAN_TO_ENGLISH[c]}`)
        try { g.move(en) } catch { fail(`Zug "${tokens[i]} ${w}" ist in der Einstiegslinie nicht legal`); break }
        i = j
      }
    }
  }
  return problems
}

/** Evaluation words need the engine number (centipawns from White's view; `seite` = the Lehrgang side, "du" in the text): below 50 only "ausgeglichen", from 50 "besser/vorn/im Vorteil" (also "leicht"), "klar/deutlich" from 100, "entscheidend" from 300. */
const SUBJECT = '(Weiß|Schwarz|dich|dir|du|dein Gegner)'
const WORD = new RegExp(`\\b${SUBJECT}(?![\\wäöüß])(?:\\s+[\\wäöüß]+){0,3}?\\s+(?:(klar|deutlich|leicht|etwas|knapp)\\s+)?(besser|vorn|im Vorteil)`, 'gi')
const DECISIVE = /\bentscheidend\w*\s+(?:besser|Vorteil|vorn)|\bsteht\s+(?:\w+\s+)?auf Gewinn/i
const NEED = { plain: 50, strong: 100, decisive: 300 } as const
const fmtCp = (c: number) => `${c > 0 ? '+' : c < 0 ? '−' : ''}${(Math.abs(c) / 100).toFixed(2).replace('.', ',')}`

export function pruefeBewertungsworte(satz: string, cpWeiss: number | null, seite: 'white' | 'black'): string[] {
  const own = seite === 'white' ? 1 : -1
  const problems: string[] = []
  const numberAfter = (from: number): number | null => {
    const end = satz.slice(from).search(/[.!?](?:\s|$)/)
    const m = /\(([+−-])(\d+)(?:,(\d+))?\)/.exec(satz.slice(from, end < 0 ? undefined : from + end))
    return m ? (m[1] === '+' ? 1 : -1) * Math.round(Number(`${m[2]}.${m[3] ?? '0'}`) * 100) : null
  }
  const judge = (word: string, sign: number, c: number | null, need: number, label: string) => {
    if (c === null) return
    if (c * sign < need) problems.push(`Bewertungswort "${word}": Engine ${fmtCp(c)} (Weiß-Sicht) trägt "${label}" für ${sign === own ? 'deine Seite' : 'die Gegenseite'} nicht (mind. ${fmtCp(need * sign)})`)
  }
  for (const m of satz.matchAll(WORD)) {
    const who = m[1]!
    const sign = /^(Weiß)$/i.test(who) ? 1 : /^Schwarz$/i.test(who) ? -1 : /^dein Gegner$/i.test(who) ? -own : own
    const c = numberAfter(m.index! + m[0].length) ?? cpWeiss
    const adv = (m[2] ?? '').toLowerCase()
    judge(m[0], sign, c, /^(klar|deutlich)$/.test(adv) ? NEED.strong : NEED.plain, adv ? `${adv} ${m[3]}` : m[3]!)
  }
  const dec = DECISIVE.exec(satz)
  if (dec) judge(dec[0], /Schwarz/.test(satz) && !/Weiß/.test(satz) ? -1 : /Weiß/.test(satz) && !/Schwarz/.test(satz) ? 1 : own, numberAfter(dec.index) ?? cpWeiss, NEED.decisive, 'entscheidend')
  return problems
}

/** A puzzle solution that is not the engine's best move still counts as equal within this loss (centipawns). */
export const RAETSEL_TOLERANZ_CP = 30

export interface SystemBlaetter { stellungen: Aufgabe[]; fenBewertung: Record<string, number | null>; raetsel: RaetselPruefung[]; musterStellungen?: Aufgabe[] }

/** Puzzle solution against the engine: the best move, or equal within RAETSEL_TOLERANZ_CP (mate: the solution must also win by force). */
function pruefeRaetselLoesung(p: RaetselPruefung | undefined, at: string): string[] {
  if (!p || p.bestUci === null) return [`${at}: nicht bewertet (npm run lehrgang:aufgaben)`]
  if (p.loesungUci === p.bestUci) return []
  if (p.mattBest) return p.mattLoesung ? [] : [`${at}: Engine sieht Matt mit ${p.bestUci}, die Lösung ${p.loesungUci} nicht`]
  if (p.cpBest === null || p.cpLoesung === null) return [`${at}: Lösung ${p.loesungUci} ist nicht der Bestzug ${p.bestUci} und nicht vergleichbar bewertet`]
  const verlust = p.cpBest - p.cpLoesung
  return verlust <= RAETSEL_TOLERANZ_CP ? [] : [`${at}: Lösung ${p.loesungUci} ist nicht der Bestzug ${p.bestUci} der Engine (Verlust ${verlust} cp, erlaubt ${RAETSEL_TOLERANZ_CP})`]
}

/** Every written sentence of a system against the fact sheet of its position (as for Lehrgang sentences), FEN-only boards against the engine value, puzzles against the engine, model-game comments like elsewhere. Placeholders are skipped. */
export function pruefeSystem(sys: System, b: SystemBlaetter, where: string): string[] {
  const at = `${where}/systeme/${sys.id}`
  const byKey = new Map(b.stellungen.map((a) => [a.schluessel, a]))
  const problems: string[] = []
  const status = (st: string | undefined, a: string) => { if (st !== undefined && !STATUS.includes(st)) problems.push(`${a}: Status "${st}" unbekannt (entwurf | geprueft)`) }
  const main = sys.hauptlinie.zuege.map((z) => z.san)
  const satz = (text: string, line: string[] | null, fen: string, a: string, zugFakten: boolean, belege: string[] = []) => {
    if (isTodo(text)) return
    const fail = (why: string) => problems.push(`${a}: ${why}`)
    if (!line) { for (const p of pruefeBewertungsworte(text, b.fenBewertung[fen] ?? null, new Chess(fen).turn() === 'w' ? 'white' : 'black')) fail(p); return }
    const sheet = byKey.get(linienSchluessel(line))
    if (!sheet) { fail('Stellung steht nicht in aufgaben.json (npm run lehrgang:aufgaben)'); return }
    pruefeAussage(text, belege, sheet, fail)
    if (zugFakten) pruefeZugBehauptungen(text, sheet.zugFakten, fail)
  }
  for (const [i, z] of sys.hauptlinie.zuege.entries()) { status(z.status, `${at}: hauptlinie Zug ${i + 1}`); satz(z.satz, main.slice(0, i + 1), '', `${at}: hauptlinie Zug ${i + 1}`, true) }
  for (const a of sys.hauptlinie.aeste) {
    const line = [...main.slice(0, a.ab), ...a.zuege.map((z) => z.san)]
    a.zuege.forEach((z, j) => satz(z.satz, [...main.slice(0, a.ab), ...a.zuege.slice(0, j + 1).map((x) => x.san)], '', `${at}: Ast ${a.id} Zug ${j + 1}`, true))
    satz(a.satz, line, '', `${at}: Ast ${a.id}`, false)
  }
  for (const x of [...sys.idee, ...sys.motive]) {
    status(x.status, `${at}: ${x.id}`)
    satz(x.satz, x.zuege.length ? x.zuege : null, x.fen, `${at}: ${x.id}`, false)
  }
  for (const m of sys.motive) for (const r of m.raetsel) {
    const a = `${at}: Rätsel ${m.id}/${r.id}`
    const p = b.raetsel.find((x) => x.id === `${m.id}/${r.id}`)
    problems.push(...pruefeRaetselLoesung(p, a))
    for (const text of [r.hinweis, r.satz]) if (!isTodo(text)) { const w = new Chess(r.fen).turn() === 'w' ? 'white' : 'black'; problems.push(...pruefeBewertungsworte(text, p?.cpLoesung == null ? null : w === 'white' ? p.cpLoesung : -p.cpLoesung, w).map((x) => `${a}: ${x}`)) }
  }
  problems.push(...pruefeMuster(sys.musterpartien.map((m) => ({ id: m.id, pgn: m.zuege.map((z) => z.san).join(' '), kommentare: m.kommentare })), b.musterStellungen ?? [], `${at}`))
  return problems
}
