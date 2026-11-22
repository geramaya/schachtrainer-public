// npm run lehrgang:aufgaben: one fact sheet per unique position+move of each Lehrgang (content-src/lehrgaenge/<id>/aufgaben.json)
// for the author of the sentences, plus trap candidates. Stockfish depth 18 (tools/lib/node-engine.ts), analyses cached in
// tools/.cache/lehrgang-analysis.json, so a second run is fast. Needs daten.json (npm run lehrgang:daten) and varianten.json.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { docExcerpt, EVAL_DEPTH } from './lib/intro-facts.ts'
import { baueAufgabe, cpWeiss, FALLEN_DEFAULTS, baumFens, benoetigteFens, fallenKandidaten, mitSeltenenZuegen, pfadAnteile } from './lib/lehrgang-aufgaben.ts'
import type { AnalysisStore } from './lib/lehrgang-aufgaben.ts'
import { ladeSysteme } from './lib/lehrgang-build.ts'
import type { VarianteSrc } from './lib/lehrgang-build.ts'
import { baueSystem, raetselFens, raetselPruefung, systemFens, systemMusterStellungen, systemStellungen } from './lib/lehrgang-system.ts'
import type { DatenKnoten } from './lib/lehrgang.ts'
import { eindeutigeStellungen, lueckenSchluessel } from './lib/lehrgang-stellungen.ts'
import { musterStellungen } from './lib/lehrgang-muster.ts'
import type { MusterSrc } from './lib/lehrgang-build.ts'
import { cachedEngine } from './lib/analysis-cache.ts'
import { nodeEngine } from './lib/node-engine.ts'
import { writeAtomic } from './lib/sources.ts'

const ROOT = new URL('../content-src/lehrgaenge/', import.meta.url).pathname
const CACHE = new URL('./.cache/lehrgang-analysis.json', import.meta.url).pathname
const EXPLORER = new URL('./.cache/lehrgang-explorer.json', import.meta.url).pathname
const DOC = readFileSync(new URL('../docs/repertoire-v1.8.md', import.meta.url), 'utf8')
const read = <T>(f: string): T => JSON.parse(readFileSync(f, 'utf8')) as T

const ids = readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()
const EXPLORER_STORE = JSON.parse(readFileSync(EXPLORER, 'utf8')) as Record<string, { uci: string; games: number }[]>
const jobs = ids.map((id) => {
  const dir = join(ROOT, id)
  const meta = read<{ id: string; side: 'white' | 'black'; entry: string[] }>(join(dir, 'lehrgang.json'))
  if (!existsSync(join(dir, 'daten.json'))) throw new Error(`${id}: daten.json fehlt (npm run lehrgang:daten)`)
  const daten = read<{ baum: DatenKnoten[]; varianten: { line: string[]; grund: string }[] }>(join(dir, 'daten.json'))
  const varianten = read<VarianteSrc[]>(join(dir, 'varianten.json')).filter((v) => !v.veraltet && !v.vorlaeufig)
  const stellungen = eindeutigeStellungen(varianten.map((v) => ({ id: v.id, anteil: v.anteil, zuege: v.zuege })), meta.side)
  const muster = existsSync(join(dir, 'musterpartien.json')) ? musterStellungen(read<MusterSrc[]>(join(dir, 'musterpartien.json')), meta.side) : []
  const fallenBaum = mitSeltenenZuegen(daten.baum, meta.entry, EXPLORER_STORE, FALLEN_DEFAULTS.mindestAnteil)
  const systemFehler: string[] = []
  const systeme = ladeSysteme(dir).map((src) => baueSystem(src, id, systemFehler))
  if (systemFehler.length || systeme.some((x) => !x)) throw new Error(`${id}: system.json fehlerhaft (npm run lehrgang:check)\n${systemFehler.join('\n')}`)
  const sysStellungen = systeme.flatMap((x) => systemStellungen(x!, meta.side))
  const sysMuster = systeme.flatMap((x) => systemMusterStellungen(x!, meta.side))
  return { dir, meta, daten, varianten, stellungen, muster, fallenBaum, systeme: systeme as NonNullable<(typeof systeme)[number]>[], sysStellungen, sysMuster }
})

