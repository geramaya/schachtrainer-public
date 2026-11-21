import { ref } from 'vue'
import type { ContentBundle } from '../content/types.ts'
import { cardsForBundle, syncCards } from '../train/srs.ts'
import { migrateProgress } from './migrate.ts'
import { needsMigration, saveBackup } from './backup.ts'
import { emptyProgress, loadProgress, recordVisitIn, saveProgress } from './progress.ts'
import type { Progress } from './progress.ts'
import { recordTraining } from '../train/streak.ts'
import { markOnce } from '../train/pipeline.ts'
import type { Stage } from '../router.ts'
import type { Visit } from './visit.ts'

/** localStorage itself can throw (blocked cookies/storage); then the app runs with in-memory state. */
export function browserStorage(): Storage | null {
  try { return localStorage } catch { return null }
}

const storage = browserStorage()

/** The one reactive learning state; every change is written to localStorage. */
export const progress = ref<Progress>(storage ? loadProgress(storage) : emptyProgress())

export function update(change: (p: Progress) => Progress): void {
  progress.value = change(progress.value)
  if (storage) saveProgress(storage, progress.value)
}

/** Creates cards for every own-move node of the bundle; new cards count as "neu", not "fällig". */
export function syncBundleCards(b: ContentBundle): void {
  // a migration drops what no opening can take: keep the old state first (restorable under "Über")
  if (storage && needsMigration(progress.value)) saveBackup(storage, progress.value, Date.now())
  update((p) => {
    const m = migrateProgress(p, b)
    return { ...m, cards: syncCards(m.cards, cardsForBundle(b, m.overlays)) }
  })
}

export const storageAvailable = (): Storage | null => storage

/** Counts one answered card for the streak of the current day. */
export const recordAnswer = (): void => update((p) => ({ ...p, days: recordTraining(p.days, Date.now(), 1) }))
export const markUnderstood = (questionId: string): void => update((p) => ({ ...p, understood: markOnce(p.understood, questionId) }))
/** id from applyDeviationId / applyPuzzleId */
export const markApplied = (id: string): void => update((p) => ({ ...p, applied: markOnce(p.applied, id) }))

/** Remembers the variation and stage worked on last, for "Kurs fortsetzen"; writes only on a change. */
export function setLastCourse(variationId: string, stage: Stage): void {
  const l = progress.value.settings.lastCourse
  if (l?.variationId === variationId && l.stage === stage) return
  update((p) => ({ ...p, settings: { ...p.settings, lastCourse: { variationId, stage } } }))
}

/** Stores the snapshot the start page compares against at the next visit (merged into the stored state, see recordVisitIn). */
export function recordVisit(v: Visit): void {
  if (storage) recordVisitIn(storage, v)
  progress.value = { ...progress.value, settings: { ...progress.value.settings, visit: v } }
}
