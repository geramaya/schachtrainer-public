// npm run lehrgang:tiefe: continues the Kern varieties of every Lehrgang beyond the data limit (content-src/lehrgaenge/<id>/varianten.json).
// Own moves: repertoire tree (public/content/bundle.json); opponent: most frequent explorer move from the CACHE (tools/.cache/lehrgang-explorer.json,
// at least 10 games, no network), else the Stockfish best move (depth 18). The added moves are marked neu with a TODO sentence; every move gets its origin.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { positionKey } from '../src/chess/position.ts'
import type { ContentBundle } from '../src/content/types.ts'
import { normalizeCastling } from './lib/explorer.ts'
import type { ExplorerMove } from './lib/explorer.ts'
import { EVAL_DEPTH } from './lib/intro-facts.ts'
import type { VarianteSrc } from './lib/lehrgang-build.ts'
import { erweitereVariante, verlaengereLinie } from './lib/lehrgang-tiefe.ts'
import { cachedEngine } from './lib/analysis-cache.ts'
import { nodeEngine } from './lib/node-engine.ts'
import { writeAtomic } from './lib/sources.ts'

/** Target length in plies (the owner asked for 20 to 24; the data limit is 20). */
const ZIEL_PLY = 24
const MIN_PARTIEN = 10
const ROOT = new URL('../content-src/lehrgaenge/', import.meta.url).pathname
const CACHE = new URL('./.cache/lehrgang-analysis.json', import.meta.url).pathname
const EXPLORER = new URL('./.cache/lehrgang-explorer.json', import.meta.url).pathname
const bundle = JSON.parse(readFileSync(new URL('../public/content/bundle.json', import.meta.url), 'utf8')) as ContentBundle
const store = JSON.parse(readFileSync(EXPLORER, 'utf8')) as Record<string, ExplorerMove[]>
const read = <T>(f: string): T => JSON.parse(readFileSync(f, 'utf8')) as T
const only = process.argv.slice(2)

const engine = cachedEngine(await nodeEngine(), CACHE)
try {
  for (const id of readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    if (only.length && !only.includes(id)) continue
    const dir = join(ROOT, id)
    const meta = read<{ side: 'white' | 'black' }>(join(dir, 'lehrgang.json'))
    const tree = bundle.trees[id] ?? {}
    const ownMove = (fen: string) => { const n = tree[positionKey(fen)]; return n?.ownMove ? (n.candidates[n.active]?.uci ?? null) : null }
    const explorer = (fen: string) => store[fen]?.map((m) => ({ ...m, uci: normalizeCastling(fen, m.uci) })) ?? null
    const engineBest = async (fen: string) => (await engine.analyse(fen, { depth: EVAL_DEPTH, multipv: 1 })).bestUci || null
    const out: VarianteSrc[] = []
    const count = { daten: 0, repertoire: 0, engine: 0 }
    for (const v of read<VarianteSrc[]>(join(dir, 'varianten.json'))) {
      if (v.stufe !== 'kern' || v.veraltet || v.vorlaeufig) { out.push(v); continue }
      const ext = await verlaengereLinie({ line: v.zuege.map((z) => z.san), side: meta.side, zielPly: ZIEL_PLY, minPartien: MIN_PARTIEN, ownMove, explorer, engineBest })
      for (const e of ext) count[e.herkunft]++
      out.push(erweitereVariante(v, ext, meta.side))
      console.log(`${id} ${v.id}: ${v.zuege.length} -> ${v.zuege.length + ext.length} Halbzüge (${ext.map((e) => e.herkunft[0]).join('') || '-'})`)
    }
    writeAtomic(join(dir, 'varianten.json'), JSON.stringify(out, null, 1) + '\n')
    console.log(`${id}: neue Züge ${JSON.stringify(count)}`)
  }
} finally { engine.flush() }
engine.dispose()
