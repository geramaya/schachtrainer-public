import type { StoredGame } from '../games/model.ts'
import { emptyMeta } from '../games/model.ts'
import { detectOpening, openingInfo } from './eco.ts'
import type { EcoTable } from './eco.ts'

/**
 * Completes the opening data of a stored game from the position table, without an engine: ECO code and name of the deepest known
 * position (the tag of an imported file wins, our detection is kept as the check). A game saved before this existed keeps what it had:
 * an own game's old "opening" was the repertoire name, an imported game's was the name of its file.
 */
export function enrichOpening(g: StoredGame, table: EcoTable): StoredGame {
  if (g.enriched) return g
  const detected = detectOpening(table, g.startFen, g.ucis)
  const legacyOwn = g.source !== 'import' && g.repertoire === undefined
  const repertoire = legacyOwn ? g.opening ?? null : g.repertoire ?? null
  const tag = g.source === 'import' ? { eco: g.eco ?? null, name: g.opening ?? null } : { eco: null, name: null }
  const info = openingInfo(tag, detected ? { eco: detected.eco, name: detected.name } : null)
  return { ...g, eco: info.eco, opening: info.name, repertoire, detected: detected ? { eco: detected.eco, name: detected.name } : null, enriched: true, meta: g.meta ?? emptyMeta() }
}
