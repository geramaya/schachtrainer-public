import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { Chess } from 'chess.js'

export interface OpeningLine { eco: string; name: string; uci: string[] }

export const CACHE_DIR = new URL('../.cache/', import.meta.url).pathname
const OPENINGS_BASE = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master/'

/** Downloads url to dest (via a .part file, so an aborted download never leaves a half file behind). */
export async function download(url: string, dest: string): Promise<void> {
  if (existsSync(dest)) return
  mkdirSync(dirname(dest), { recursive: true })
  const part = `${dest}.part`
  try {
    // the timeout covers connecting and the response headers only; the body of a big file may take long
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(new Error('Timeout nach 30 s')), 30_000)
    const res = await fetch(url, { signal: ctl.signal }).finally(() => clearTimeout(timer))
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
    await pipeline(Readable.from(res.body), createWriteStream(part))
    renameSync(part, dest)
  } catch (e) {
    rmSync(part, { force: true })
    throw new Error(`Download fehlgeschlagen: ${url} (${e instanceof Error ? e.message : String(e)})`, { cause: e })
  }
}

/** chess-openings TSV (eco, name, pgn; header first) to lines with UCI moves. */
export function parseOpeningsTsv(text: string): OpeningLine[] {
  const out: OpeningLine[] = []
  for (const row of text.split('\n').slice(1)) {
    const [eco, name, pgn] = row.split('\t')
    if (!eco || !name || !pgn) continue
    const game = new Chess()
    const uci: string[] = []
    for (const san of pgn.replace(/\d+\./g, ' ').split(/\s+/).filter(Boolean)) {
      const m = game.move(san)
      uci.push(m.from + m.to + (m.promotion ?? ''))
    }
    out.push({ eco, name, uci })
  }
  return out
}

export async function loadChessOpenings(): Promise<OpeningLine[]> {
  const all: OpeningLine[] = []
  for (const f of ['a', 'b', 'c', 'd', 'e']) {
    const file = join(CACHE_DIR, `${f}.tsv`)
    await download(`${OPENINGS_BASE}${f}.tsv`, file)
    all.push(...parseOpeningsTsv(readFileSync(file, 'utf8')))
  }
  return all
}

/** Writes via `<file>.tmp` and rename; a failure removes the .tmp and leaves the old file as it was. */
export function writeAtomic(file: string, data: string): void {
  const tmp = `${file}.tmp`
  try {
    writeFileSync(tmp, data)
    renameSync(tmp, file)
  } catch (e) {
    rmSync(tmp, { force: true })
    throw e
  }
}
