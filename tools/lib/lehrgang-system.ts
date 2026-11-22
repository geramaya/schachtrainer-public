import { Chess } from 'chess.js'
import { SYSTEM_IDEE_IDS, SYSTEM_IDEE_TITEL, TODO } from '../../src/lehrgang/types.ts'
import type { Ast, Herkunft, HauptZug, IdeeAbschnitt, Motiv, Raetsel, System } from '../../src/lehrgang/types.ts'
import type { Analysis } from '../../src/engine/service.ts'
import { evalKey } from './lehrgang-aufgaben.ts'
import { musterStellungen } from './lehrgang-muster.ts'
import { stellungsSchluessel } from './lehrgang-stellungen.ts'
import type { Stellung } from './lehrgang-stellungen.ts'
import { checkMuster, infos, pruefeMarken } from './lehrgang-marken.ts'
import type { InfosSrc, MusterSrc, ZielSrc } from './lehrgang-marken.ts'

export { SYSTEM_IDEE_IDS }
export const MUSTER_MIN = 2
export const MUSTER_MAX = 3
export const RAETSEL_MIN = 1
export const RAETSEL_MAX = 2

/** A board in a source file: a FEN, or the moves from the start position; `zuege` wins when both are given. */
export interface BrettSrc extends InfosSrc { fen?: string; zuege?: string[] }
export interface SystemZugSrc extends ZielSrc { san: string; herkunft?: Herkunft; /** Id of the idea section this move serves. */ plan?: string }
export interface IdeeSrc extends BrettSrc { id: string; titel: string; satz: string; status?: 'entwurf' | 'geprueft'; belege?: string[] }
export interface AstSrc { id: string; ab: number; satz: string; anteil: number | null; zuege: SystemZugSrc[] }
export interface RaetselSrc { id: string; fen: string; loesung: string[]; hinweis: string; satz: string; platzhalter?: true; status?: 'entwurf' | 'geprueft'; belege?: string[]; puzzleId?: string; rating?: number; themes?: string[]; url?: string }
export interface MotivSrc extends BrettSrc { id: string; titel: string; satz: string; status?: 'entwurf' | 'geprueft'; belege?: string[]; raetsel: RaetselSrc[] }
/** A Lichess puzzle offered to the author (CC0): `fen` is the position BEFORE the opponent's first move, `moves` = UCI (opponent move, then the solution). Not shown in the app. */
export interface KandidatSrc { puzzleId: string; fen: string; moves: string[]; rating: number; themes: string[]; url: string }
export interface SystemSrc {
  id: string; titel: string
  zuege: string[]
  idee: IdeeSrc[]
  hauptlinie: { zuege: SystemZugSrc[]; aeste: AstSrc[] }
  motive: MotivSrc[]
  musterpartien: MusterSrc[]
  kandidaten?: KandidatSrc[]
}

const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/

/** One move as SAN (English) or UCI, played on `g`; null when it is not legal in the position. */
export function spieleZug(g: Chess, text: string): { san: string; uci: string } | null {
  try {
    const m = UCI.test(text) ? g.move({ from: text.slice(0, 2), to: text.slice(2, 4), promotion: text[4] }) : g.move(text)
    return { san: m.san, uci: m.from + m.to + (m.promotion ?? '') }
  } catch { return null }
}

function brett(src: BrettSrc, standard: string[], at: string, fehler: string[]): { fen: string; zuege: string[]; board: Chess } | null {
  if (src.zuege || !src.fen) {
    const g = new Chess()
    const sans: string[] = []
    for (const [i, z] of (src.zuege ?? standard).entries()) {
      const m = spieleZug(g, z)
      if (!m) { fehler.push(`${at}: Zug ${i + 1} "${z}" der Stellung ist nicht legal`); return null }
      sans.push(m.san)
    }
    return { fen: g.fen(), zuege: sans, board: g }
  }
  try { const g = new Chess(src.fen); return { fen: g.fen(), zuege: [], board: g } } catch { fehler.push(`${at}: Stellung (FEN) ist ungültig`); return null }
}

const satzOk = (text: string, at: string, fehler: string[]) => { if (typeof text !== 'string' || text.trim() === '') fehler.push(`${at}: Satz fehlt (Platzhalter ${TODO} verwenden)`) }

