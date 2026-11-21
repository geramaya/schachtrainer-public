import { createReadStream } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { createZstdDecompress } from 'node:zlib'
import { positionKey } from '../../src/chess/position.ts'
import type { Puzzle } from '../../src/content/types.ts'
import { CACHE_DIR, download } from './sources.ts'

const PUZZLE_URL = 'https://database.lichess.org/lichess_db_puzzle.csv.zst'

function validFen(fen: string): boolean {
  try {
    positionKey(fen)
    return true
  } catch {
    return false
  }
}

/** Cheap field split; no FEN validation (millions of rows are rejected by the filter first). */
function parseFields(line: string): Puzzle | null {
  const f = line.split(',')
  if (f.length < 10) return null
  const [id, fen, moves, rating, , popularity, nbPlays, themes, url, tags] = f as string[] as [
    string, string, string, string, string, string, string, string, string, string,
  ]
  const r = Number(rating)
  if (!id || !moves || !Number.isFinite(r)) return null
  return {
    id, fen, moves: moves.split(' '), rating: r, popularity: Number(popularity), nbPlays: Number(nbPlays), themes: themes.split(' ').filter(Boolean),
    openingTags: tags.trim().split(' ').filter(Boolean), url,
  }
}

/** Lichess puzzle CSV row; null for the header, malformed rows and invalid FENs. */
export function parsePuzzleLine(line: string): Puzzle | null {
  const p = parseFields(line)
  return p && validFen(p.fen) ? p : null
}

/** Rating 1200-1900, an opening tag starting with one of the prefixes, position before move 20. */
export function puzzleFilter(tagPrefixes: string[]): (p: Puzzle) => boolean {
  return (p) =>
    p.rating >= 1200 && p.rating <= 1900 &&
    Number(p.fen.split(' ')[5]) < 20 &&
    p.openingTags.some((t) => tagPrefixes.some((x) => t.startsWith(x)))
}

const popularityOf = (p: Puzzle): number => (p.popularity ?? 0) * 1e9 + (p.nbPlays ?? 0)

/** Keeps, per opening tag, the `limitPerTag` most popular puzzles; a puzzle stays while it is in at least one tag's top list. */
class Selector {
  private readonly byTag = new Map<string, Puzzle[]>()
  private readonly order: Puzzle[] = []
  private readonly filter: (p: Puzzle) => boolean
  private readonly limitPerTag: number
  constructor(filter: (p: Puzzle) => boolean, limitPerTag: number) {
    this.filter = filter
    this.limitPerTag = limitPerTag
  }
  add(line: string): void {
    const p = parseFields(line)
    if (!p || !this.filter(p)) return
    let kept = false
    for (const t of p.openingTags) {
      const list = this.byTag.get(t) ?? []
      this.byTag.set(t, list)
      const worst = list[list.length - 1]
      if (list.length < this.limitPerTag || (worst && popularityOf(p) > popularityOf(worst))) {
        list.push(p)
        list.sort((x, y) => popularityOf(y) - popularityOf(x))
        if (list.length > this.limitPerTag) list.pop()
        kept = true
      }
    }
    if (kept) this.order.push(p)
  }
  /** Survivors in file order; FENs are validated only here, after the filter and the ranking. */
  get picked(): Puzzle[] {
    const alive = new Set([...this.byTag.values()].flat())
    return this.order.filter((p) => alive.has(p) && validFen(p.fen))
  }
}

export function selectPuzzles(lines: Iterable<string>, filter: (p: Puzzle) => boolean, limitPerTag: number): Puzzle[] {
  const s = new Selector(filter, limitPerTag)
  for (const l of lines) s.add(l)
  return s.picked
}

/** Downloads the puzzle database once (cached), decompresses and filters it as a stream. */
export async function streamPuzzles(filter: (p: Puzzle) => boolean, limitPerTag: number): Promise<Puzzle[]> {
  const file = join(CACHE_DIR, 'lichess_db_puzzle.csv.zst')
  await download(PUZZLE_URL, file)
  const s = new Selector(filter, limitPerTag)
  const rl = createInterface({ input: createReadStream(file).pipe(createZstdDecompress()), crlfDelay: Infinity })
  for await (const line of rl) s.add(line)
  return s.picked
}

/** Lichess tag spelling of a chess-openings name: "Scotch Game: Classical Variation" becomes Scotch_Game_Classical_Variation. */
export function tagOf(name: string): string {
  return name.replace(/'/g, '').split(/[:,\s]+/).filter(Boolean).join('_')
}

export interface PuzzleCaps { perVariation: number; perOpening: number }

/**
 * Puzzle goes to the variation with the longest matching tag. The root variation (name without ':') matches
 * its tag exactly only; other variations also match longer tags (sub-lines). Everything else goes to the
 * opening pool `<openingId>/allgemein`. Groups are sorted by popularity and capped; the opening total too.
 */
export function assignPuzzles(
  puzzles: Puzzle[], openingId: string, variations: { id: string; nameEn: string }[],
  caps: PuzzleCaps = { perVariation: 40, perOpening: 300 },
): Record<string, Puzzle[]> {
  const vt = variations.map((v) => ({ id: v.id, tag: tagOf(v.nameEn), root: !v.nameEn.includes(':') }))
  const groups: Record<string, Puzzle[]> = {}
  for (const p of puzzles) {
    let best: { id: string; len: number } | null = null
    for (const t of p.openingTags) {
      for (const v of vt) {
        const hit = t === v.tag || (!v.root && t.startsWith(`${v.tag}_`))
        if (hit && (!best || v.tag.length > best.len)) best = { id: v.id, len: v.tag.length }
      }
    }
    ;(groups[best?.id ?? `${openingId}/allgemein`] ??= []).push(p)
  }
  const capped = Object.entries(groups).map(([id, list]) => ({
    id, list: [...list].sort((x, y) => popularityOf(y) - popularityOf(x)).slice(0, caps.perVariation),
  }))
  const all = capped.flatMap((g) => g.list)
  const keep = new Set([...all].sort((x, y) => popularityOf(y) - popularityOf(x)).slice(0, caps.perOpening))
  const out: Record<string, Puzzle[]> = {}
  for (const g of capped) {
    const list = g.list.filter((p) => keep.has(p))
    if (list.length > 0) out[g.id] = list
  }
  return out
}

/** Lichess puzzle tag prefixes of an opening: the explicit `puzzleTags` (tags do not always follow the chess-openings names), else derived from the names. */
export function tagPrefixesOf(spec: { variationNames: string[]; puzzleTags?: string[] }): string[] {
  return spec.puzzleTags ?? spec.variationNames.map(tagOf)
}
