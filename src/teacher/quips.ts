import type { FigurId } from './avatar.ts'
import { hash } from './blocks.ts'

export type QuipCategory =
  | 'bester_zug' | 'gut' | 'ungenau' | 'fehler' | 'patzer'
  | 'repertoire_treffer' | 'repertoire_abweichung' | 'gegner_verlaesst_theorie' | 'gegner_fehler'
  | 'schach_gegeben' | 'matt_gesetzt' | 'matt_bekommen' | 'patt_remis'
  | 'zuruecknehmen' | 'aufgeben' | 'partie_start' | 'lange_bedenkzeit'

/** Quips per teacher and category; anything may be missing. Templates may hold {zug}, {figur}, {figur_akk}. */
export type QuipBook = Partial<Record<FigurId, Partial<Record<QuipCategory, string[]>>>>
export interface QuipFacts { zug?: string; figur?: string; figur_akk?: string }

/** How many of the last spoken quips of a game may not come again. */
export const RECENT = 6

/** Share of events that get a quip: Fehler, Patzer, mate and the like always, praise only now and then. */
export const QUIP_CHANCE: Record<QuipCategory, number> = {
  bester_zug: 0.5, gut: 0.33, ungenau: 0.5, fehler: 1, patzer: 1,
  repertoire_treffer: 0.5, repertoire_abweichung: 1, gegner_verlaesst_theorie: 1, gegner_fehler: 0.5,
  schach_gegeben: 0.5, matt_gesetzt: 1, matt_bekommen: 1, patt_remis: 1,
  zuruecknehmen: 1, aufgeben: 1, partie_start: 1, lange_bedenkzeit: 1,
}

/** Fills the placeholders; null if the template needs a fact that is missing (never an unfilled "{zug}"). */
export function fillQuip(template: string, facts: QuipFacts): string | null {
  let missing = false
  const text = template.replace(/\{(zug|figur_akk|figur)\}/g, (_, k: keyof QuipFacts) => {
    const v = facts[k]
    if (v === undefined) missing = true
    return v ?? ''
  })
  return missing ? null : text
}

/**
 * The quip for one event: `categories` in priority order, the first with a quip wins (at most one per half-move).
 * Deterministic in `seed`; skips quips of the last RECENT in `spoken`; null when there is nothing to say.
 */
export function pickQuip(book: QuipBook, figur: FigurId, categories: readonly QuipCategory[], facts: QuipFacts, seed: string, spoken: readonly string[]): string | null {
  const recent = new Set(spoken.slice(-RECENT))
  for (const c of categories) {
    if (hash(`${seed}|${c}|chance`) % 100 >= QUIP_CHANCE[c] * 100) continue
    const options = (book[figur]?.[c] ?? []).map((t) => fillQuip(t, facts)).filter((t): t is string => t !== null && !recent.has(t))
    if (options.length) return options[hash(`${seed}|${c}`) % options.length]!
  }
  return null
}
