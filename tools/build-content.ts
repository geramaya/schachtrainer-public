// Builds public/content/bundle.json. Usage:
//   node tools/build-content.ts [--only scotch] [--no-explanations] [--depth 18]
//     [--limit-per-variation 40] [--limit-per-opening 300]
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { DEVIATIONS, EXPLANATIONS, QUESTIONS } from '../content-src/explanations.ts'
import { OPENINGS } from '../content-src/openings.ts'
import { BUNDLE_SCHEMA } from '../src/content/types.ts'
import type { ContentBundle, Opening } from '../src/content/types.ts'
import { nodeEngine } from './lib/node-engine.ts'
import { buildTree } from './lib/build-tree.ts'
import { assignPuzzles, puzzleFilter, streamPuzzles, tagPrefixesOf } from './lib/puzzles.ts'
import { cachedEngine } from './lib/analysis-cache.ts'
import { lichessExplorer } from './lib/explorer.ts'
import { goalExplanations } from './lib/goal-explanation.ts'
import { mergeIntoExisting } from './lib/merge-bundle.ts'
import { scopeContent } from './lib/content-scope.ts'
import { withLessonKeys } from './lib/keypositions.ts'
import { loadChessOpenings, writeAtomic } from './lib/sources.ts'
import { contentVersion, validateBundle } from './lib/validate.ts'
import { verifyByOpening } from './lib/verify.ts'
import { withIntros } from './lib/intros.ts'
import { loadAuthoredIntros, loadFacts } from './lib/intro-source.ts'

