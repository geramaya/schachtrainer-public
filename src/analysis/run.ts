import type { Engine } from '../engine/service.ts'
import { addAnalysis, storageErrorOf } from '../games/library.ts'
import type { GameStore } from '../games/library.ts'
import type { StoredGame } from '../games/model.ts'
import { evaluatePositions, gameFens } from '../train/review.ts'
import { buildAnalysis } from './build.ts'

export type AnalyseOutcome =
  | { kind: 'done'; game: StoredGame }
  | { kind: 'cancelled' }
  /** the game is no longer the one shown; nothing was stored */
  | { kind: 'stale' }
  | { kind: 'failed'; message: string; error: unknown }

export interface AnalyseOptions {
  depth: number
  onProgress?: (done: number, total: number) => void
  isCancelled?: () => boolean
  /** true once the result is not wanted any more (another game was opened) */
  isStale?: () => boolean
  /** the first this many moves are opening book moves */
  bookPlies?: number | null
}

/**
 * Analyses a stored game with two engine lines per position and stores the result. The returned game is read fresh from the store
 * afterwards, so everything written meanwhile (notes) stays; a stale or cancelled run stores nothing.
 */
export async function analyseStored(store: GameStore, engine: Engine, game: StoredGame, o: AnalyseOptions): Promise<AnalyseOutcome> {
  const stale = () => o.isStale?.() ?? false
  const cancelled = () => o.isCancelled?.() ?? false
  let analysis
  try {
    const ev = await evaluatePositions(engine, gameFens(game.startFen, game.ucis), o.depth, { multipv: 2, onProgress: o.onProgress, isCancelled: () => cancelled() || stale() })
    analysis = buildAnalysis(game.startFen, game.ucis, ev, o.depth, o.bookPlies ?? null)
  } catch (e) {
    if (stale()) return { kind: 'stale' }
    if (cancelled()) return { kind: 'cancelled' }
    return { kind: 'failed', message: `Analyse nicht möglich (${(e as Error).message}).`, error: e }
  }
  if (stale()) return { kind: 'stale' }
  const saved = await addAnalysis(store, game.id, analysis)
  if (!saved.ok) return { kind: 'failed', message: saved.message, error: null }
  try {
    const fresh = await store.get(game.id)
    return stale() ? { kind: 'stale' } : { kind: 'done', game: fresh ?? { ...game, analysis } }
  } catch (e) {
    return { kind: 'failed', message: storageErrorOf(e).message, error: e }
  }
}
