import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { ERWEITERUNG_CUM, KERN_COUNT, MAX_PLY, MIN_GAMES, MIN_PATH, einstufen, walkLehrgang } from './lehrgang.ts'
import { mergeVarianten } from './lehrgang-build.ts'
import type { VarianteSrc } from './lehrgang-build.ts'
import { normalizeCastling } from './explorer.ts'
import type { ExplorerMove } from './explorer.ts'
import { writeAtomic } from './sources.ts'

/** Band of the Lehrgaenge (own explorer query; the content pipeline keeps 1400-1800). */
export const LEHRGANG_BASE = 'https://explorer.lichess.ovh/lichess?variant=standard&speeds=blitz,rapid,classical&ratings=1200,1400,1600'
export const LEHRGANG_BAND = { speeds: 'blitz,rapid,classical', ratings: '1200,1400,1600' }

export const varianteId = (line: string[]): string => 'v' + createHash('sha1').update(line.join(' ')).digest('hex').slice(0, 8)

export interface DatenArgs {
  dir: string
  abruf: string
  ownMove: (fen: string) => string | null
  replies: (fen: string) => Promise<ExplorerMove[] | null>
}

/** Walks one Lehrgang, writes daten.json and merges tier/share into varianten.json (written sentences stay). Same input, same bytes. */
export async function erzeugeDaten(a: DatenArgs): Promise<{ varianten: number; abdeckung: number; luecken: number }> {
  const meta = JSON.parse(readFileSync(join(a.dir, 'lehrgang.json'), 'utf8')) as { id: string; side: 'white' | 'black'; entry: string[] }
  const walk = await walkLehrgang({ entry: meta.entry, side: meta.side, maxPly: MAX_PLY, minPath: MIN_PATH, minGames: MIN_GAMES, ownMove: a.ownMove, replies: a.replies })
  const stufen = einstufen(walk.varianten.map((v) => ({ ...v, id: varianteId(v.line) })))
  const abdeckung = walk.varianten.reduce((n, v) => n + v.anteil, 0)
  const daten = {
    schema: 1, lehrgang: meta.id, abruf: a.abruf, band: LEHRGANG_BAND,
    schwellen: { kernAnzahl: KERN_COUNT, erweiterung: ERWEITERUNG_CUM, minPfad: MIN_PATH, maxPly: MAX_PLY, minPartien: MIN_GAMES },
    abdeckung, baum: walk.baum,
    varianten: stufen.map((v) => ({ id: v.id, line: v.line, anteil: v.anteil, kumuliert: v.kumuliert, stufe: v.stufe, grund: v.grund })),
  }
  writeAtomic(join(a.dir, 'daten.json'), JSON.stringify(daten, null, 1) + '\n')
  const file = join(a.dir, 'varianten.json')
  const old = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as VarianteSrc[]) : []
  writeAtomic(file, JSON.stringify(mergeVarianten(old, stufen), null, 1) + '\n')
  return { varianten: stufen.length, abdeckung, luecken: stufen.filter((v) => v.grund === 'luecke').length }
}

/** Replies from a stored explorer cache (no token, no network): re-derives tiers and trees from data that was already fetched. */
export function cacheReplies(file: string): (fen: string) => Promise<ExplorerMove[] | null> {
  const store = JSON.parse(readFileSync(file, 'utf8')) as Record<string, ExplorerMove[]>
  return async (fen) => store[fen]?.map((m) => ({ ...m, uci: normalizeCastling(fen, m.uci) })) ?? null
}
