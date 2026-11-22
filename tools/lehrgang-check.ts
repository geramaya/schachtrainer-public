// npm run lehrgang:check: marks (arrows, circles) of every position, evaluation words of sentences and trap texts against the engine number, every written sentence (stellungen.json) against its fact sheet (aufgaben.json) and the Spielplan against the entry line.
// Exit 1 with the list of offenders; run `npm run lehrgang:aufgaben` first when aufgaben.json is missing or stale.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isTodo } from '../src/lehrgang/types.ts'
import { buildLehrgaenge } from './lib/lehrgang-build.ts'
import { ladeEco } from './lib/lehrgang-namen.ts'
import type { StellungenFile } from './lib/lehrgang-build.ts'
import { pruefeBewertungsworte, pruefeMuster, pruefeSpielplan, pruefeStellungen, pruefeSystem, pruefeZiel } from './lib/lehrgang-check.ts'
import type { RaetselPruefung } from './lib/lehrgang-system.ts'
import { systemTexte } from './lib/lehrgang-system.ts'
import type { Aufgabe } from './lib/lehrgang-aufgaben.ts'
import { eindeutigeStellungen } from './lib/lehrgang-stellungen.ts'
import type { MusterSrc } from './lib/lehrgang-build.ts'

const ROOT = new URL('../content-src/lehrgaenge/', import.meta.url).pathname
const built = buildLehrgaenge(ROOT, { eco: ladeEco(new URL('../public/eco/eco.json', import.meta.url).pathname) })
const problems = [...built.fehler]
let sentences = 0
for (const l of built.lehrgaenge) {
  problems.push(...pruefeSpielplan(l.spielplan, l.entry).map((p) => `${l.id}/${p}`))
  problems.push(...l.fallen.flatMap((f) => pruefeBewertungsworte(f.satz, null, l.side).map((p) => `${l.id}/Falle ${f.titel}: ${p}`)))
  const sf = join(ROOT, l.id, 'stellungen.json')
  const af = join(ROOT, l.id, 'aufgaben.json')
  const needs = existsSync(sf) || !!l.systeme?.length || l.musterpartien.length > 0 || l.varianten.some((v) => v.ziel.length > 0)
  if (!needs) continue
  if (!existsSync(af)) { problems.push(`${l.id}: aufgaben.json fehlt (npm run lehrgang:aufgaben)`); continue }
  const sheets = JSON.parse(readFileSync(af, 'utf8')) as { stellungen: Aufgabe[]; musterStellungen?: Aufgabe[]; systemStellungen?: Aufgabe[]; systemMuster?: Aufgabe[]; systemFens?: Record<string, number | null>; systeme?: Record<string, { raetsel: RaetselPruefung[] }> }
  if (existsSync(sf)) {
    const stellungen = JSON.parse(readFileSync(sf, 'utf8')) as StellungenFile
    sentences += Object.keys(stellungen).length
    problems.push(...pruefeStellungen(stellungen, sheets.stellungen).map((p) => `${l.id}/${p}`))
  }
  const muster = existsSync(join(ROOT, l.id, 'musterpartien.json')) ? (JSON.parse(readFileSync(join(ROOT, l.id, 'musterpartien.json'), 'utf8')) as MusterSrc[]) : []
  sentences += muster.reduce((n, m) => n + m.kommentare.length, 0)
  problems.push(...pruefeMuster(muster, sheets.musterStellungen ?? [], `${l.id}/musterpartien`))
  for (const sys of l.systeme ?? []) {
    sentences += systemTexte(sys).filter((t) => !isTodo(t)).length
    problems.push(...pruefeSystem(sys, { stellungen: sheets.systemStellungen ?? [], fenBewertung: sheets.systemFens ?? {}, raetsel: sheets.systeme?.[sys.id]?.raetsel ?? [], musterStellungen: sheets.systemMuster ?? [] }, l.id))
  }
  const letzte = new Map(eindeutigeStellungen(l.varianten.map((v) => ({ id: v.id, anteil: v.anteil, zuege: v.zuege })), l.side).map((s) => [s.line.join(' '), s.schluessel]))
  for (const v of l.varianten) {
    sentences += v.ziel.length
    const key = letzte.get(v.zuege.map((z) => z.san).join(' '))
    problems.push(...pruefeZiel(v.ziel, sheets.stellungen.find((a) => a.schluessel === key), `${l.id}/${v.id}`))
  }
}
if (problems.length) { console.error(problems.join('\n')); console.error(`${problems.length} Verstöße`); process.exit(1) }
console.log(`lehrgang:check ok (${sentences} Sätze, ${built.lehrgaenge.length} Spielpläne)`)
