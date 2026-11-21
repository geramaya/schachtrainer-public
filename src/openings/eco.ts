import { Chess } from 'chess.js'
import { applyUci } from '../chess/game.ts'
import { positionKey } from '../chess/position.ts'

/**
 * ECO code and name of the opening of ANY game, from the Lichess chess-openings table (CC0), built by tools/build-eco.ts into
 * public/eco/eco.json. Positions, not move lists: a transposition reaches the same entry. The deepest known position of the game decides.
 */
export interface EcoEntry { eco: string; name: string }
export type EcoTable = Map<string, EcoEntry>
export type EcoRow = [hash: string, eco: string, name: string]

/** cyrb53 (public domain) of the position key in base 36: 53 bits, short in the file, no collision to expect among 4000 positions. */
export function ecoHash(key: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

/** Rows of a chess-openings TSV (eco, name, pgn; header first) as [hash of the position after the last move, eco, name]; the name is the original English one, complete and unchanged. First entry of a position wins; broken rows are skipped. */
export function ecoEntriesFromTsv(text: string): EcoRow[] {
  const seen = new Set<string>()
  const out: EcoRow[] = []
  for (const row of text.split('\n').slice(1)) {
    const [eco, name, pgn] = row.split('\t')
    if (!eco || !name || !pgn || !/^[A-E]\d\d$/.test(eco)) continue
    const c = new Chess()
    try { for (const san of pgn.replace(/\d+\./g, ' ').split(/\s+/).filter(Boolean)) c.move(san) } catch { continue }
    const hash = ecoHash(positionKey(c.fen()))
    if (seen.has(hash)) continue
    seen.add(hash)
    out.push([hash, eco, name])
  }
  return out
}

export function parseEcoTable(json: unknown): EcoTable | null {
  const entries = (json as { entries?: unknown } | null)?.entries
  if (!Array.isArray(entries)) return null
  const t: EcoTable = new Map()
  for (const e of entries) {
    if (!Array.isArray(e) || e.length !== 3 || !e.every((x) => typeof x === 'string')) return null
    t.set(e[0] as string, { eco: e[1] as string, name: e[2] as string })
  }
  return t
}

/** The deepest position of the game that is in the table; `plies` = how many moves of the game it took. */
export function detectOpening(t: EcoTable, startFen: string, ucis: string[]): (EcoEntry & { plies: number }) | null {
  const keys = [positionKey(startFen)]
  let fen = startFen
  for (const u of ucis) {
    const r = applyUci(fen, u)
    if (!r) break
    fen = r.fen
    keys.push(positionKey(fen))
  }
  for (let i = keys.length - 1; i >= 0; i--) {
    const hit = t.get(ecoHash(keys[i]!))
    if (hit) return { ...hit, plies: i }
  }
  return null
}

const real = (v: string | null | undefined): string | null => (v && v.trim() && v.trim() !== '?' ? v.trim() : null)

/** What to show: the tags of the PGN file win, our own detection fills what is missing (and is the fallback without tags). */
export function openingInfo(tag: { eco?: string | null; name?: string | null }, detected: EcoEntry | null): { eco: string | null; name: string | null; source: 'pgn' | 'detected' | null } {
  const eco = real(tag.eco)
  const name = real(tag.name)
  if (eco || name) return { eco: eco ?? detected?.eco ?? null, name, source: 'pgn' }
  return detected ? { eco: detected.eco, name: detected.name, source: 'detected' } : { eco: null, name: null, source: null }
}
