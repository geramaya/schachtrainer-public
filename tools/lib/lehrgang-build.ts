import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Chess } from 'chess.js'
import { frequencyText } from '../../src/lehrgang/frequency.ts'
import { NAMES_DE } from '../../content-src/names-de.ts'
import type { EcoTable } from '../../src/openings/eco.ts'
import { leiteNamen, wurzelName } from './lehrgang-namen.ts'
import { PLAN_SECTIONS, STUFEN, TODO, isTodo } from '../../src/lehrgang/types.ts'
import type { Falle, Herkunft, Lehrgang, Merksatz, Musterpartie, Stufe, System, Variante } from '../../src/lehrgang/types.ts'
import { stellungsSchluessel } from './lehrgang-stellungen.ts'
import { baueSystem, systemTexte } from './lehrgang-system.ts'
import type { SystemSrc } from './lehrgang-system.ts'

export { TODO }

/** varianten.json as written by hand and by the data run (uci, frequency text and tier text are added by the build). */
export interface VarianteSrc { id: string; name: string; stufe: Stufe; anteil: number | null; vorlaeufig?: true; veraltet?: true; zuege: { san: string; satz: string; herkunft?: Herkunft; neu?: true }[]; ziel?: ZielSrc[] }
import { checkMuster, infos, pruefeMarken } from './lehrgang-marken.ts'
import type { InfosSrc, KommentarSrc, MusterSrc, ZielSrc } from './lehrgang-marken.ts'

export type { InfosSrc, KommentarSrc, MusterSrc, ZielSrc }
export const ZIEL_MIN = 2
export const ZIEL_MAX = 3
/** stellungen.json: one sentence per position+move (key see stellungsSchluessel), `belege` = evidence keys of the intro checker. */
export type StellungenFile = Record<string, InfosSrc & { satz: string; status: 'entwurf' | 'geprueft'; belege?: string[] }>
export interface DatenVariante { id: string; line: string[]; anteil: number; stufe: Stufe }

/** systeme/<id>/system.json of a Lehrgang folder, sorted by folder name. */
export function ladeSysteme(dir: string): SystemSrc[] {
  const sd = join(dir, 'systeme')
  if (!existsSync(sd)) return []
  return readdirSync(sd, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(sd, d.name, 'system.json'))).map((d) => d.name).sort().map((n) => read<SystemSrc>(join(sd, n, 'system.json')))
}

const read = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T

/** Keeps every written sentence; the data run only owns tier and share. Seeds (vorlaeufig) without data disappear, written varieties without data are flagged veraltet, never deleted. */
export function mergeVarianten(old: VarianteSrc[], data: DatenVariante[]): VarianteSrc[] {
  const byId = new Map(old.map((v) => [v.id, v]))
  const seen = new Set(data.map((d) => d.id))
  const merged: VarianteSrc[] = data.map((d) => {
    const o = byId.get(d.id)
    if (o) { const { vorlaeufig: _v, veraltet: _a, ...rest } = o; return { ...rest, stufe: d.stufe, anteil: d.anteil } }
    return { id: d.id, name: TODO, stufe: d.stufe, anteil: d.anteil, zuege: d.line.map((san) => ({ san, satz: TODO })) }
  })
  for (const o of old) if (!seen.has(o.id) && !o.vorlaeufig) merged.push({ ...o, veraltet: true })
  return merged
}

function pruefeStellungsMarken(stellungen: StellungenFile, where: string, fehler: string[]) {
  for (const [key, s] of Object.entries(stellungen)) {
    if (!s.pfeile && !s.felder) continue
    const cut = key.lastIndexOf('|')
    const g = new Chess()
    try { g.load(`${key.slice(0, cut)} 0 1`); g.move(key.slice(cut + 1)) } catch { fehler.push(`${where}/stellungen.json ${key}: Stellung oder Zug nicht lesbar, Marken nicht prüfbar`); continue }
    fehler.push(...pruefeMarken(s, [g], `${where}/stellungen.json ${key}`))
  }
}

