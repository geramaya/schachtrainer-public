import { formatLine } from '../chess/notation.ts'
import type { Variante } from './types.ts'
import { isTodo } from './types.ts'

const MIN_PLIES = 4

/** Display title per variety: its written name, else the line after the entry cut at the fewest plies (at least 4) that no other variety shares. */
export function variantTitles(vs: Variante[], entry: string[]): Map<string, string> {
  const e = entry.length
  const after = (v: Variante) => v.zuege.slice(e).map((z) => z.san)
  const out = new Map<string, string>()
  for (const v of vs) {
    if (!isTodo(v.name)) { out.set(v.id, v.name); continue }
    const mine = after(v)
    let k = Math.min(MIN_PLIES, mine.length)
    while (k < mine.length && vs.some((o) => o !== v && after(o).slice(0, k).join(' ') === mine.slice(0, k).join(' '))) k++
    out.set(v.id, formatLine(mine.slice(0, k), e))
  }
  return out
}
