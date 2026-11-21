import { dateLabel } from './model.ts'
import type { StoredGame } from './model.ts'

const MAX_NAME = 100

/** Safe file-name part: umlauts transliterated, everything but letters, digits and "-" becomes a single "-". */
function clean(s: string): string {
  return s
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/** `YYYY-MM-DD_White-Black_ECO.pgn` for each game, duplicates numbered (`-2`, `-3`, the first stays plain); names are at most 100 characters. */
export function pgnFileNames(games: Pick<StoredGame, 'date' | 'white' | 'black' | 'eco'>[]): string[] {
  const seen = new Map<string, number>()
  return games.map((g) => {
    const day = clean(dateLabel(g)) || 'ohne-Datum'
    const players = `${clean(g.white) || 'Unbekannt'}-${clean(g.black) || 'Unbekannt'}`
    const eco = clean(g.eco ?? '') || 'ohne-ECO'
    const room = MAX_NAME - '.pgn'.length - day.length - eco.length - 2 - 5 // two "_", room for "-9999"
    const base = `${day}_${players.slice(0, Math.max(8, room)).replace(/-+$/, '')}_${eco}`
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return `${n === 1 ? base : `${base}-${n}`}.pgn`
  })
}

/** `partien-YYYY-MM-DD.zip` with the local day. */
export function zipFileName(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `partien-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.zip`
}