function parsePlan(md: string, where: string, fehler: string[]): { titel: string; text: string }[] {
  const parts = md.split(/^## /m).slice(1).map((p) => { const [h, ...rest] = p.split('\n'); return { titel: h!.trim(), text: rest.join('\n').trim() } })
  const out = PLAN_SECTIONS.map((t) => parts.find((p) => p.titel === t))
  PLAN_SECTIONS.forEach((t, i) => { if (!out[i]) fehler.push(`${where}/spielplan.md: Abschnitt "${t}" fehlt`) })
  return out.filter((x): x is { titel: string; text: string } => !!x)
}

function checkVariante(v: VarianteSrc, entry: string[], where: string, fehler: string[], stellungen: StellungenFile): Variante | null {
  const at = `${where}/${v.id}`
  if (!STUFEN.includes(v.stufe)) fehler.push(`${at}: Stufe "${v.stufe}" unbekannt`)
  if (entry.some((s, i) => v.zuege[i]?.san !== s)) fehler.push(`${at}: Zugfolge beginnt nicht mit dem Einstieg ${entry.join(' ')}`)
  const c = new Chess()
  const zuege = []
  for (const [i, z] of v.zuege.entries()) {
    const hit = stellungen[stellungsSchluessel(c.fen(), z.san)]
    try { const m = c.move(z.san); zuege.push({ san: m.san, uci: m.from + m.to + (m.promotion ?? ''), satz: hit?.satz ?? z.satz, ...(hit ? { status: hit.status, ...infos(hit) } : {}), ...(z.herkunft ? { herkunft: z.herkunft } : {}), ...(z.neu ? { neu: true as const } : {}) }) } catch { fehler.push(`${at}: Zug ${i + 1} "${z.san}" ist nicht legal`); return null }
    if (typeof z.satz !== 'string' || z.satz.trim() === '') fehler.push(`${at}: Zug ${i + 1} ohne Satz (Platzhalter ${TODO} verwenden)`)
  }
  const ziel = v.ziel ?? []
  if (ziel.length && (ziel.length < ZIEL_MIN || ziel.length > ZIEL_MAX)) fehler.push(`${at}: ziel braucht ${ZIEL_MIN} bis ${ZIEL_MAX} Merksätze (es sind ${ziel.length})`)
  const merksaetze: Merksatz[] = ziel.map((z) => ({ satz: z.satz, ...(z.status ? { status: z.status } : {}), ...(infos(z).quelle ? { quelle: infos(z).quelle } : {}) }))
  return { id: v.id, name: v.name, stufe: v.stufe, anteil: v.anteil, haeufigkeit: v.anteil === null ? null : frequencyText(v.anteil), vorlaeufig: !!v.vorlaeufig, veraltet: !!v.veraltet, zuege, ziel: merksaetze }
}

function checkFalle(f: Falle & InfosSrc & { loesungUci?: string }, where: string, fehler: string[]): Falle | null {
  const at = `${where}/${f.id}`
  let c: Chess
  try { c = new Chess(f.fen) } catch { fehler.push(`${at}: Stellung (FEN) ist ungültig`); return null }
  try {
    const vorher = new Chess(f.fen)
    const m = c.move(f.loesung)
    const { pfeile: _p, felder: _f, quelle: _q, ...rest } = f
    fehler.push(...pruefeMarken(f, [vorher, c], at))
    return { ...rest, ...infos(f), loesungUci: m.from + m.to + (m.promotion ?? ''), platzhalter: !!f.platzhalter }
  } catch { fehler.push(`${at}: Lösungszug "${f.loesung}" ist in der Stellung nicht legal`); return null }
}

/** Builds every Lehrgang folder under `root`; all problems are collected (with the place), nothing is silently skipped. */
export function buildLehrgaenge(root: string, opts: { eco?: EcoTable; namesDe?: Record<string, string> } = {}): { lehrgaenge: Lehrgang[]; fehler: string[] } {
  const fehler: string[] = []
  const lehrgaenge: Lehrgang[] = []
  const ids = existsSync(root) ? readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort() : []
  for (const id of ids) {
    const dir = join(root, id)
    const meta = read<{ id: string; name: string; side: 'white' | 'black'; entry: string[]; band: string }>(join(dir, 'lehrgang.json'))
    const daten = existsSync(join(dir, 'daten.json')) ? read<{ abruf?: string }>(join(dir, 'daten.json')) : null
    const spielplan = parsePlan(readFileSync(join(dir, 'spielplan.md'), 'utf8'), id, fehler)
    const stellungen = existsSync(join(dir, 'stellungen.json')) ? read<StellungenFile>(join(dir, 'stellungen.json')) : {}
    pruefeStellungsMarken(stellungen, id, fehler)
    const varianten = read<VarianteSrc[]>(join(dir, 'varianten.json')).map((v) => checkVariante(v, meta.entry, id, fehler, stellungen)).filter((v): v is Variante => !!v)
    const muster = (existsSync(join(dir, 'musterpartien.json')) ? read<MusterSrc[]>(join(dir, 'musterpartien.json')) : []).map((m) => checkMuster(m, id, fehler)).filter((m): m is Musterpartie => !!m)
    const fallen = read<Falle[]>(join(dir, 'fallen.json')).map((f) => checkFalle(f, id, fehler)).filter((f): f is Falle => !!f)
    const systeme = ladeSysteme(dir).map((src) => baueSystem(src, id, fehler)).filter((x): x is System => !!x)
    if (opts.eco) {
      const namen = leiteNamen(varianten, opts.eco, opts.namesDe ?? NAMES_DE, wurzelName(opts.eco, meta.entry) ?? undefined)
      for (const v of varianten) if (isTodo(v.name) && namen.has(v.id)) v.name = namen.get(v.id)!
    }
    varianten.sort((a, b) => (b.anteil ?? -1) - (a.anteil ?? -1))
    const texte = [...spielplan.map((s) => s.text), ...varianten.flatMap((v) => [v.name, ...v.zuege.map((z) => z.satz), ...v.ziel.map((z) => z.satz)]), ...muster.flatMap((m) => m.kommentare.map((k) => k.satz)), ...fallen.flatMap((f) => [f.titel, f.satz]), ...systeme.flatMap(systemTexte)]
    lehrgaenge.push({ id: meta.id, name: meta.name, side: meta.side, entry: meta.entry, band: meta.band, abruf: daten?.abruf ?? null, spielplan, varianten, fallen, musterpartien: muster, ...(systeme.length ? { systeme } : {}), offen: texte.filter(isTodo).length })
  }
  return { lehrgaenge, fehler }
}
