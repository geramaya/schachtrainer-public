import type { Stage } from '../router.ts'
import { STAGES } from '../router.ts'
import type { ContentBundle } from '../content/types.ts'
import { CATALOG } from '../content/catalog.ts'
import type { CatalogEntry } from '../content/catalog.ts'
import { formatLine } from '../chess/notation.ts'
import type { Progress } from '../store/progress.ts'
import { dueCards } from './srs.ts'
import { variationScopes } from './scope.ts'
import { openingProgress, variationStages } from './pipeline.ts'
import type { StageId, VariationStages } from './pipeline.ts'

type Bars = Record<StageId, { done: number; total: number }>
export type CourseStep = { kind: 'start' } | { kind: 'next'; stage: StageId } | { kind: 'done' }

export const STAGE_NAME: Record<StageId, string> = { lernen: 'Lernen', verstehen: 'Verstehen', festigen: 'Festigen', anwenden: 'Anwenden' }

/** Share of all finished stage slots of a course (variations x stages), in whole percent; same measure as the opening page. */
export function courseTotalPct(bars: Bars): number {
  const all = STAGES.reduce((n, s) => n + bars[s].total, 0)
  return all ? Math.round((100 * STAGES.reduce((n, s) => n + bars[s].done, 0)) / all) : 0
}

/** Where a course goes on: start if nothing is done and nothing was practised, due cards with no finished stage mean "Festigen", else the first stage that still has open variations. */
export function courseStep(bars: Bars, due = 0): CourseStep {
  if (STAGES.every((s) => bars[s].done === 0)) return due > 0 && bars.festigen.total > 0 ? { kind: 'next', stage: 'festigen' } : { kind: 'start' }
  const open = STAGES.find((s) => bars[s].total > 0 && bars[s].done < bars[s].total)
  return open ? { kind: 'next', stage: open } : { kind: 'done' }
}

export const courseCta = (s: CourseStep): string => (s.kind === 'start' ? 'Kurs starten ▸' : s.kind === 'next' ? `Weiter: ${STAGE_NAME[s.stage]} ▸` : 'Abgeschlossen ✓')

export interface HeroCta { label: 'Kurs fortsetzen' | 'Kurs starten'; variationId: string; stage: Stage }

/** Start page button: continue the last worked variation at its next open stage, or start the first variation. */
export function heroCta(i: { last?: { variationId: string; stage: Stage }; stagesOf: (variationId: string) => VariationStages | null; startVariationId: string }): HeroCta {
  const states = i.last ? i.stagesOf(i.last.variationId) : null
  if (i.last && states) {
    const open = STAGES.find((s) => states[s] === 'leer' || states[s] === 'begonnen')
    return { label: 'Kurs fortsetzen', variationId: i.last.variationId, stage: open ?? i.last.stage }
  }
  return { label: 'Kurs starten', variationId: i.startVariationId, stage: 'lernen' }
}

export interface CourseRow extends Omit<CatalogEntry, 'entry'> {
  entryText: string; available: boolean; count: number; bars: Bars; pct: number; step: CourseStep; due: number
}

/** One row per catalog entry for the start page and the course page: progress bars, total percent, next step and due cards. */
export function courseRows(b: ContentBundle, p: Progress, now: number): CourseRow[] {
  const scopes = variationScopes(b, p.overlays)
  return CATALOG.map((c) => {
    const o = b.openings.find((x) => x.id === c.id)
    const states = (o?.variations ?? []).map((v) => variationStages(b, p, v.id, now))
    const scope = new Set((o?.variations ?? []).flatMap((v) => [...(scopes.get(v.id) ?? [])]))
    const bars = openingProgress(states)
    const due = dueCards(Object.values(p.cards), now, scope).length
    return {
      id: c.id, code: c.code, acc: c.acc, group: c.group, name: o?.name ?? c.name, side: o?.side ?? c.side, role: o?.role ?? c.role,
      entryText: o ? formatLine(o.entry) : (c.entryText ?? formatLine(c.entry)), available: !!o, count: o?.variations.length ?? 0,
      bars, pct: courseTotalPct(bars), step: courseStep(bars, due), due,
    }
  })
}
