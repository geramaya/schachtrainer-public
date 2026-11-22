// npm run lehrgang:daten -- <token-file>   (or LICHESS_TOKEN_FILE=<token-file>)
// npm run lehrgang:daten -- --cache         (re-derives trees and tiers from tools/.cache/lehrgang-explorer.json, no token, no network; keeps the date of the fetch)
// Fetches the reply frequencies of the Lichess explorer (band 1200-1600) for the repertoire lines of the three Lehrgaenge
// and writes content-src/lehrgaenge/<id>/daten.json (+ merges tier/share into varianten.json). The token content is never printed.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { positionKey } from '../src/chess/position.ts'
import type { ContentBundle } from '../src/content/types.ts'
import { lichessExplorer } from './lib/explorer.ts'
import { LEHRGANG_BASE, cacheReplies, erzeugeDaten } from './lib/lehrgang-daten.ts'

const ROOT = new URL('../content-src/lehrgaenge/', import.meta.url).pathname
const BUNDLE = new URL('../public/content/bundle.json', import.meta.url).pathname
const CACHE = new URL('./.cache/lehrgang-explorer.json', import.meta.url).pathname

const fromCache = process.argv[2] === '--cache'
const tokenFile = process.argv[2] ?? process.env.LICHESS_TOKEN_FILE
if (!fromCache && (!tokenFile || !existsSync(tokenFile))) { console.error('Token-Datei fehlt: npm run lehrgang:daten -- <token-datei>  (oder --cache)'); process.exit(2) }
if (!existsSync(BUNDLE)) { console.error('public/content/bundle.json fehlt (npm run content): die eigenen Züge kommen aus dem Repertoire-Baum.'); process.exit(2) }

const bundle = JSON.parse(readFileSync(BUNDLE, 'utf8')) as ContentBundle
const explorer = fromCache ? null : lichessExplorer({ tokenFile, cacheFile: CACHE, base: LEHRGANG_BASE })
const abrufOf = (dir: string) => (fromCache ? (JSON.parse(readFileSync(join(dir, 'daten.json'), 'utf8')) as { abruf: string }).abruf : new Date().toISOString().slice(0, 10))

try {
  for (const id of readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    const tree = bundle.trees[id] ?? {}
    const ownMove = (fen: string) => { const n = tree[positionKey(fen)]; return n?.ownMove ? (n.candidates[n.active]?.uci ?? null) : null }
    const r = await erzeugeDaten({ dir: join(ROOT, id), abruf: abrufOf(join(ROOT, id)), ownMove, replies: explorer ? (fen) => explorer.moves(fen) : cacheReplies(CACHE) })
    console.log(`${id}: ${r.varianten} Varianten, Abdeckung ${(r.abdeckung * 100).toFixed(1)} %, ${r.luecken} Lücken (keine eigene Antwort im Repertoire)`)
  }
} finally {
  if (explorer) {
    explorer.flush()
    const s = explorer.status()
    console.log(`Explorer: ${s.requests} Anfragen, ${s.cached} aus dem Cache, ${s.failed} fehlgeschlagen${s.lastError ? ` (${s.lastError})` : ''}`)
  }
}
