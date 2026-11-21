import type { Side } from '../content/types.ts'
import type { GameMeta, StoredGame } from './model.ts'

/** Who the player is: the name used for own games and the accounts (Lichess, chess.com ...) that mark imported games as his. */
export interface PlayerSettings { name: string; accounts: string[] }
export const DEFAULT_NAME = 'Ich'

const clean = (s: string): string => s.trim()

/** "a, b; c" or one per line, trimmed, no empties, no duplicates (case-insensitive). */
export function parseAccounts(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of text.split(/[,;\n]/).map(clean)) {
    if (part && !seen.has(part.toLowerCase())) { seen.add(part.toLowerCase()); out.push(part) }
  }
  return out
}

/** Keeps only valid parts of stored data. */
export function parsePlayer(v: unknown): Partial<PlayerSettings> {
  const r = typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {}
  const name = typeof r.name === 'string' ? clean(r.name) : ''
  const accounts = Array.isArray(r.accounts) ? parseAccounts(r.accounts.filter((a): a is string => typeof a === 'string').join(',')) : []
  return { ...(name ? { name } : {}), ...(accounts.length ? { accounts } : {}) }
}

export const identityOf = (s: { player?: Partial<PlayerSettings> }): PlayerSettings => ({ name: clean(s.player?.name ?? '') || DEFAULT_NAME, accounts: s.player?.accounts ?? [] })

/**
 * The side of the player in a game: an own game knows it; an imported one is recognised by the own name or an account
 * (case-insensitive). The default name never matches a foreign game; if both sides match, it is not decidable.
 */
export function sideOfPlayer(g: Pick<StoredGame, 'white' | 'black' | 'ownSide'>, me: PlayerSettings): Side | null {
  if (g.ownSide) return g.ownSide
  const mine = new Set([...(me.name === DEFAULT_NAME ? [] : [me.name]), ...me.accounts].map((n) => n.trim().toLowerCase()))
  const [w, b] = [mine.has(g.white.trim().toLowerCase()), mine.has(g.black.trim().toLowerCase())]
  return w === b ? null : w ? 'white' : 'black'
}

/** "Sieg" / "Niederlage" / "Remis" from the view of `side`; the raw result without a side; "abgebrochen" for a game that was left, "offen" for the rest of the unfinished. */
export function resultFor(g: Pick<StoredGame, 'result' | 'reason'>, side: Side | null): string {
  if (g.result === '*') return g.reason === 'abbruch' ? 'abgebrochen' : 'offen'
  if (g.result === '1/2-1/2') return 'Remis'
  if (!side) return g.result
  return (g.result === '1-0') === (side === 'white') ? 'Sieg' : 'Niederlage'
}

/** The name of a side as shown: the engine of an own game with its strength, a player of an imported game with his rating if the file has it. */
export function displayName(g: Pick<StoredGame, 'white' | 'black' | 'ownSide' | 'elo'> & { meta?: Pick<GameMeta, 'whiteElo' | 'blackElo'> | null }, side: Side): string {
  const name = side === 'white' ? g.white : g.black
  if (g.ownSide && g.ownSide !== side && g.elo !== null) return `${name} (Elo ${g.elo})`
  const rating = side === 'white' ? g.meta?.whiteElo : g.meta?.blackElo
  return !g.ownSide && rating ? `${name} (${rating})` : name
}

/** What the Elo column shows: the strength of the engine in an own game, both ratings of an imported one, nothing if there is none. */
export function eloText(g: Pick<StoredGame, 'ownSide' | 'elo'> & { meta?: Pick<GameMeta, 'whiteElo' | 'blackElo'> | null }): string {
  if (g.ownSide) return g.elo !== null ? String(g.elo) : ''
  const [w, b] = [g.meta?.whiteElo ?? null, g.meta?.blackElo ?? null]
  return w === null && b === null ? '' : `${w ?? '–'} · ${b ?? '–'}`
}

/** CSS class of a result label (colour on top of the text). */
export const resultClass = (label: string): string => (label === 'Sieg' ? 'res-win' : label === 'Niederlage' ? 'res-loss' : label === 'Remis' ? 'res-draw' : label === 'abgebrochen' || label === 'offen' ? 'res-abort' : '')

/** Name and rating of a side for the player bar: the engine strength in an own game, the ratings of the file in an imported one. */
export function playerOf(g: Pick<StoredGame, 'white' | 'black' | 'ownSide' | 'elo'> & { meta?: Pick<GameMeta, 'whiteElo' | 'blackElo'> | null }, side: Side): { name: string; elo: number | null } {
  const name = side === 'white' ? g.white : g.black
  if (g.ownSide) return { name, elo: g.ownSide !== side ? g.elo : null }
  return { name, elo: (side === 'white' ? g.meta?.whiteElo : g.meta?.blackElo) ?? null }
}
