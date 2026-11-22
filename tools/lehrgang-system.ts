// npm run lehrgang:system -- <lehrgang> <system> "<system line, SAN>" ["<Name>"]: writes the scaffold content-src/lehrgaenge/<lehrgang>/systeme/<system>/system.json
// with placeholders (TODO texter) for the author. Main line to ply 30 (own moves: repertoire in public/content/bundle.json, else engine; opponent: most frequent
// cached explorer move with >= 10 games, else Stockfish), the 3 most frequent opponent deviations as branches, puzzle candidates from the Lichess puzzle
// database (CC0, tools/.cache/lichess_db_puzzle.csv.zst, opening tag Caro-Kann_Defense_Advance*, rating 1200-1600). Never overwrites an existing system.json.
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { positionKey } from '../src/chess/position.ts'
import type { ContentBundle } from '../src/content/types.ts'
import { normalizeCastling } from './lib/explorer.ts'
import type { ExplorerMove } from './lib/explorer.ts'
import { EVAL_DEPTH } from './lib/intro-facts.ts'
import type { VarianteSrc } from './lib/lehrgang-build.ts'
import { baueGeruest, RATING_MAX, RATING_MIN, waehleKandidaten } from './lib/lehrgang-geruest.ts'
import { cachedEngine } from './lib/analysis-cache.ts'
import { nodeEngine } from './lib/node-engine.ts'
import { streamPuzzles } from './lib/puzzles.ts'
import { writeAtomic } from './lib/sources.ts'

const [lehrgang, systemId, linie, titel] = process.argv.slice(2)
if (!lehrgang || !systemId || !linie) { console.error('Aufruf: npm run lehrgang:system -- <lehrgang> <system> "e4 c6 d4 d5 e5 Bf5"'); process.exit(2) }
const ZIEL_PLY = 30
const MIN_PARTIEN = 10
const KANDIDATEN = 24
const TAG = 'Caro-Kann_Defense_Advance'
const dir = new URL(`../content-src/lehrgaenge/${lehrgang}/`, import.meta.url).pathname
const ziel = join(dir, 'systeme', systemId, 'system.json')
if (existsSync(ziel)) { console.error(`${ziel} existiert schon (geschriebene Texte werden nie überschrieben).`); process.exit(1) }
const read = <T>(f: string): T => JSON.parse(readFileSync(f, 'utf8')) as T
const meta = read<{ side: 'white' | 'black' }>(join(dir, 'lehrgang.json'))
const bundle = read<ContentBundle>(new URL('../public/content/bundle.json', import.meta.url).pathname)
const store = read<Record<string, ExplorerMove[]>>(new URL('./.cache/lehrgang-explorer.json', import.meta.url).pathname)
const tree = bundle.trees[lehrgang] ?? {}
const zuege = linie.split(/\s+/).filter(Boolean)

const puzzles = await streamPuzzles((p) => p.rating >= RATING_MIN && p.rating <= RATING_MAX && p.openingTags.some((t) => t.startsWith(TAG)), 200)
const kandidaten = waehleKandidaten(puzzles, KANDIDATEN)
const standIns = read<VarianteSrc[]>(join(dir, 'varianten.json')).filter((v) => !v.veraltet && !v.vorlaeufig && zuege.every((s, i) => v.zuege[i]?.san === s)).map((v) => v.zuege.map((z) => z.san)).sort((a, b) => b.length - a.length)

const engine = cachedEngine(await nodeEngine(), new URL('./.cache/lehrgang-analysis.json', import.meta.url).pathname)
try {
  const system = await baueGeruest({
    id: systemId, titel, zuege, side: meta.side, zielPly: ZIEL_PLY, minPartien: MIN_PARTIEN, anzahlAeste: 3, kandidaten, musterQuellen: standIns.slice(0, 1),
    ownMove: (fen) => { const n = tree[positionKey(fen)]; return n?.ownMove ? (n.candidates[n.active]?.uci ?? null) : null },
    explorer: (fen) => store[fen]?.map((m) => ({ ...m, uci: normalizeCastling(fen, m.uci) })) ?? null,
    engineBest: async (fen) => (await engine.analyse(fen, { depth: EVAL_DEPTH, multipv: 1 })).bestUci || null,
  })
  mkdirSync(dirname(ziel), { recursive: true })
  writeAtomic(ziel, JSON.stringify(system, null, 1) + '\n')
  const herkunft = system.hauptlinie.zuege.reduce<Record<string, number>>((n, z) => ({ ...n, [z.herkunft ?? '?']: (n[z.herkunft ?? '?'] ?? 0) + 1 }), {})
  console.log(`${ziel}: Hauptlinie ${system.hauptlinie.zuege.length} Halbzüge ${JSON.stringify(herkunft)}, ${system.hauptlinie.aeste.length} Äste, ${system.motive.length} Motive, ${system.motive.reduce((n, m) => n + m.raetsel.length, 0)} Rätsel-Platzhalter, ${system.musterpartien.length} Musterpartien, ${kandidaten.length} Kandidaten`)
} finally { engine.flush() }
engine.dispose()
