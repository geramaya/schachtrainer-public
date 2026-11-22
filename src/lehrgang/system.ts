import { frequencyText } from './frequency.ts'
import { toGermanSan } from '../chess/notation.ts'
import type { Ast, HauptZug, System } from './types.ts'

/** The line shown on the system page: the main line, or main line up to the deviation plus the branch (`abzweig` = plies before the deviation, -1 = main line). An unknown id means the main line. */
export function linieMitAst(sys: Pick<System, 'hauptlinie'>, astId: string | null): { zuege: HauptZug[]; abzweig: number } {
  const ast = sys.hauptlinie.aeste.find((a) => a.id === astId)
  return ast ? { zuege: [...sys.hauptlinie.zuege.slice(0, ast.ab), ...ast.zuege], abzweig: ast.ab } : { zuege: sys.hauptlinie.zuege, abzweig: -1 }
}

/** "4. Ld3 (etwa 2 von 10)": the deviating move with its number (black: "4… Lxd3") and, when known, how often it comes. */
export function astLabel(a: Ast): string {
  const nr = Math.floor(a.ab / 2) + 1
  return `${nr}${a.ab % 2 === 0 ? '.' : '…'} ${toGermanSan(a.zuege[0]!.san)}${a.anteil === null ? '' : ` (${frequencyText(a.anteil)})`}`
}

export type RaetselZug = { ok: true; antwort: string | null; naechst: number; fertig: boolean } | { ok: false; erwartet: string }

/** The solver's move number `idx` (index into the solution, even) played as `uci`: a right move brings the reply of the opponent (played by the page) and the next index; the last move finishes. */
export function pruefeRaetselZug(loesungUci: string[], idx: number, uci: string): RaetselZug {
  if (loesungUci[idx] !== uci) return { ok: false, erwartet: loesungUci[idx]! }
  const antwort = loesungUci[idx + 1] ?? null
  return { ok: true, antwort, naechst: idx + (antwort ? 2 : 1), fertig: antwort === null || idx + 2 >= loesungUci.length }
}
