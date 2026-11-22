/** Info marks of a sentence: "Gd4c6" = green arrow d4 to c6, "Rc6" = red circle on c6 (G green, R red, B blue, Y yellow, as on Lichess). */
export type MarkeBrush = 'green' | 'red' | 'blue' | 'yellow'
export interface Marke { brush: MarkeBrush; orig: string; dest?: string }

const BRUSH: Record<string, MarkeBrush> = { G: 'green', R: 'red', B: 'blue', Y: 'yellow' }
const CODE = /^([GRBY])([a-h][1-8])([a-h][1-8])?$/

export function parseMarke(code: string): Marke | null {
  const m = CODE.exec(code)
  if (!m || m[2] === m[3]) return null
  return { brush: BRUSH[m[1]!]!, orig: m[2]!, ...(m[3] ? { dest: m[3] } : {}) }
}

/** The source files allow a string with separators or a list; the app only ever sees lists. */
export function listOf(v: string | string[] | undefined, sep: ',' | ';'): string[] {
  const parts = Array.isArray(v) ? v : typeof v === 'string' ? v.split(sep) : []
  return parts.map((p) => p.trim()).filter(Boolean)
}

const SITES: [RegExp, string][] = [[/(^|\.)wikipedia\.org$/, 'Wikipedia'], [/(^|\.)wikibooks\.org$/, 'Wikibooks'], [/(^|\.)chess\.com$/, 'Chess.com'], [/(^|\.)lichess\.org$/, 'Lichess']]

/** Links of the sources (the URL of each entry, with a readable site name); entries without a URL (notes such as "Stockfish-Verlust") are not links. */
export function quellenLinks(quellen: string[]): { url: string; label: string }[] {
  const out: { url: string; label: string }[] = []
  for (const q of quellen) {
    const url = /https?:\/\/\S+/.exec(q)?.[0]
    if (!url) continue
    let host: string
    try { host = new URL(url).hostname } catch { continue }
    out.push({ url, label: SITES.find(([re]) => re.test(host))?.[1] ?? host.replace(/^www\./, '') })
  }
  return out
}

/** The marks of a move or trap for the board, arrows first; unreadable codes are skipped (the build has already rejected them). */
export function markenOf(i: { pfeile?: string[]; felder?: string[] } | null | undefined): Marke[] {
  return [...(i?.pfeile ?? []), ...(i?.felder ?? [])].map(parseMarke).filter((m): m is Marke => !!m)
}