/** A line of moves after `start` (moves already played): every move legal, marks checked on the board after it. */
function zuegeBauen(zuege: SystemZugSrc[], start: string[], label: string, at: string, fehler: string[]): HauptZug[] | null {
  const g = new Chess()
  for (const s of start) g.move(s)
  const out: HauptZug[] = []
  for (const [i, z] of zuege.entries()) {
    const m = spieleZug(g, z.san)
    const a = `${at}: ${label} Zug ${i + 1}`
    if (!m) { fehler.push(`${a} "${z.san}" ist nicht legal`); return null }
    satzOk(z.satz, a, fehler)
    if (z.plan !== undefined && !(SYSTEM_IDEE_IDS as readonly string[]).includes(z.plan)) fehler.push(`${a}: plan "${z.plan}" ist kein Abschnitt der Idee (${SYSTEM_IDEE_IDS.join(', ')})`)
    fehler.push(...pruefeMarken(z, [new Chess(g.fen())], a))
    out.push({ san: m.san, uci: m.uci, satz: z.satz, ...(z.status ? { status: z.status } : {}), ...infos(z), ...(z.herkunft ? { herkunft: z.herkunft } : {}), ...(z.plan ? { plan: z.plan } : {}) })
  }
  return out
}

function raetselBauen(r: RaetselSrc, at: string, fehler: string[]): Raetsel | null {
  const a = `${at}: Rätsel ${r.id}`
  let g: Chess
  try { g = new Chess(r.fen) } catch { fehler.push(`${a}: Stellung (FEN) ist ungültig`); return null }
  if (!Array.isArray(r.loesung) || r.loesung.length === 0) { fehler.push(`${a}: Lösung fehlt`); return null }
  const loesung: string[] = []
  const loesungUci: string[] = []
  for (const [i, t] of r.loesung.entries()) {
    const m = spieleZug(g, t)
    if (!m) { fehler.push(`${a}: Lösungszug ${i + 1} "${t}" ist nicht legal`); return null }
    loesung.push(m.san); loesungUci.push(m.uci)
  }
  if (typeof r.hinweis !== 'string' || r.hinweis.trim() === '') fehler.push(`${a}: Hinweis fehlt (Platzhalter ${TODO} verwenden)`)
  satzOk(r.satz, a, fehler)
  return { id: r.id, fen: r.fen, loesung, loesungUci, hinweis: r.hinweis, satz: r.satz, platzhalter: !!r.platzhalter, ...(r.puzzleId ? { puzzleId: r.puzzleId, rating: r.rating, themes: r.themes, url: r.url } : {}) }
}

function kandidatPruefen(k: KandidatSrc, at: string, fehler: string[]) {
  let g: Chess
  try { g = new Chess(k.fen) } catch { fehler.push(`${at}: Kandidat ${k.puzzleId}: Stellung (FEN) ist ungültig`); return }
  for (const [i, u] of k.moves.entries()) if (!spieleZug(g, u)) { fehler.push(`${at}: Kandidat ${k.puzzleId}: Zug ${i + 1} "${u}" ist nicht legal`); return }
}