const engine = cachedEngine(await nodeEngine(), CACHE)
try {
  const fens = [...new Set(jobs.flatMap((j) => [...benoetigteFens([...j.stellungen, ...j.muster, ...j.sysStellungen, ...j.sysMuster]), ...j.systeme.flatMap((x) => [...systemFens(x), ...raetselFens(x)]), ...baumFens(j.fallenBaum, j.meta.entry)]))]
  const missing = fens.length
  console.log(`${missing} Stellungen zu bewerten (Tiefe ${EVAL_DEPTH}, bereits im Cache zählt als schnell) …`)
  for (const [i, fen] of fens.entries()) {
    await engine.analyse(fen, { depth: EVAL_DEPTH, multipv: 1 })
    if ((i + 1) % 25 === 0) { engine.flush(); console.log(`  ${i + 1}/${missing}`) }
  }
} finally { engine.flush() }

const analysis = read<AnalysisStore>(CACHE)
const explorer = EXPLORER_STORE
for (const j of jobs) {
  const kern = new Set(j.varianten.filter((v) => v.stufe === 'kern').map((v) => v.id))
  const opening = { id: j.meta.id as never, side: j.meta.side, entry: j.meta.entry, docRef: 'docs/repertoire-v1.8.md' }
  const ctx = { opening, analysis, explorer, dokument: docExcerpt(DOC, j.meta.id), luecken: lueckenSchluessel(j.daten.varianten) }
  const pfad = pfadAnteile(j.daten.baum, j.meta.entry)
  const aufgaben = j.stellungen.map((s) => ({ ...baueAufgabe({ ...s, anteil: pfad.get(s.schluessel) ?? s.anteil }, ctx), kern: s.varianten.some((id) => kern.has(id)) })).sort((a, b) => Number(b.kern) - Number(a.kern) || b.haeufigkeit.anteil - a.haeufigkeit.anteil || a.zugfolge.length - b.zugfolge.length)
  const musterAufgaben = j.muster.map((s) => baueAufgabe(s, ctx))
  const sysAufgaben = j.sysStellungen.map((s) => baueAufgabe(s, ctx))
  const sysMusterAufgaben = j.sysMuster.map((s) => baueAufgabe(s, ctx))
  const systemFenBewertung = Object.fromEntries(j.systeme.flatMap((x) => systemFens(x)).map((fen) => [fen, cpWeiss(analysis, fen)]))
  const systemRaetsel = Object.fromEntries(j.systeme.map((x) => [x.id, { raetsel: raetselPruefung(x, analysis) }]))
  const fallen = fallenKandidaten(j.fallenBaum, j.meta.entry, analysis)
  writeAtomic(join(j.dir, 'aufgaben.json'), JSON.stringify({ schema: 1, lehrgang: j.meta.id, stellungen: aufgaben, musterStellungen: musterAufgaben, systemStellungen: sysAufgaben, systemMuster: sysMusterAufgaben, systemFens: systemFenBewertung, systeme: systemRaetsel, fallenKandidaten: fallen }, null, 1) + '\n')
  console.log(`${j.meta.id}: ${aufgaben.length} Stellungen (davon Kern ${aufgaben.filter((a) => a.kern).length}, neu ${aufgaben.filter((a) => a.neu).length}), ${musterAufgaben.length} Musterpartie-Stellungen, System ${sysAufgaben.length} + ${sysMusterAufgaben.length} Muster, ${fallen.length} Fallen-Kandidaten`)
}

// the wasm engine ends the process when it is terminated, so it is disposed after everything is written
engine.dispose()
