// Adds (or refreshes) the intro text of every variation in public/content/bundle.json without a full rebuild.
// Usage: node tools/add-intros.ts [path] | --check [openingId] | --todo [openingId]   (default public/content/bundle.json; writes in place, atomically)
// Authored texts (content-src/intros/<openingId>.ts) are used when the checker accepts them against content-src/intro-facts/.
// Same function as the build (`withIntros`); the bundle is validated before anything is written, and the content
// version changes only when the content does (same day and same texts give the same version).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { ContentBundle } from '../src/content/types.ts'
import { withIntros } from './lib/intros.ts'
import { loadAuthoredIntros, loadFacts } from './lib/intro-source.ts'
import { introReport } from './lib/intro-report.ts'
import { writeAtomic } from './lib/sources.ts'
import { contentVersion, validateBundle } from './lib/validate.ts'

const flags = process.argv.slice(2).filter((a) => a.startsWith('--'))
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const defaultPath = fileURLToPath(new URL('../public/content/bundle.json', import.meta.url))
const report = flags.includes('--check') || flags.includes('--todo')
const path = report ? defaultPath : (args[0] ?? defaultPath)
const bundle = JSON.parse(readFileSync(path, 'utf8')) as ContentBundle

// --check [openingId]: authored texts against the fact sheets (OK / ABGELEHNT + reason); --todo [openingId]: variations that need a text. Writes nothing.
if (report) {
  const openings = bundle.openings.filter((o) => !args[0] || o.id === args[0])
  if (openings.length === 0) { console.error(`Unbekannte Eröffnung: ${args[0]}`); process.exit(1) }
  for (const o of openings) {
    const authored = await loadAuthoredIntros(o.id)
    const r = introReport(o, o.variations, { authored, facts: loadFacts(o.id) })
    if (flags.includes('--todo')) {
      console.log(`${o.id}: ${r.todo.length} Varianten brauchen einen Text (${r.done.length} schon akzeptiert)`)
      for (const id of r.todo) console.log(`  ${r.done.includes(id) ? 'fertig ' : 'offen  '} ${id}`)
    } else {
      console.log(`${o.id}: ${r.checks.length === 0 ? 'keine geschriebenen Texte' : `${r.checks.length} Texte, ${r.checks.filter((c) => c.ok).length} OK`}`)
      for (const c of r.checks) console.log(`  ${c.ok ? 'OK       ' : 'ABGELEHNT'} ${c.id}${c.ok ? '' : `: ${c.why}`}`)
    }
  }
  process.exit(0)
}
const rejected: string[] = []
for (const o of bundle.openings) o.variations = withIntros(o, o.variations, { authored: await loadAuthoredIntros(o.id), facts: loadFacts(o.id), rejected })
for (const r of rejected) console.error(`Intro-Text nicht übernommen: ${r}`)
const errors = validateBundle(bundle)
if (errors.length) {
  console.error(`Bündel ungültig (${errors.length} Fehler), nichts geschrieben:\n- ${errors.slice(0, 20).join('\n- ')}`)
  process.exit(1)
}
const old = bundle.contentVersion
bundle.contentVersion = contentVersion(bundle, new Date())
writeAtomic(path, JSON.stringify(bundle))
const all = bundle.openings.flatMap((o) => o.variations)
console.log(`${all.length} Varianten, ${all.filter((v) => v.intro?.draft).length} erzeugt (Entwurf), ${all.filter((v) => v.intro && !v.intro.draft).length} geprüft (Sprechtext oder geschrieben), ${rejected.length} geschriebene abgelehnt; Version ${old} -> ${bundle.contentVersion}`)
