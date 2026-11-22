export interface EngineSettings { enabled: boolean; multipv: number; depth: number; /** evaluation bar */ showBar: boolean; /** variations and arrows */ showLines: boolean; /** also while Stockfish thinks in a game */ whileThinking: boolean }

export const DEFAULT_SETTINGS: EngineSettings = { enabled: true, multipv: 3, depth: 22, showBar: true, showLines: true, whileThinking: false }
export const MULTIPV_RANGE = { min: 1, max: 5 }
export const DEPTH_RANGE = { min: 10, max: 30 }

const KEY = 'schachtrainer.engine'

export interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void }

const clampInt = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback

/** Stored data is untrusted: wrong types fall back to the default, numbers are clamped into their range. */
export function parseSettings(raw: unknown, d: EngineSettings = DEFAULT_SETTINGS): EngineSettings {
  const o = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  return {
    enabled: typeof o.enabled === 'boolean' ? o.enabled : d.enabled,
    multipv: clampInt(o.multipv, MULTIPV_RANGE.min, MULTIPV_RANGE.max, d.multipv),
    depth: clampInt(o.depth, DEPTH_RANGE.min, DEPTH_RANGE.max, d.depth),
    showBar: typeof o.showBar === 'boolean' ? o.showBar : d.showBar,
    showLines: typeof o.showLines === 'boolean' ? o.showLines : d.showLines,
    whileThinking: typeof o.whileThinking === 'boolean' ? o.whileThinking : d.whileThinking,
  }
}

export function loadSettings(storage: StorageLike | undefined, key = KEY, defaults = DEFAULT_SETTINGS): EngineSettings {
  try {
    const raw = storage?.getItem(key)
    return parseSettings(raw ? JSON.parse(raw) : undefined, defaults)
  } catch {
    return defaults
  }
}

export function saveSettings(s: EngineSettings, storage: StorageLike | undefined, key = KEY): void {
  try {
    storage?.setItem(key, JSON.stringify(s))
  } catch {
    // storage full or blocked: the setting then only lives until the page is closed
  }
}

/** Why the engine field shows no analysis: `task` = an exercise is open (analysis only after the move), `busy` = a game job owns the engine. */
export type EngineLock = 'task' | 'busy' | null
export type EngineAccess = 'on' | 'off' | 'locked' | 'busy'

export function engineAccess(enabled: boolean, lock: EngineLock): EngineAccess {
  if (lock === 'task') return 'locked'
  if (!enabled) return 'off'
  return lock === 'busy' ? 'busy' : 'on'
}
