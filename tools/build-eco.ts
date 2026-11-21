// Builds public/eco/eco.json (ECO code and opening name per position) from the chess-openings TSV files in tools/.cache
// (loaded by `npm run content`; Lichess chess-openings, CC0). The names stay the original English ones, complete and unchanged.
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { ecoEntriesFromTsv } from '../src/openings/eco.ts'
import { writeAtomic } from './lib/sources.ts'

const CACHE = new URL('./.cache/', import.meta.url)
const OUT = new URL('../public/eco/eco.json', import.meta.url)

const files = ['a', 'b', 'c', 'd', 'e'].map((f) => new URL(`${f}.tsv`, CACHE))
const missing = files.filter((f) => !existsSync(f))
if (missing.length) {
  console.error(`chess-openings TSV missing in tools/.cache (${missing.length} of 5): run "npm run content" once to load it.`)
  process.exit(1)
}
const entries = files.flatMap((f) => ecoEntriesFromTsv(readFileSync(f, 'utf8')))
mkdirSync(new URL('../public/eco/', import.meta.url), { recursive: true })
writeAtomic(OUT.pathname, JSON.stringify({ version: 1, source: 'lichess-org/chess-openings (CC0)', entries }) + '\n')
console.log(`eco.json: ${entries.length} positions, ${statSync(OUT).size} bytes`)
