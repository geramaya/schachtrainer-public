import { replayRatings } from '../train/rating.ts'
import type { RatedGame } from '../train/rating.ts'
import type { Side } from '../content/types.ts'
import { gameKey, newId, opponentOf } from './model.ts'
import type { GameResult, StoredGame, StoredReview } from './model.ts'
import { parseGame, splitGames, toPgn } from './pgn.ts'
import type { GameAnalysis } from '../analysis/build.ts'
import { detectOpening, openingInfo } from '../openings/eco.ts'
import type { EcoTable } from '../openings/eco.ts'
import { enrichOpening } from '../openings/enrich.ts'
import { sideOfPlayer } from './identity.ts'
import type { PlayerSettings } from './identity.ts'
import type { ParseError } from './pgn.ts'

/** Where games live. The browser implements it with IndexedDB (idb.ts); tests use an in-memory fake. */
export interface GameStore {
  put(g: StoredGame): Promise<void>
  /** all games in one transaction */
  putMany(gs: StoredGame[]): Promise<void>
  get(id: string): Promise<StoredGame | undefined>
  all(): Promise<StoredGame[]>
  remove(id: string): Promise<void>
}

export type StorageKind = 'quota' | 'unavailable' | 'failed'
const TEXT: Record<StorageKind, string> = {
  quota: 'Der Browser-Speicher ist voll. Lösche alte Partien oder exportiere sie als PGN.',
  unavailable: 'Die Partien-Datenbank ist nicht verfügbar (privater Modus oder vom Browser gesperrt). Exportiere wichtige Partien als PGN.',
  failed: 'Speichern fehlgeschlagen',
}
export class StorageError extends Error {
  readonly kind: StorageKind
  constructor(kind: StorageKind, detail?: string) {
    super(kind === 'failed' && detail ? `${TEXT.failed}: ${detail}` : TEXT[kind])
    this.kind = kind
  }
}

/** Browser storage errors by name: full, blocked/private, anything else. */
export function storageErrorOf(e: unknown): StorageError {
  if (e instanceof StorageError) return e
  const name = (e as { name?: string } | null)?.name ?? ''
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') return new StorageError('quota')
  if (name === 'SecurityError' || name === 'InvalidStateError') return new StorageError('unavailable')
  return new StorageError('failed', (e as Error | null)?.message ?? (e ? String(e) : 'unbekannter Fehler'))
}

export type Saved = { ok: true; id: string } | { ok: false; message: string }
const guard = async (id: string, work: () => Promise<void>): Promise<Saved> => {
  try { await work(); return { ok: true, id } } catch (e) { return { ok: false, message: storageErrorOf(e).message } }
}

export const saveGame = (store: GameStore, g: StoredGame): Promise<Saved> => guard(g.id, () => store.put(g))

const update = (store: GameStore, id: string, change: (g: StoredGame) => StoredGame): Promise<Saved> =>
  guard(id, async () => {
    const g = await store.get(id)
    if (!g) throw new Error('Die Partie ist nicht mehr gespeichert.')
    await store.put(change(g))
  })

/** Adds the evaluation to a stored game. */
export const addReview = (store: GameStore, id: string, review: StoredReview): Promise<Saved> => update(store, id, (g) => ({ ...g, review }))

/** Review and analysis of a finished game in ONE write (two writes would read and overwrite each other). */
export const addResults = (store: GameStore, id: string, r: { review: StoredReview; analysis: GameAnalysis }): Promise<Saved> =>
  update(store, id, (g) => ({ ...g, review: r.review, analysis: JSON.parse(JSON.stringify(r.analysis)) as GameAnalysis }))

/** Stores the full analysis with the game (it is never computed twice); copied to plain data first, the browser database cannot clone reactive proxies. */
export const addAnalysis = (store: GameStore, id: string, analysis: GameAnalysis): Promise<Saved> => update(store, id, (g) => ({ ...g, analysis: JSON.parse(JSON.stringify(analysis)) as GameAnalysis }))

