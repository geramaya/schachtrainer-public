import { exportProgress, importProgress, saveProgress } from './progress.ts'
import type { Progress } from './progress.ts'

/** The state as it was before the last migration (one slot; a newer migration replaces it). */
export const BACKUP_KEY = 'schachtrainer-v1-sicherung'

interface Backup { savedAt: number; progress: string }

/** True for a state migrateProgress would still change: cards without openingId, or overlays grouped "white"/"black". */
export function needsMigration(p: Progress): boolean {
  return Object.values(p.cards).some((c) => c.openingId === undefined) || 'white' in p.overlays || 'black' in p.overlays
}

/** Returns false if the browser refused to store. */
export function saveBackup(storage: Storage, p: Progress, now: number): boolean {
  try { storage.setItem(BACKUP_KEY, JSON.stringify({ savedAt: now, progress: exportProgress(p) } satisfies Backup)); return true } catch { return false }
}

function readBackup(storage: Storage): Backup | null {
  try {
    const raw = storage.getItem(BACKUP_KEY)
    if (!raw) return null
    const b = JSON.parse(raw) as Partial<Backup>
    return typeof b.savedAt === 'number' && typeof b.progress === 'string' ? (b as Backup) : null
  } catch { return null }
}

/** Date and card count of the backup, or null if there is none or it is unreadable. */
export function backupInfo(storage: Storage): { savedAt: number; cards: number } | null {
  const b = readBackup(storage)
  if (!b) return null
  try { return { savedAt: b.savedAt, cards: Object.keys(importProgress(b.progress).cards).length } } catch { return null }
}

export type RestoreResult = { ok: true; progress: Progress } | { ok: false; error: string }

/** Puts the backup back as the live state; on any failure the live state stays as it was. */
export function restoreBackup(storage: Storage): RestoreResult {
  const b = readBackup(storage)
  if (!b) return { ok: false, error: 'Es gibt keine Sicherung (oder sie ist beschädigt).' }
  let progress: Progress
  try { progress = importProgress(b.progress) } catch (e) { return { ok: false, error: (e as Error).message } }
  if (!saveProgress(storage, progress)) return { ok: false, error: 'Der Browser konnte den Stand nicht speichern (Speicher voll oder gesperrt).' }
  return { ok: true, progress }
}