/** Builds one system.json: collects every problem with its place, returns null when anything is wrong. */
export function baueSystem(s: SystemSrc, where: string, fehler: string[]): System | null {
  const at = `${where}/systeme/${s.id}`
  const before = fehler.length
  const planIds: readonly string[] = SYSTEM_IDEE_IDS
  const sys = new Chess()
  for (const [i, z] of s.zuege.entries()) if (!spieleZug(sys, z)) { fehler.push(`${at}: Systemlinie Zug ${i + 1} "${z}" ist nicht legal`); return null }

  if (s.idee.length !== planIds.length || s.idee.some((a, i) => a.id !== planIds[i])) fehler.push(`${at}: idee: Abschnitte müssen ${planIds.join(', ')} heißen (in dieser Reihenfolge)`)
  const idee: IdeeAbschnitt[] = []
  for (const a of s.idee) {
    const ia = `${at}: idee ${a.id}`
    const b = brett(a, s.zuege, ia, fehler)
    satzOk(a.satz, ia, fehler)
    if (!b) continue
    fehler.push(...pruefeMarken(a, [b.board], ia))
    idee.push({ id: a.id, titel: a.titel || SYSTEM_IDEE_TITEL[a.id as keyof typeof SYSTEM_IDEE_TITEL] || a.id, satz: a.satz, ...(a.status ? { status: a.status } : {}), fen: b.fen, zuege: b.zuege, ...infos(a) })
  }

  const main = s.hauptlinie.zuege
  if (s.zuege.some((z, i) => main[i]?.san !== z)) fehler.push(`${at}: hauptlinie beginnt nicht mit der Systemlinie ${s.zuege.join(' ')}`)
  else if (main.length <= s.zuege.length) fehler.push(`${at}: hauptlinie ist nicht länger als die Systemlinie`)
  const hz = zuegeBauen(main, [], 'hauptlinie', at, fehler)
  const aeste: Ast[] = []
  for (const a of s.hauptlinie.aeste) {
    const aa = `${at}: Ast ${a.id}`
    if (!hz || !Number.isInteger(a.ab) || a.ab < s.zuege.length || a.ab >= hz.length) { fehler.push(`${aa}: ab ${a.ab} liegt außerhalb der Hauptlinie (${s.zuege.length} bis ${(hz?.length ?? 0) - 1})`); continue }
    if (!a.zuege.length) { fehler.push(`${aa}: ohne Züge`); continue }
    satzOk(a.satz, aa, fehler)
    const z = zuegeBauen(a.zuege, hz.slice(0, a.ab).map((x) => x.san), `Ast ${a.id}`, at, fehler)
    if (!z) continue
    if (z[0]!.uci === hz[a.ab]!.uci) { fehler.push(`${aa}: weicht nicht von der Hauptlinie ab (${z[0]!.san})`); continue }
    aeste.push({ id: a.id, ab: a.ab, satz: a.satz, anteil: a.anteil, zuege: z })
  }

  const motive: Motiv[] = []
  for (const m of s.motive) {
    const ma = `${at}: Motiv ${m.id}`
    satzOk(m.satz, ma, fehler)
    const b = brett(m, s.zuege, ma, fehler)
    if (m.raetsel.length < RAETSEL_MIN || m.raetsel.length > RAETSEL_MAX) fehler.push(`${ma}: 1 bis 2 Rätsel (es sind ${m.raetsel.length})`)
    const raetsel = m.raetsel.map((r) => raetselBauen(r, ma, fehler)).filter((r): r is Raetsel => !!r)
    if (!b) continue
    fehler.push(...pruefeMarken(m, [b.board], ma))
    motive.push({ id: m.id, titel: m.titel, satz: m.satz, ...(m.status ? { status: m.status } : {}), fen: b.fen, zuege: b.zuege, ...infos(m), raetsel })
  }

  if (s.musterpartien.length < MUSTER_MIN || s.musterpartien.length > MUSTER_MAX) fehler.push(`${at}: ${MUSTER_MIN} bis ${MUSTER_MAX} Musterpartien (es sind ${s.musterpartien.length})`)
  const muster = s.musterpartien.map((m) => checkMuster(m, at, fehler)).filter((m): m is NonNullable<typeof m> => !!m)
  for (const k of s.kandidaten ?? []) kandidatPruefen(k, at, fehler)

  if (fehler.length > before || !hz) return null
  return { id: s.id, titel: s.titel, zuege: s.zuege, idee, hauptlinie: { zuege: hz, aeste }, motive, musterpartien: muster }
}

/** Every authored text of a system (what the build counts as open while it is a placeholder). Model-game titles are not counted, only comments, as for model games elsewhere. */
export function systemTexte(s: System): string[] {
  const zuege = [...s.hauptlinie.zuege, ...s.hauptlinie.aeste.flatMap((a) => a.zuege)].map((z) => z.satz)
  return [s.titel, ...s.idee.map((a) => a.satz), ...zuege, ...s.hauptlinie.aeste.map((a) => a.satz), ...s.motive.flatMap((m) => [m.titel, m.satz, ...m.raetsel.flatMap((r) => [r.hinweis, r.satz])]), ...s.musterpartien.flatMap((m) => m.kommentare.map((k) => k.satz))]
}