/** The own note of a move; an empty text removes it. */
export const setNote = (store: GameStore, id: string, ply: number, text: string): Promise<Saved> =>
  update(store, id, (g) => {
    const notes = { ...g.notes }
    if (text.trim()) notes[ply] = text.trim()
    else delete notes[ply]
    return { ...g, notes }
  })

/** Newest first. Throws a StorageError with a readable message. */
export async function listGames(store: GameStore): Promise<StoredGame[]> {
  try { return (await store.all()).sort((a, b) => b.date.localeCompare(a.date)) } catch (e) { throw storageErrorOf(e) }
}

export async function removeGame(store: GameStore, id: string): Promise<void> {
  try { await store.remove(id) } catch (e) { throw storageErrorOf(e) }
}

export interface ImportReport { added: number; duplicates: number; errors: ParseError[]; cancelled?: boolean; storageError?: string }

export interface ImportOptions {
  /** how long to parse before handing control back to the browser */
  sliceMs?: number
  yieldFn?: () => Promise<void>
  onProgress?: (done: number, total: number) => void
  cancelled?: () => boolean
  /** games per database transaction */
  batch?: number
  /** the opening table (null = not available: the games are marked and completed later) */
  eco?: EcoTable | null
}
const nextTick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

/**
 * Imports every readable game of a PGN file in slices (the page stays responsive, progress and cancel work) and writes in a few batches.
 * Duplicates (same content key) are skipped, broken games reported, storage trouble stops the import with a message.
 */
export async function importGames(store: GameStore, text: string, o: ImportOptions = {}): Promise<ImportReport> {
  const { sliceMs = 30, yieldFn = nextTick, batch = 200 } = o
  const blocks = splitGames(text)
  const report: ImportReport = { added: 0, duplicates: 0, errors: [] }
  let known: Set<string>
  try { known = new Set((await store.all()).map((g) => g.key)) } catch (e) { return { ...report, storageError: storageErrorOf(e).message } }
  let pending: StoredGame[] = []
  const flush = async (): Promise<boolean> => {
    if (!pending.length) return true
    try { await store.putMany(pending) } catch (e) { report.storageError = storageErrorOf(e).message; return false }
    report.added += pending.length
    pending = []
    return true
  }
  let last = performance.now()
  for (let i = 0; i < blocks.length; i++) {
    if (o.cancelled?.()) { report.cancelled = true; break }
    const r = parseGame(blocks[i]!, i + 1)
    if ('error' in r) report.errors.push(r.error)
    else {
      const p = r.game
      const key = gameKey(p.startFen, p.ucis, p.date, p.white, p.black)
      if (known.has(key)) report.duplicates++
      else {
        known.add(key)
        const detected = o.eco ? detectOpening(o.eco, p.startFen, p.ucis) : null
        const info = openingInfo({ eco: p.eco, name: p.opening }, detected ? { eco: detected.eco, name: detected.name } : null)
        pending.push({
          id: newId(), key, source: p.data?.source ?? 'import', startFen: p.startFen, ucis: p.ucis, sans: p.sans, result: p.result, reason: p.data?.reason ?? null,
          date: p.date, white: p.white, black: p.black, ownSide: p.ownSide, elo: p.elo, teacher: p.teacher, helps: p.helps, opening: info.name, eco: info.eco, repertoire: p.repertoire, detected: detected ? { eco: detected.eco, name: detected.name } : null, enriched: !!o.eco, meta: p.meta,
          retractions: p.data?.retractions ?? [], review: p.data?.review ?? null, analysis: p.analysis, notes: p.notes, comments: p.comments,
        })
        if (pending.length >= batch && !(await flush())) return report
      }
    }
    o.onProgress?.(i + 1, blocks.length)
    if (performance.now() - last >= sliceMs) { await yieldFn(); last = performance.now() }
  }
  await flush()
  return report
}

export const exportPgn = (games: StoredGame[]): string => games.map(toPgn).join('\n\n') + '\n'

export interface GameFilter { text?: string; result?: GameResult | 'abgebrochen'; side?: Side; /** only games with a stored analysis */ analysed?: boolean }

