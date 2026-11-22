import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../coach/cevalSettings.ts'
import type { EngineLock, EngineSettings, StorageLike } from '../coach/cevalSettings.ts'

/** Own key and default (off) for the Lehrgang prototype: independent of the engine setting of the rest of the app. */
export const LEHRGANG_ENGINE_KEY = 'schachtrainer.lehrgang.engine'
const LEHRGANG_DEFAULTS: EngineSettings = { ...DEFAULT_SETTINGS, enabled: false }
export const loadLehrgangSettings = (s: StorageLike | undefined): EngineSettings => loadSettings(s, LEHRGANG_ENGINE_KEY, LEHRGANG_DEFAULTS)
export const saveLehrgangSettings = (e: EngineSettings, s: StorageLike | undefined): void => saveSettings(e, s, LEHRGANG_ENGINE_KEY)

/** The engine field is part of the system prototype only: system page, its main line (kind s) and its model games (id "<system>/<game>"). */
export const hasEngine = (kind: string, itemId: string): boolean => kind === 's' || (kind === 'm' && itemId.includes('/'))

/** System page: only an open puzzle is a task whose answer the engine would leak. */
export const systemEngineTask = (schritt: string, raetselOffen: boolean): boolean => schritt === 'motive' && raetselOffen

/** Practice page: Nachspielen / Aus dem Kopf hide the engine while the learner is to move. */
export const uebenEngineTask = (i: { modus: string; myTurn: boolean; solved: boolean }): boolean => i.modus !== 'vorfuehren' && i.myTurn && !i.solved

/** Lifting the lock on purpose counts as a help (the caller counts it). */
export const engineLockFor = (task: boolean, unlocked: boolean): EngineLock => (task && !unlocked ? 'task' : null)
