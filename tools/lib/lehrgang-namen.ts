import { Chess } from 'chess.js'
import { formatLine } from '../../src/chess/notation.ts'
import { existsSync, readFileSync } from 'node:fs'
import { detectOpening, parseEcoTable } from '../../src/openings/eco.ts'
import type { EcoTable } from '../../src/openings/eco.ts'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const MIN_PLIES = 2

/**
 * Names for varieties from the chess-openings table (CC0): the deepest known position on the line gives the name (German when namesDe has it; with `wurzel` only a name of that family),
 * the moves after it - at least two, more while another variety has the same start - tell varieties apart. A line the table does not know gets no entry: no invented names.
 */
export function leiteNamen(varianten: { id: string; zuege: { san: string; uci: string }[] }[], eco: EcoTable, namesDe: Record<string, string>, wurzel?: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const v of varianten) {
    const ucis = v.zuege.map((z) => z.uci)
    let hit = detectOpening(eco, START, ucis)
    // a transposition can land in another family ("Scotch Game: Benima Defense" in the Italian): then the deepest name of the Lehrgang's own family
    for (let n = ucis.length - 1; wurzel && hit && rootOf(hit.name) !== wurzel && n > 0; n--) hit = detectOpening(eco, START, ucis.slice(0, n))
    if (!hit || (wurzel && rootOf(hit.name) !== wurzel)) continue
    const rest = v.zuege.slice(hit.plies).map((z) => z.san)
    const same = (k: number) => varianten.some((o) => o !== v && o.zuege.slice(0, hit.plies + k).map((z) => z.san).join(' ') === v.zuege.slice(0, hit.plies + k).map((z) => z.san).join(' '))
    let k = Math.min(MIN_PLIES, rest.length)
    while (k < rest.length && same(k)) k++
    const name = namesDe[hit.name] ?? hit.name
    out.set(v.id, k === 0 ? name : `${name}: ${formatLine(rest.slice(0, k), hit.plies).replace(/(\d+(?:\.|…)) /g, '$1')}`)
  }
  return out
}

/** public/eco/eco.json (npm run eco) as a table; undefined when the file is missing, then the names stay as written. */
export function ladeEco(file: string): EcoTable | undefined {
  return existsSync(file) ? (parseEcoTable(JSON.parse(readFileSync(file, 'utf8'))) ?? undefined) : undefined
}

const rootOf = (name: string) => name.split(':')[0]!

/** Ucis of a SAN line. */
function ucisOf(sans: string[]): string[] {
  const g = new Chess()
  return sans.map((san) => { const m = g.move(san); return m.from + m.to + (m.promotion ?? '') })
}

/** English name of the opening the entry line belongs to ("Italian Game"), the family a Lehrgang's variety names must start with. */
export function wurzelName(eco: EcoTable, entry: string[]): string | null {
  const hit = detectOpening(eco, START, ucisOf(entry))
  return hit ? rootOf(hit.name) : null
}
