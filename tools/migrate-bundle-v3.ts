// One-off migration of public/content/bundle.json from one tree per side (schema 2) to one tree per opening (schema 3).
// Usage: node tools/migrate-bundle-v3.ts [path]   (default public/content/bundle.json; writes in place, atomically)
// Each opening walks its entry and variation lines through the old tree of its side (plus the book subtree below
// every position of those lines: all replies, the active own move) and copies what it reaches into its own tree.
// Replies that lead into a position only another opening of the same side has on its lines are left out.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Chess } from 'chess.js'
import { positionKey } from '../src/chess/position.ts'
import { BUNDLE_SCHEMA } from '../src/content/types.ts'
import type { ContentBundle, Opening, TreeNode } from '../src/content/types.ts'
import { writeAtomic } from './lib/sources.ts'
import { contentVersion, validateBundle } from './lib/validate.ts'

type OldBundle = Omit<ContentBundle, 'trees' | 'schemaVersion'> & { schemaVersion: number; trees: { white: Record<string, TreeNode>; black: Record<string, TreeNode> } }

const keyAfter = (fen: string, uci: string): string => {
  const g = new Chess(fen)
  g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
  return positionKey(g.fen())
}

/** Position keys along the entry and every variation line of an opening. */
function seedsOf(o: Opening): Set<string> {
  const out = new Set<string>()
  for (const line of [o.entry, ...o.variations.map((v) => v.line)]) {
    const g = new Chess()
    out.add(positionKey(g.fen()))
    for (const san of line) { g.move(san); out.add(positionKey(g.fen())) }
  }
  return out
}

function migrateOpening(o: Opening, old: Record<string, TreeNode>, foreign: Set<string>): Record<string, TreeNode> {
  const tree: Record<string, TreeNode> = {}
  const stack = [...seedsOf(o)]
  const seen = new Set<string>()
  while (stack.length) {
    const key = stack.pop()!
    if (seen.has(key)) continue
    seen.add(key)
    const n = old[key]
    if (!n) continue
    const copy: TreeNode = n.ownMove ? n : { ...n, replies: n.replies.filter((r) => !foreign.has(keyAfter(n.fen, r.uci))) }
    tree[key] = copy
    const moves = copy.ownMove ? copy.candidates.slice(copy.active, copy.active + 1) : copy.replies
    for (const m of moves) stack.push(keyAfter(n.fen, m.uci))
  }
  return tree
}

export function migrateBundleV3(old: OldBundle): ContentBundle {
  const trees: ContentBundle['trees'] = {}
  for (const o of old.openings) {
    const own = seedsOf(o)
    const foreign = new Set<string>()
    for (const other of old.openings) if (other.id !== o.id && other.side === o.side) for (const k of seedsOf(other)) if (!own.has(k)) foreign.add(k)
    trees[o.id] = migrateOpening(o, old.trees[o.side], foreign)
  }
  const out: ContentBundle = { ...old, schemaVersion: BUNDLE_SCHEMA, trees }
  out.contentVersion = contentVersion(out, new Date())
  return out
}

if (import.meta.main) {
  const path = process.argv[2] ?? fileURLToPath(new URL('../public/content/bundle.json', import.meta.url))
  const old = JSON.parse(readFileSync(path, 'utf8')) as OldBundle
  if (old.schemaVersion === BUNDLE_SCHEMA) { console.log('Bündel hat bereits das neue Format, nichts zu tun'); process.exit(0) }
  if (old.schemaVersion !== 2) { console.error(`Unbekanntes Format (schemaVersion ${String(old.schemaVersion)}): erwartet 2`); process.exit(1) }
  const out = migrateBundleV3(old)
  const errors = validateBundle(out, { requireLessons: false })
  if (errors.length) { console.error(`Migriertes Bündel ungültig, nichts geschrieben:\n- ${errors.slice(0, 20).join('\n- ')}`); process.exit(1) }
  writeAtomic(path, JSON.stringify(out))
  console.log(`migriert: ${Object.entries(out.trees).map(([id, t]) => `${id} ${Object.keys(t).length}`).join(', ')} Knoten, ${out.contentVersion}`)
}
