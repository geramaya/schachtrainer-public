import { DEFAULT_HOLD, parseHold } from './hold.ts'
import type { HoldMode } from './hold.ts'

export const FIGUREN = [
  { id: 'mann', name: 'Jonas' }, { id: 'frau', name: 'Mira' }, { id: 'meister', name: 'Meister Aldo' }, { id: 'fuchs', name: 'Fuchs Ferro' },
] as const
export type FigurId = (typeof FIGUREN)[number]['id']
export type Gefuehl = 'neutral' | 'freude' | 'begeistert' | 'lachen' | 'sarkastisch' | 'nachdenklich' | 'mitleid' | 'besorgt' | 'aergerlich' | 'entsetzt'
/** `quips`: sarcastic one-liners (off by default); `speak`: read them aloud where audio exists (off by default). */
export interface TeacherSettings { on: boolean; figur: FigurId; quips: boolean; speak: boolean; /** when a move is held for the decision */ hold: HoldMode }

const url = (base: string, figur: FigurId, g: Gefuehl) => `${base}lehrer/${figur}-${g}.webp`

/** Image candidates in order: the feeling, then the neutral picture of the same figure (the component then falls back to no image). */
export const avatarChain = (figur: FigurId, g: Gefuehl, base: string): string[] =>
  g === 'neutral' ? [url(base, figur, g)] : [url(base, figur, g), url(base, figur, 'neutral')]

const isFigur = (v: unknown): v is FigurId => FIGUREN.some((f) => f.id === v)

/** Keeps only valid parts of stored data. */
export function parseTeacher(v: unknown): Partial<TeacherSettings> {
  const r = typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {}
  return {
    ...(typeof r.on === 'boolean' ? { on: r.on } : {}), ...(isFigur(r.figur) ? { figur: r.figur } : {}),
    ...(parseHold(r.hold) ? { hold: parseHold(r.hold)! } : {}),
    ...(typeof r.quips === 'boolean' ? { quips: r.quips } : {}), ...(typeof r.speak === 'boolean' ? { speak: r.speak } : {}),
  }
}

export const teacherOf = (s: { teacher?: Partial<TeacherSettings> }): TeacherSettings => ({ on: s.teacher?.on ?? true, figur: s.teacher?.figur ?? 'mann', quips: s.teacher?.quips ?? false, speak: s.teacher?.speak ?? false, hold: s.teacher?.hold ?? DEFAULT_HOLD })
