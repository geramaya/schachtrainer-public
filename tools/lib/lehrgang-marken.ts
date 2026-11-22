import { Chess } from 'chess.js'
import type { Square } from 'chess.js'
import { listOf, parseMarke } from '../../src/lehrgang/marks.ts'
import { TODO } from '../../src/lehrgang/types.ts'
import type { Infos, Kommentar, Musterpartie } from '../../src/lehrgang/types.ts'
import { parsePgnZuege } from './lehrgang-muster.ts'

/** The marks as written in the source files: a list or one string with separators (felder ",", quelle " ; "). */
export interface InfosSrc { pfeile?: string | string[]; felder?: string | string[]; quelle?: string | string[] }
/** A sentence of the goal box or a comment of a model game: marks and sources as in stellungen.json, `belege` = evidence keys of the intro checker. */
export interface ZielSrc extends InfosSrc { satz: string; status?: 'entwurf' | 'geprueft'; belege?: string[] }
export interface KommentarSrc extends ZielSrc { ply: number }
/** musterpartien.json: a model game as PGN movetext (English SAN) with comments at turning points. */
export interface MusterSrc { id: string; titel: string; weiss: string; schwarz: string; jahr: number | string; event: string; quelle: string; pgn: string; platzhalter?: true; kommentare: KommentarSrc[] }
/** Lists as the app wants them, empty ones left out. */
export function infos(src: InfosSrc): Infos {
  const out: Infos = {}
  const pfeile = listOf(src.pfeile, ',')
  const felder = listOf(src.felder, ',')
  const quelle = listOf(src.quelle, ';')
  if (pfeile.length) out.pfeile = pfeile
  if (felder.length) out.felder = felder
  if (quelle.length) out.quelle = quelle
  return out
}

/** Arrows need two squares and a piece on the start square in one of the `boards` (a sentence: the position after the move; a trap: before or after the solution, its arrow may be the solution move itself), circles one square. */
export function pruefeMarken(src: InfosSrc, boards: Chess[], at: string): string[] {
  const problems: string[] = []
  for (const code of listOf(src.pfeile, ',')) {
    const m = parseMarke(code)
    if (!m?.dest) problems.push(`${at}: Pfeil "${code}" ist ungültig (Farbe G/R/B/Y, Start- und Zielfeld, z. B. Gd4c6)`)
    else if (!boards.some((b) => b.get(m.orig as Square))) problems.push(`${at}: Pfeil "${code}": Startfeld ${m.orig} ist nach dem Zug leer`)
  }
  for (const code of listOf(src.felder, ',')) {
    const m = parseMarke(code)
    if (!m || m.dest) problems.push(`${at}: Feld "${code}" ist ungültig (Farbe G/R/B/Y und ein Feld, z. B. Rc6)`)
  }
  return problems
}

const filled = (x: unknown): boolean => (typeof x === 'number' ? true : typeof x === 'string' && x.trim() !== '')

export function checkMuster(m: MusterSrc, where: string, fehler: string[]): Musterpartie | null {
  const at = `${where}/musterpartien.json ${m.id}`
  const before = fehler.length
  if (!m.platzhalter) for (const [k, label] of [['titel', 'Titel'], ['weiss', 'Weiß'], ['schwarz', 'Schwarz'], ['jahr', 'Jahr'], ['event', 'Turnier'], ['quelle', 'Quelle']] as const) if (!filled(m[k])) fehler.push(`${at}: ${label} fehlt`)
  const c = new Chess()
  const boards: Chess[] = [new Chess()]
  const zuege: { san: string; uci: string }[] = []
  for (const [i, san] of parsePgnZuege(m.pgn).entries()) {
    try { const mv = c.move(san); zuege.push({ san: mv.san, uci: mv.from + mv.to + (mv.promotion ?? '') }); boards.push(new Chess(c.fen())) } catch { fehler.push(`${at}: Zug ${i + 1} "${san}" ist nicht legal`); break }
  }
  const kommentare: Kommentar[] = []
  for (const k of m.kommentare ?? []) {
    const kat = `${at} Halbzug ${k.ply}`
    if (!Number.isInteger(k.ply) || k.ply < 1 || k.ply > zuege.length) { fehler.push(`${at}: Kommentar an Halbzug ${k.ply} liegt außerhalb der Partie (1 bis ${zuege.length})`); continue }
    if (typeof k.satz !== 'string' || k.satz.trim() === '') fehler.push(`${kat}: Satz fehlt (Platzhalter ${TODO} verwenden)`)
    fehler.push(...pruefeMarken(k, [boards[k.ply]!], kat))
    kommentare.push({ ply: k.ply, satz: k.satz, ...(k.status ? { status: k.status } : {}), ...infos(k) })
  }
  if (fehler.length > before) return null
  return { id: m.id, titel: m.titel, weiss: m.weiss, schwarz: m.schwarz, jahr: m.jahr, event: m.event, quelle: m.quelle, platzhalter: !!m.platzhalter, zuege, kommentare }
}

