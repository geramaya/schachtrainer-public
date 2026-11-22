// npm run lehrgang:build: content-src/lehrgaenge/<id>/ -> public/content/lehrgaenge.json (all move lines legal, else exit 1)
import { buildLehrgaenge } from './lib/lehrgang-build.ts'
import { ladeEco } from './lib/lehrgang-namen.ts'
import { writeAtomic } from './lib/sources.ts'
import { LEHRGANG_SCHEMA } from '../src/lehrgang/types.ts'

const r = buildLehrgaenge(new URL('../content-src/lehrgaenge/', import.meta.url).pathname, { eco: ladeEco(new URL('../public/eco/eco.json', import.meta.url).pathname) })
if (r.fehler.length) { console.error(r.fehler.join('\n')); process.exit(1) }
writeAtomic(new URL('../public/content/lehrgaenge.json', import.meta.url).pathname, JSON.stringify({ schemaVersion: LEHRGANG_SCHEMA, lehrgaenge: r.lehrgaenge }) + '\n')
for (const l of r.lehrgaenge) console.log(`${l.id}: ${l.varianten.length} Varianten, ${l.fallen.length} Fallen, ${l.offen} Texte offen (${l.abruf ? 'Daten vom ' + l.abruf : 'Daten fehlen noch'})`)
