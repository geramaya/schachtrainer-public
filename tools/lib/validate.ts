import { createHash } from 'node:crypto'
import { Chess } from 'chess.js'
import { positionKey } from '../../src/chess/position.ts'
import { BUNDLE_SCHEMA } from '../../src/content/types.ts'
import type { ContentBundle } from '../../src/content/types.ts'
import { findNode } from '../../src/content/tree.ts'
import { applyUci } from './check-claims.ts'
import { checkIntro } from '../../src/content/intro.ts'

export interface ValidateOptions {
  /** Every variation needs at least one lesson explanation (default true). */
  requireLessons?: boolean
}

function load(fen: string): Chess | null {
  try {
    return new Chess(fen)
  } catch {
    return null
  }
}

/** Explanation ids are `<openingId>/<variationId>/<n>`; one position may be explained once per opening. */
const openingIdOf = (explanationId: string): string => explanationId.split('/')[0]!

/** Empty result = bundle is consistent. Every message names the offending id/key. */
export function validateBundle(b: ContentBundle, opts: ValidateOptions = {}): string[] {
  const errs: string[] = []
  const requireLessons = opts.requireLessons ?? true

  if (b.schemaVersion !== BUNDLE_SCHEMA) errs.push(`schemaVersion ${String(b.schemaVersion)}, expected ${BUNDLE_SCHEMA}`)
  for (const o of b.openings) if (!b.trees[o.id]) errs.push(`opening ${o.id}: no tree`)
  for (const [openingId, tree] of Object.entries(b.trees)) {
  const side = b.openings.find((o) => o.id === openingId)?.side
  if (!side) {
    errs.push(`tree ${openingId}: no such opening`)
    continue
  }
  for (const [key, n] of Object.entries(tree)) {
    const c = load(n.fen)
    if (!c) {
      errs.push(`node ${key}: invalid fen`)
      continue
    }
    if (n.ownMove !== (c.turn() === (side === 'white' ? 'w' : 'b'))) errs.push(`${openingId} tree node ${key}: ownMove does not match the side to move`)
    if (positionKey(n.fen) !== key) errs.push(`node ${key}: key does not match fen`)
    for (const m of [...n.candidates, ...n.replies]) {
      if (!applyUci(new Chess(n.fen), m.uci)) errs.push(`node ${key}: illegal move ${m.uci}`)
    }
    if (n.ownMove && n.candidates.length === 0 && c.moves().length > 0) errs.push(`node ${key}: own move without candidate`)
    if (n.ownMove && n.candidates.length > 0 && !n.candidates[n.active]) errs.push(`node ${key}: active index ${n.active} out of range`)
  }
  }

  for (const o of b.openings) {
    for (const v of o.variations) {
      if (v.intro) for (const p of checkIntro(v.intro.text, v.line)) errs.push(`variation ${v.id} intro: ${p}`)
    }
  }

  const explanations = new Map(b.explanations.map((e) => [e.id, e]))
  const variationIds = new Set(b.openings.flatMap((o) => o.variations.map((v) => v.id)))
  const missingKey = (what: string, key: string) => {
    if (!findNode(b, key)) errs.push(`${what}: missing key ${key}`)
  }

  const byKey = new Map<string, string>()
  for (const e of b.explanations) {
    const slot = `${openingIdOf(e.id)}|${e.key}`
    const other = byKey.get(slot)
    if (other) errs.push(`explanation ${e.id}: dieselbe Stellung wie ${other}`)
    else byKey.set(slot, e.id)
    missingKey(`explanation ${e.id}`, e.key)
    if (e.claims.length > 0 && e.status === 'entwurf') errs.push(`explanation ${e.id}: Behauptung ungeprüft (Status entwurf)`)
    for (const c of e.claims) {
      if (!c.verified && e.status === 'engine-geprüft') errs.push(`explanation ${e.id}: claim ${c.kind} ${c.uci} ohne verified`)
      const n = findNode(b, e.key)
      if (n && !applyUci(new Chess(n.fen), c.uci) && c.kind !== 'threat') errs.push(`explanation ${e.id}: illegal move ${c.uci}`)
    }
  }

  for (const q of b.questions) {
    missingKey(`question ${q.id}`, q.key)
    if (!explanations.has(q.explanationId)) errs.push(`question ${q.id}: missing explanation ${q.explanationId}`)
    if (!variationIds.has(q.variationId)) errs.push(`question ${q.id}: missing variation ${q.variationId}`)
  }

  for (const d of b.deviations) {
    missingKey(`deviation ${d.key}`, d.key)
    if (!explanations.has(d.explanationId)) errs.push(`deviation ${d.key}: missing explanation ${d.explanationId}`)
    if (!variationIds.has(d.variationId)) errs.push(`deviation ${d.key}: missing variation ${d.variationId}`)
  }

  for (const o of b.openings) {
    for (const v of o.variations) {
      const g = new Chess()
      try {
        for (const san of v.line) g.move(san)
      } catch {
        errs.push(`variation ${v.id}: illegal line`)
      }
      for (const k of v.keyPositions) missingKey(`variation ${v.id}`, k)
      if (v.partOf && !o.variations.some((x) => x.id === v.partOf)) errs.push(`variation ${v.id}: partOf ${v.partOf} is no variation of ${o.id}`)
      if (requireLessons && !b.explanations.some((e) => openingIdOf(e.id) === o.id && v.keyPositions.includes(e.key))) {
        errs.push(`variation ${v.id}: keine Lektion (Erklärung an einer Schlüsselstellung)`)
      }
    }
  }

  for (const [id, list] of Object.entries(b.puzzles)) {
    for (const p of list) {
      const g = load(p.fen)
      if (!g || !p.moves.every((m) => applyUci(g, m))) errs.push(`puzzle ${p.id} (${id}): illegal move or fen`)
    }
  }
  return errs
}

/** YYYYMMDD-<8 hex of sha256 over the content without its version field>. */
export function contentVersion(b: ContentBundle, day: Date): string {
  const hash = createHash('sha256').update(JSON.stringify({ ...b, contentVersion: '' })).digest('hex').slice(0, 8)
  return `${day.toISOString().slice(0, 10).replaceAll('-', '')}-${hash}`
}
