// Writes content-src/intro-facts/<openingId>.json for every opening of public/content/bundle.json: observed facts per
// variation (line, branch, Stockfish values, opponent move frequencies, end position, document excerpt), no wording.
// Offline: reads only tools/.cache/analysis.json, tools/.cache/explorer.json, docs/repertoire-v1.8.md. Deterministic.
// Usage: node tools/intro-facts.ts [bundle path]
import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { ContentBundle } from '../src/content/types.ts'
import { docExcerpt, introFacts } from './lib/intro-facts.ts'
import type { FactsFile } from './lib/intro-facts.ts'
import { writeAtomic } from './lib/sources.ts'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))
const bundle = JSON.parse(readFileSync(process.argv[2] ?? here('../public/content/bundle.json'), 'utf8')) as ContentBundle
const analysis = JSON.parse(readFileSync(here('./.cache/analysis.json'), 'utf8'))
const explorer = JSON.parse(readFileSync(here('./.cache/explorer.json'), 'utf8'))
const doc = readFileSync(here('../docs/repertoire-v1.8.md'), 'utf8')
const outDir = here('../content-src/intro-facts/')
mkdirSync(outDir, { recursive: true })

for (const o of bundle.openings) {
  const file: FactsFile = { schema: 1, openingId: o.id, dokument: docExcerpt(doc, o.id), varianten: {} }
  for (const v of o.variations) file.varianten[v.id] = introFacts(o, v, { analysis, explorer, dokument: file.dokument }, o.variations)
  writeAtomic(`${outDir}${o.id}.json`, JSON.stringify(file, null, 1) + '\n')
  const n = Object.values(file.varianten)
  console.log(`${o.id}: ${n.length} Faktenblätter, Bewertung am Ende bei ${n.filter((f) => f.bewertung.endbewertung).length}, Gegnerzüge bei ${n.filter((f) => f.gegnerzuege.length).length}, Dokumentzeilen ${file.dokument.length}, im Dokument ${n.filter((f) => f.doc.variantImDokument).length}/${n.length} (identisch ${n.filter((f) => f.doc.bezug === 'identisch').length}, unterhalb ${n.filter((f) => f.doc.bezug === 'unterhalb').length}, teil ${n.filter((f) => f.doc.bezug === 'teil').length})`)
}
