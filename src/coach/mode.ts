export type CoachMode = 'immer' | 'nach-zug' | 'aus'
export type CoachKey = 'lernen' | 'verstehen' | 'festigen' | 'anwenden' | 'raetsel'
export interface CoachSettings { coachMode?: Partial<Record<CoachKey, CoachMode>> }

/** Drill, questions and riddles must not give the answer away: coach only after the move. */
export const DEFAULT_COACH_MODE: Record<CoachKey, CoachMode> = { lernen: 'immer', verstehen: 'nach-zug', festigen: 'nach-zug', anwenden: 'immer', raetsel: 'nach-zug' }

const MODES: readonly string[] = ['immer', 'nach-zug', 'aus']
export const isCoachMode = (v: unknown): v is CoachMode => typeof v === 'string' && MODES.includes(v)

export const coachModeFor = (s: CoachSettings, k: CoachKey): CoachMode => s.coachMode?.[k] ?? DEFAULT_COACH_MODE[k]

export const withCoachMode = <T extends CoachSettings>(s: T, k: CoachKey, m: CoachMode): T => ({ ...s, coachMode: { ...s.coachMode, [k]: m } })

/** Keeps only known stages with valid modes; anything else in stored data is dropped. */
export function parseCoachMode(v: unknown): Partial<Record<CoachKey, CoachMode>> {
  const out: Partial<Record<CoachKey, CoachMode>> = {}
  if (typeof v !== 'object' || v === null) return out
  for (const k of Object.keys(DEFAULT_COACH_MODE) as CoachKey[]) {
    const m = (v as Record<string, unknown>)[k]
    if (isCoachMode(m)) out[k] = m
  }
  return out
}
