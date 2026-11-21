import type { Side } from '../content/types.ts'
import type { FigurId } from '../teacher/avatar.ts'
import type { GameRecord, Helps } from '../train/free-play.ts'
import type { GameAnalysis } from '../analysis/build.ts'
import type { EcoEntry } from '../openings/eco.ts'
import { resultFor } from './identity.ts'
import { hash } from '../teacher/blocks.ts'

export type GameResult = '1-0' | '0-1' | '1/2-1/2' | '*'
export type Severity = 'ungenau' | 'fehler' | 'patzer'

/** Evaluation of a finished game: marks per move (ply = 0-based index of the move) and the first move that left the book. */
export interface StoredReview { marks: { ply: number; severity: Severity; lossCp: number; betterSan: string }[]; bookExit: number | null }

/** A game in the browser database (and the PGN file). `ownSide`/`elo` are null for imported games of other people. */
export interface StoredGame {
  /** unique per stored game (time and chance) */
  id: string
  /** content key: the same game (position, moves, day, players) has the same key, so an import finds duplicates */
  key: string
  source: 'sparring' | 'free' | 'import'
  startFen: string
  ucis: string[]
  /** English SAN */
  sans: string[]
  result: GameResult
  reason: GameRecord['reason'] | null
  /** ISO 8601, or YYYY-MM-DD for imported games */
  date: string
  white: string
  black: string
  ownSide: Side | null
  /** strength of the engine */
  elo: number | null
  teacher: FigurId | null
  /** help asked for during the game; null for imported games */
  helps: Helps | null
  /** name of the opening as shown: the tag of an imported file, else our own detection (German where we have a name) */
  opening: string | null
  /** ECO code, tag or detected */
  eco: string | null
  /** name of the own repertoire opening that the game followed, if any */
  repertoire: string | null
  /** our own detection from the position table (the check against the tag of an imported file) */
  detected: EcoEntry | null
  /** false until the opening table has been applied (it is loaded when needed; old games are completed on opening the list) */
  enriched: boolean
  /** what the file said besides moves and names */
  meta: GameMeta
  /** moves the player took back with the teacher (ply = index the move had) */
  retractions: { ply: number; san: string; severity: 'fehler' | 'patzer'; betterSan: string }[]
  review: StoredReview | null
  /** full engine analysis (move signs, evaluations), computed once; null until the game was analysed */
  analysis: GameAnalysis | null
  /** own notes of the player per move (ply = 0-based index of the move) */
  notes: Record<number, string>
  /** comments that came with an imported file ("Fremdkommentar"), read-only */
  comments: Record<number, string>
}

/** Header data of an imported game that is shown and written back; all null for own games. */
export interface GameMeta { event: string | null; site: string | null; timeControl: string | null; whiteElo: number | null; blackElo: number | null; /** the Date tag as written, e.g. 2026.??.?? */ dateText: string | null }
export const emptyMeta = (): GameMeta => ({ event: null, site: null, timeControl: null, whiteElo: null, blackElo: null, dateText: null })

/** The date as shown: the day, or an incomplete date as written in the file, or a question mark. */
export const dateLabel = (g: { date: string; meta?: Pick<GameMeta, 'dateText'> | null }): string => g.date.slice(0, 10) || g.meta?.dateText?.trim() || '?'

const known = (v: string | undefined): boolean => !!v && /^\d+$/.test(v)

/** The date for the list and the header: day.month.year (does not break); an incomplete date only with its known parts ("2026", "03.2026"); a question mark without any. */
export function dateDe(g: { date: string; meta?: Pick<GameMeta, 'dateText'> | null }): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(g.date)
  if (m) return `${m[3]}.${m[2]}.${m[1]}`
  const [y, mo] = (g.meta?.dateText ?? '').split('.')
  return known(y) ? (known(mo) ? `${mo}.${y}` : y!) : '?'
}

/** Tooltip for an incomplete date. */
export function dateNote(g: { date: string; meta?: Pick<GameMeta, 'dateText'> | null }): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(g.date) || !g.meta?.dateText) return ''
  const [y, mo] = g.meta.dateText.split('.')
  return known(y) ? (known(mo) ? 'Tag unbekannt' : 'Tag und Monat unbekannt') : ''
}

/** A site tag as a link: only http(s) addresses (a file can contain anything), shown without the protocol and a trailing slash. */
export function siteLink(site: string): { href: string; label: string } | null {
  if (!/^https?:\/\/[^\s]+$/i.test(site.trim())) return null
  const href = site.trim()
  return { href, label: href.replace(/^https?:\/\//i, '').replace(/\/$/, '') }
}

/** Content key of a game; a date that is missing counts as no day, so the key does not depend on the day of the import. */
export function gameKey(startFen: string, ucis: string[], date: string, white: string, black: string): string {
  const s = [startFen, ucis.join(' '), date.slice(0, 10), white, black].join('|')
  return `k-${hash(s).toString(36)}${hash([...s].reverse().join('')).toString(36)}`
}

export const newId = (): string => `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/** The result from the view of the own side (see identity.ts resultFor for a side that was recognised by name). */
export const resultLabel = (g: Pick<StoredGame, 'result' | 'ownSide'> & { reason?: StoredGame['reason'] }): string => resultFor({ result: g.result, reason: g.reason ?? null }, g.ownSide)

export const ME = 'Ich'
export const ENGINE = 'Stockfish'

export function storedFromRecord(r: GameRecord, extra: { source: 'sparring' | 'free'; opening: string | null; retractions: StoredGame['retractions']; review: StoredReview | null; analysis?: GameAnalysis | null; eco?: string | null; repertoire?: string | null; detected?: EcoEntry | null; enriched?: boolean; playerName?: string }): StoredGame {
  const me = extra.playerName?.trim() || ME
  const white = r.ownSide === 'white' ? me : ENGINE
  const black = r.ownSide === 'white' ? ENGINE : me
  return {
    id: newId(), key: gameKey(r.startFen, r.ucis, r.date, white, black), source: extra.source, startFen: r.startFen, ucis: r.ucis, sans: r.sans,
    result: r.result, reason: r.reason, date: r.date, white, black, ownSide: r.ownSide, elo: r.elo, teacher: r.teacher, helps: r.helps,
    opening: extra.opening, eco: extra.eco ?? null, repertoire: extra.repertoire ?? null, detected: extra.detected ?? null, enriched: extra.enriched ?? false, meta: { ...emptyMeta(), timeControl: r.timeControl ?? null, event: r.learning ? 'Lernpartie' : r.rated ? 'Wertungspartie' : null }, retractions: extra.retractions, review: extra.review, analysis: extra.analysis ?? null, notes: {}, comments: {},
  }
}
