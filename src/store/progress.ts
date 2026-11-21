import type { Card } from '../train/srs.ts'
import { parseFeedback } from '../train/feedback.ts'
import type { Feedback } from '../train/feedback.ts'
import { migrateOverlays } from './overlays.ts'
import type { OpeningOverlays } from './overlays.ts'
import { parseCoachMode } from '../coach/mode.ts'
import type { CoachSettings } from '../coach/mode.ts'
import { parseTeacher } from '../teacher/avatar.ts'
import type { TeacherSettings } from '../teacher/avatar.ts'
import { parsePlayer } from '../games/identity.ts'
import type { PlayerSettings } from '../games/identity.ts'
import { parseLastCourse, parseVisit } from './visit.ts'
import type { LastCourse, Visit } from './visit.ts'

/** cards: by card id (opening id + position key); a card without openingId is a legacy one that migrateProgress assigns once the bundle is known. days: cards answered per local calendar day (streak); understood: ids of correctly answered questions; applied: variations played in sparring. */
export interface Progress { schema: 1; cards: Record<string, Card>; overlays: OpeningOverlays; feedback: Feedback; days: Record<string, number>; understood: string[]; applied: string[]; settings: { sparringElo: number; teacher?: Partial<TeacherSettings>; player?: Partial<PlayerSettings>; visit?: Visit; lastCourse?: LastCourse } & CoachSettings }

export const KEY = 'schachtrainer-v1'
export const LEGACY_FEEDBACK_KEY = 'schachtrainer-feedback-v1'

export const emptyProgress = (): Progress => ({ schema: 1, cards: {}, overlays: {}, feedback: {}, days: {}, understood: [], applied: [], settings: { sparringElo: 1500 } })

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function validCard(c: unknown): c is Card {
  return isRecord(c) && typeof c.key === 'string' && typeof c.expectedUci === 'string' && typeof c.variationId === 'string' && (c.openingId === undefined || typeof c.openingId === 'string') &&
    ['due', 'intervalDays', 'ease', 'reps', 'lapses'].every((k) => typeof c[k] === 'number') && typeof c.contentVersion === 'string' &&
    (c.origin === 'baum' || c.origin === 'partie')
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const parseDays = (v: unknown): Record<string, number> =>
  isRecord(v) ? Object.fromEntries(Object.entries(v).filter(([k, n]) => /^\d{4}-\d{2}-\d{2}$/.test(k) && typeof n === 'number' && Number.isFinite(n) && n > 0)) as Record<string, number> : {}

/** Throws on malformed JSON or an unknown schema; never returns a partial state. */
export function importProgress(json: string): Progress {
  const data: unknown = JSON.parse(json)
  if (!isRecord(data) || data.schema !== 1) throw new Error('Unbekanntes Dateiformat (erwartet: Schachtrainer-Fortschritt, Schema 1)')
  if (!isRecord(data.cards) || !Object.values(data.cards).every(validCard)) throw new Error('Die Karten in der Datei sind beschädigt')
  const overlays = migrateOverlays(data.overlays)
  const settings = isRecord(data.settings) && typeof data.settings.sparringElo === 'number' ? { sparringElo: data.settings.sparringElo } : { sparringElo: 1500 }
  const coachMode = isRecord(data.settings) ? parseCoachMode(data.settings.coachMode) : {}
  const teacher = isRecord(data.settings) ? parseTeacher(data.settings.teacher) : {}
  const player = isRecord(data.settings) ? parsePlayer(data.settings.player) : {}
  const visit = isRecord(data.settings) ? parseVisit(data.settings.visit) : undefined
  const lastCourse = isRecord(data.settings) ? parseLastCourse(data.settings.lastCourse) : undefined
  const withMode = { ...settings, ...(Object.keys(coachMode).length ? { coachMode } : {}), ...(Object.keys(player).length ? { player } : {}), ...(visit ? { visit } : {}), ...(lastCourse ? { lastCourse } : {}) }
  return { schema: 1, cards: data.cards as Record<string, Card>, overlays, feedback: parseFeedback(JSON.stringify(data.feedback ?? {})), days: parseDays(data.days), understood: strings(data.understood), applied: strings(data.applied), settings: Object.keys(teacher).length ? { ...withMode, teacher } : withMode }
}

export const exportProgress = (p: Progress): string => JSON.stringify(p, null, 1)

export const DEFECT_KEY = 'schachtrainer-v1-defekt'

/** Returns false if the browser refused to store (quota, blocked). */
export function saveProgress(storage: Storage, p: Progress): boolean {
  try { storage.setItem(KEY, JSON.stringify(p)); return true } catch { return false }
}

export type ImportResult = { ok: true; progress: Progress } | { ok: false; error: string }

/** Parses and stores an imported file; on any failure the stored state stays as it was. */
export function tryImport(storage: Storage, json: string): ImportResult {
  let progress: Progress
  try { progress = importProgress(json) } catch (e) { return { ok: false, error: (e as Error).message } }
  if (!saveProgress(storage, progress)) return { ok: false, error: 'Der Browser konnte den Stand nicht speichern (Speicher voll oder gesperrt).' }
  return { ok: true, progress }
}

/** Broken or missing storage gives the empty state; an unreadable stored state is kept under DEFECT_KEY. The legacy feedback key is migrated once. */
export function loadProgress(storage: Storage): Progress {
  let p = emptyProgress()
  try {
    const raw = storage.getItem(KEY)
    if (raw) {
      try { p = importProgress(raw) } catch {
        try { storage.setItem(DEFECT_KEY, raw) } catch { /* best effort backup */ }
      }
    }
    const legacy = storage.getItem(LEGACY_FEEDBACK_KEY)
    if (legacy !== null) {
      const merged = { ...p, feedback: { ...parseFeedback(legacy), ...p.feedback } }
      if (saveProgress(storage, merged)) storage.removeItem(LEGACY_FEEDBACK_KEY)
      p = merged
    }
  } catch { /* storage unreadable: empty state */ }
  return p
}

/** Stores the start-page snapshot into the *stored* state, not into a possibly outdated in-memory copy (e.g. a second tab saved meanwhile). */
export function recordVisitIn(storage: Storage, v: Visit): void {
  const fresh = loadProgress(storage)
  saveProgress(storage, { ...fresh, settings: { ...fresh.settings, visit: v } })
}