/** Completes the opening data of games that lack it and writes them back in one batch; a failing write is not fatal (it is tried again next time). */
export async function enrichAll(store: GameStore, games: StoredGame[], table: EcoTable): Promise<StoredGame[]> {
  const out = games.map((g) => enrichOpening(g, table))
  const changed = out.filter((g, i) => g !== games[i])
  if (changed.length) { try { await store.putMany(changed) } catch { /* shown anyway; saved next time */ } }
  return out
}

/** Search over names, ECO code, opening, event, site and date; `me` decides what "side" means for imported games. */
export function filterGames(games: StoredGame[], f: GameFilter, me?: PlayerSettings): StoredGame[] {
  const q = f.text?.trim().toLowerCase()
  return games.filter((g) => {
    if (f.result === 'abgebrochen' ? !(g.result === '*' && g.reason === 'abbruch') : f.result === '*' ? !(g.result === '*' && g.reason !== 'abbruch') : f.result && g.result !== f.result) return false
    if (f.analysed && !g.analysis) return false
    if (f.side && (me ? sideOfPlayer(g, me) : g.ownSide) !== f.side) return false
    return !q || [g.opening, g.eco, g.repertoire, g.white, g.black, g.teacher, g.meta?.event, g.meta?.site, g.date.slice(0, 10), g.meta?.dateText].some((v) => v?.toLowerCase().includes(q))
  })
}

/** Small marks of a game in the list: has a stored analysis, was played with the clock stopped by the teacher, time control ("3+2"; unknown forms as they are). */
export function badgesOf(g: Pick<StoredGame, 'analysis' | 'meta'>): { analysed: boolean; learning: boolean; rated: boolean; timeControl: string | null } {
  const raw = g.meta?.timeControl ?? null
  const m = raw?.match(/^(\d+)\+(\d+)$/)
  const timeControl = m && Number(m[1]) % 60 === 0 ? `${Number(m[1]) / 60}+${m[2]}` : raw
  return { analysed: !!g.analysis, learning: g.meta?.event === 'Lernpartie', rated: g.meta?.event === 'Wertungspartie', timeControl }
}

/** What the rating needs of a stored game. */
export function ratedGameOf(g: StoredGame): RatedGame {
  return { id: g.id, date: g.date, plies: g.ucis.length, ownSide: g.ownSide, elo: g.elo, result: g.result, reason: g.reason, event: g.meta?.event ?? null, timeControl: g.meta?.timeControl ?? null, opponent: opponentOf(g) }
}

/** The rating change of `game` if it is the newest of `games` (undefined if it does not count). */
export function ratingOf(games: StoredGame[], game: StoredGame): StoredGame['rating'] {
  const e = replayRatings([...games.filter((g) => g.id !== game.id), game].map(ratedGameOf), opponentOf(game)).entries.find((x) => x.id === game.id)
  return e ? { category: e.category, before: e.before, after: e.after, delta: e.delta } : undefined
}

/**
 * Fills `rating` of the Wertungspartien that lack it (or have an outdated one), chronologically. The change only adds a field; before anything is
 * written `keepBackup` gets the previous versions of the games that change. Returns the number of changed games; a second run changes nothing.
 */
export async function backfillRatings(store: GameStore, keepBackup: (previous: StoredGame[]) => void): Promise<number> {
  const games = await store.all()
  const rated = games.map(ratedGameOf)
  const entries = [...replayRatings(rated, 'stockfish').entries, ...replayRatings(rated, 'maia').entries]
  const byId = new Map(entries.map((e) => [e.id, e]))
  const changed = games.filter((g) => {
    const e = byId.get(g.id)
    const r = g.rating
    return e ? !r || r.category !== e.category || r.before !== e.before || r.after !== e.after || r.delta !== e.delta : false
  })
  if (!changed.length) return 0
  keepBackup(changed)
  await store.putMany(changed.map((g) => { const e = byId.get(g.id)!; return { ...g, rating: { category: e.category, before: e.before, after: e.after, delta: e.delta } } }))
  return changed.length
}
