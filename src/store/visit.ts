import { STAGES } from '../router.ts'
import type { Stage } from '../router.ts'

/** What the start page remembers of the last visit, to cheer for what happened since: time, finished stages, day streak. */
export interface Visit { at: number; stagesDone: number; streak: number }
/** The variation and stage the player worked on last ("Kurs fortsetzen"). */
export interface LastCourse { variationId: string; stage: Stage }

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const count = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0

export function parseVisit(v: unknown): Visit | undefined {
  return isRecord(v) && typeof v.at === 'number' && Number.isFinite(v.at) && count(v.stagesDone) && count(v.streak) ? { at: v.at, stagesDone: v.stagesDone, streak: v.streak } : undefined
}

export function parseLastCourse(v: unknown): LastCourse | undefined {
  return isRecord(v) && typeof v.variationId === 'string' && v.variationId !== '' && STAGES.includes(v.stage as Stage) ? { variationId: v.variationId, stage: v.stage as Stage } : undefined
}