const OUT = fileURLToPath(new URL('../public/content/bundle.json', import.meta.url))

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      only: { type: 'string' },
      'no-explanations': { type: 'boolean', default: false },
      depth: { type: 'string', default: '18' },
      'limit-per-variation': { type: 'string', default: '40' },
      'limit-per-opening': { type: 'string', default: '300' },
    },
  })
  const specs = OPENINGS.filter((o) => !values.only || o.id === values.only)
  if (specs.length === 0) throw new Error(`Unbekannte Eröffnung: ${values.only}`)
  const t0 = Date.now()

  const lines = await loadChessOpenings()
  console.error(`chess-openings: ${lines.length} Linien`)
  const puzzles = await streamPuzzles(
    puzzleFilter(specs.flatMap(tagPrefixesOf)), Number(values['limit-per-variation']),
  )

  console.error(`Rätsel-Auswahl: ${puzzles.length}`)
  const bundle: ContentBundle = {
    schemaVersion: BUNDLE_SCHEMA, contentVersion: '', openings: [], trees: {}, explanations: [], questions: [], deviations: [], puzzles: {},
  }
  const caps = { perVariation: Number(values['limit-per-variation']), perOpening: Number(values['limit-per-opening']) }
  const engine = cachedEngine(await nodeEngine(), fileURLToPath(new URL('./.cache/analysis.json', import.meta.url)))
  const explorer = lichessExplorer({
    tokenFile: process.env.LICHESS_TOKEN_FILE, cacheFile: fileURLToPath(new URL('./.cache/explorer.json', import.meta.url)),
  })
  const report: string[] = [
    explorer.status().enabled ? 'Explorer: an (Token-Datei gesetzt)' : 'Explorer: aus (LICHESS_TOKEN_FILE nicht gesetzt oder Datei fehlt), Gegnerzüge von Stockfish',
  ]
  for (const spec of specs) {
    const r = await buildTree(spec, lines, engine, {
      ownPlies: 24, branchExtraOwnMoves: 4, vetoCp: 100, depth: Number(values.depth),
      minPlies: 28, maxPlies: 36, branchMoves: 2, branchWithinCp: 60, branchPlies: 24, nodeBudget: 600, explorer: (fen) => explorer.moves(fen),
    })
    bundle.trees[spec.id] = r.nodes
    const opening: Opening = {
      id: spec.id, name: spec.name, side: spec.side, entry: spec.entry, role: spec.role, docRef: spec.docRef,
      variations: r.variations,
    }
    bundle.openings.push(opening)
    engine.flush()
    explorer.flush()
    const st = explorer.status()
    if (st.enabled) report.push(`Explorer: ${st.requests} Anfragen, ${st.cached} aus dem Cache, ${st.failed} fehlgeschlagen${st.lastError ? ` (zuletzt: ${st.lastError})` : ''} (dann Stockfish-Bestantwort)`)
    const mine = puzzles.filter(puzzleFilter(tagPrefixesOf(spec)))
    const byVariation = assignPuzzles(mine, spec.id, r.variations, caps)
    Object.assign(bundle.puzzles, byVariation)
    report.push(
      `${spec.id}: ${Object.keys(r.nodes).length} Knoten, ${r.variations.length} Varianten, ${r.vetoes.length} Veto, ` +
        `${Object.values(byVariation).flat().length} Rätsel (von ${mine.length} gefiltert), ` +
        `${r.dropped.length} Linien abgeschnitten, ` +
        `${Object.values(r.nodes).reduce((n, x) => n + Math.max(0, x.candidates.length - 1), 0)} inaktive Kandidaten`,
      `  Linien mit Spielende: ${r.ends.filter((e) => e.reason).map((e) => `${e.id} (${e.plies} Halbzüge, ${e.reason})`).join('; ') || 'keine'}`,
      ...r.redirects.map((d) => `  Umlenkung ${d.variation}: ${d.san} (${d.share === null ? 'Stockfish-Zweitbester' : `${(d.share * 100).toFixed(1)} %, ${d.games} Partien`})`),
      `  Etappen statt Zwillinge (partOf): ${r.variations.filter((v) => v.partOf).map((v) => `${v.id} -> ${v.partOf}`).join('; ') || 'keine'}`,
      ...r.dropped.map((d) => `  Linie abgeschnitten: ${d.name} (${d.reason})`),
      ...r.vetoes.map((v) => `  Veto ${v.key}: ${v.theoryUci} -> ${v.bestUci} (-${v.lossCp} cp)`),
      ...r.docWarnings.map((w) => `  Warnung Dokumentzug ${w.uci} an ${w.key}: -${w.lossCp} cp gegenüber Bestzug`),
    )
  }

  // the only path to `engine-geprüft`: every explanation with claims is checked against Stockfish here
  if (!values['no-explanations']) {
    const explained = new Set(EXPLANATIONS.map((e) => e.key))
    const goals = bundle.openings.flatMap((o) => goalExplanations(o.id, o.variations, explained))
    const scoped = scopeContent(specs.map((s) => s.id), { explanations: [...EXPLANATIONS, ...goals], questions: QUESTIONS, deviations: DEVIATIONS })
    bundle.explanations = await verifyByOpening(scoped.explanations, bundle.openings, bundle.trees, engine, Number(values.depth))
    bundle.questions = scoped.questions
    bundle.deviations = scoped.deviations
    for (const o of bundle.openings) o.variations = withLessonKeys(o.variations, bundle.explanations)
  }

  const introRejected: string[] = []
  for (const o of bundle.openings) o.variations = withIntros(o, o.variations, { authored: await loadAuthoredIntros(o.id), facts: loadFacts(o.id), rejected: introRejected })
  report.push(...introRejected.map((r) => `  Intro-Text nicht übernommen (${r})`))

  const existing = values.only && existsSync(OUT) ? (JSON.parse(readFileSync(OUT, 'utf8')) as ContentBundle) : null
  if (existing && existing.schemaVersion !== BUNDLE_SCHEMA) throw new Error('Das vorhandene Bündel hat das alte Format: erst node tools/migrate-bundle-v2.ts ausführen (oder ohne --only bauen).')
  const out = mergeIntoExisting(bundle, existing, specs.map((s) => s.id))
  const errors = validateBundle(out, { requireLessons: !values['no-explanations'] })
  if (errors.length > 0) {
    console.error(`Bündel ungültig (${errors.length} Fehler), nichts geschrieben:\n- ${errors.slice(0, 40).join('\n- ')}`)
    process.exit(1)
  }
  out.contentVersion = contentVersion(out, new Date())
  mkdirSync(fileURLToPath(new URL('../public/content/', import.meta.url)), { recursive: true })
  writeAtomic(OUT, JSON.stringify(out))
  console.log(report.join('\n'))
  console.log(`Rätsel je Variante: ${JSON.stringify(Object.fromEntries(Object.entries(bundle.puzzles).map(([k, v]) => [k, v.length])))}`)
  console.log(`bundle ${out.contentVersion}, ${(statSync(OUT).size / 1024).toFixed(0)} KiB, ${((Date.now() - t0) / 1000).toFixed(0)} s`)
  // terminate() of Stockfish ends the Node process, so this is the very last call (error paths exit(1) anyway)
  engine.flush()
  engine.dispose()
}

if (import.meta.main) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e))
    process.exit(1)
  })
}