const sansOf = (zuege: { san: string }[]) => zuege.map((z) => z.san)

/** Key (position before the last move, that move) of a line: the unit sentences and fact sheets are kept per. */
export function linienSchluessel(line: string[]): string {
  const g = new Chess()
  line.slice(0, -1).forEach((x) => g.move(x))
  return stellungsSchluessel(g.fen(), line[line.length - 1]!)
}

/** Every line of the system that ends in a move: main line, branches, idea and motif boards given by moves. */
function linien(s: System): string[][] {
  const main = sansOf(s.hauptlinie.zuege)
  return [
    ...main.map((_m, i) => main.slice(0, i + 1)),
    ...s.hauptlinie.aeste.flatMap((a) => a.zuege.map((_z, j) => [...main.slice(0, a.ab), ...sansOf(a.zuege.slice(0, j + 1))])),
    ...[...s.idee, ...s.motive].filter((b) => b.zuege.length > 0).map((b) => b.zuege),
  ]
}

/** The positions+moves of a system (each once) that need a fact sheet; boards given only as FEN have none (see systemFens). */
export function systemStellungen(s: System, side: 'white' | 'black'): Stellung[] {
  const out = new Map<string, Stellung>()
  for (const line of linien(s)) {
    const g = new Chess()
    line.slice(0, -1).forEach((x) => g.move(x))
    const san = line[line.length - 1]!
    const schluessel = stellungsSchluessel(g.fen(), san)
    const ply = line.length - 1
    const zieher = ply % 2 === 0 ? 'white' : 'black'
    if (!out.has(schluessel)) out.set(schluessel, { schluessel, fenVorher: g.fen(), san: g.move(san).san, line, ply, zieher, eigen: zieher === side, varianten: [`system:${s.id}`], anteil: 0 })
  }
  return [...out.values()]
}

/** Commented plies of the model games of a system (same unit as for model games of a Lehrgang). */
export const systemMusterStellungen = (s: System, side: 'white' | 'black'): Stellung[] => musterStellungen(s.musterpartien.map((m) => ({ id: m.id, pgn: sansOf(m.zuege).join(' '), kommentare: m.kommentare })), side)

/** Boards without moves (only a FEN): their sentences can only be checked against the evaluation of that position. */
export function systemFens(s: System): string[] {
  return [...new Set([...s.idee, ...s.motive].filter((b) => b.zuege.length === 0).map((b) => b.fen).concat(s.motive.flatMap((m) => m.raetsel.map((r) => r.fen))))]
}

/** Positions the engine has to evaluate for the puzzles: the start and the position after the first solution move (not when that ends the game). */
export function raetselFens(s: System): string[] {
  return [...new Set(s.motive.flatMap((m) => m.raetsel.flatMap((r) => { const g = new Chess(r.fen); g.move(r.loesung[0]!); return g.isGameOver() ? [r.fen] : [r.fen, g.fen()] })))]
}

/** What the engine says about a puzzle (centipawns from the solver's view): the best move and the value of the first solution move. */
export interface RaetselPruefung { id: string; fen: string; loesungUci: string; bestUci: string | null; cpBest: number | null; cpLoesung: number | null; mattBest: boolean; mattLoesung: boolean }

export function raetselPruefung(s: System, analysis: Record<string, Analysis>): RaetselPruefung[] {
  return s.motive.flatMap((m) => m.raetsel.map((r) => {
    const g = new Chess(r.fen)
    g.move(r.loesung[0]!)
    const vor = analysis[evalKey(r.fen)]
    const nach = analysis[evalKey(g.fen())]?.lines[0]
    const l = vor?.lines[0]
    return {
      id: `${m.id}/${r.id}`, fen: r.fen, loesungUci: r.loesungUci[0]!, bestUci: vor?.bestUci || null,
      cpBest: l && l.mate === null ? l.cp : null,
      cpLoesung: nach && nach.mate === null && nach.cp !== null ? -nach.cp : null,
      mattBest: !!l && l.mate !== null && l.mate > 0,
      mattLoesung: g.isCheckmate() || (!!nach && nach.mate !== null && nach.mate < 0),
    }
  }))
}
