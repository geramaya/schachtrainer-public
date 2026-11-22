import { existsSync, readFileSync } from 'node:fs'
import { writeAtomic } from './sources.ts'

export interface ExplorerMove { uci: string; games: number }
export interface ExplorerOptions {
  /** File with the Lichess token (env LICHESS_TOKEN_FILE); without it the explorer is off. The content is never logged. */
  tokenFile?: string
  cacheFile: string
  fetchFn?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  /** Query base (variant, speeds, ratings); default = the content pipeline band 1400-1800. */
  base?: string
}

export const BASE = 'https://explorer.lichess.ovh/lichess?variant=standard&speeds=blitz,rapid,classical&ratings=1400,1600,1800'
/** Captured at load time: the wasm Stockfish loader removes the global fetch while it initialises. */
const nativeFetch = globalThis.fetch
const MIN_GAP_MS = 1000
const MAX_RETRIES = 3

const CASTLING: Record<string, string> = { e1h1: 'e1g1', e1a1: 'e1c1', e8h8: 'e8g8', e8a8: 'e8c8' }

/** The explorer writes castling as "king takes own rook" (e8h8); chess.js wants the king move (e8g8). Only for a king on its home square with a rook on the target. */
export function normalizeCastling(fen: string, uci: string): string {
  const to = CASTLING[uci]
  if (!to) return uci
  const board = fen.split(' ')[0]!.split('/')
  const rank = board[uci[1] === '1' ? 7 : 0]!.replace(/\d/g, (d) => '.'.repeat(Number(d)))
  const own = uci[1] === '1' ? { king: 'K', rook: 'R' } : { king: 'k', rook: 'r' }
  const file = (c: string) => c.charCodeAt(0) - 97
  return rank[4] === own.king && rank[file(uci[2]!)] === own.rook ? to : uci
}

/** Lichess opening explorer for the band 1400-1800: cached by position, at most 1 request/s, waits on 429, null on failure. */
export function lichessExplorer(o: ExplorerOptions) {
  const token = o.tokenFile && existsSync(o.tokenFile) ? readFileSync(o.tokenFile, 'utf8').trim() : null
  const store: Record<string, ExplorerMove[]> = existsSync(o.cacheFile) ? (JSON.parse(readFileSync(o.cacheFile, 'utf8')) as Record<string, ExplorerMove[]>) : {}
  const doFetch = o.fetchFn ?? nativeFetch
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const stats = { enabled: token !== null, requests: 0, cached: 0, failed: 0, lastError: '' }
  let last = 0

  async function request(fen: string): Promise<ExplorerMove[] | null> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const wait = last + MIN_GAP_MS - Date.now()
      if (wait > 0) await sleep(wait)
      last = Date.now()
      stats.requests++
      const res = await doFetch(`${o.base ?? BASE}&fen=${encodeURIComponent(fen)}`, { headers: { authorization: `Bearer ${token}` } })
      if (res.status === 429) {
        await sleep(Number(res.headers.get('retry-after') ?? '60') * 1000)
        continue
      }
      if (!res.ok) {
        stats.lastError = `HTTP ${res.status}`
        return null
      }
      const j = (await res.json()) as { moves: { uci: string; white: number; draws: number; black: number }[] }
      return j.moves.map((m) => ({ uci: m.uci, games: m.white + m.draws + m.black }))
    }
    return null
  }

  return {
    /** Moves by frequency, or null (explorer off or unreachable: the caller falls back to the engine). */
    async moves(fen: string): Promise<ExplorerMove[] | null> {
      if (token === null) return null
      const hit = store[fen]
      if (hit) {
        stats.cached++
        return hit.map((m) => ({ ...m, uci: normalizeCastling(fen, m.uci) }))
      }
      try {
        const m = await request(fen)
        if (m === null) stats.failed++
        else store[fen] = m
        return m && m.map((x) => ({ ...x, uci: normalizeCastling(fen, x.uci) }))
      } catch (e) {
        stats.lastError = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
        stats.failed++
        return null
      }
    },
    status: () => ({ ...stats }),
    flush: () => writeAtomic(o.cacheFile, JSON.stringify(store)),
  }
}
