import type { FigurId, Gefuehl } from './avatar.ts'
import type { QuipCategory } from './quips.ts'

/** The ten pictures per teacher (public/lehrer/<figur>-<gefuehl>.webp). */
export const GEFUEHLE: readonly Gefuehl[] = ['neutral', 'freude', 'begeistert', 'lachen', 'sarkastisch', 'nachdenklich', 'mitleid', 'besorgt', 'aergerlich', 'entsetzt']

/** THE place to change who shows what: the default feeling per event ... */
export const MOOD_TABLE: Record<QuipCategory, Gefuehl> = {
  bester_zug: 'begeistert', gut: 'freude', repertoire_treffer: 'freude', ungenau: 'nachdenklich', fehler: 'besorgt', patzer: 'entsetzt',
  repertoire_abweichung: 'nachdenklich', gegner_verlaesst_theorie: 'lachen', gegner_fehler: 'lachen', schach_gegeben: 'freude',
  matt_gesetzt: 'begeistert', matt_bekommen: 'mitleid', patt_remis: 'nachdenklich', zuruecknehmen: 'sarkastisch', aufgeben: 'mitleid',
  partie_start: 'freude', lange_bedenkzeit: 'nachdenklich',
}

/** ... and the character of each teacher (mann = Jonas, frau = Mira, meister = Aldo, fuchs = Ferro): where one deviates from the default. */
export const MOOD_OVERRIDES: Record<FigurId, Partial<Record<QuipCategory, Gefuehl>>> = {
  mann: { zuruecknehmen: 'mitleid' },
  frau: { ungenau: 'sarkastisch', fehler: 'sarkastisch', patzer: 'aergerlich', repertoire_abweichung: 'aergerlich' },
  meister: { fehler: 'mitleid', zuruecknehmen: 'mitleid', partie_start: 'neutral' },
  fuchs: { ungenau: 'sarkastisch', fehler: 'lachen', patzer: 'lachen', matt_bekommen: 'sarkastisch' },
}

/** The feeling for an event; an unknown event is neutral. */
export const moodFor = (figur: FigurId, event: QuipCategory): Gefuehl => MOOD_OVERRIDES[figur][event] ?? MOOD_TABLE[event] ?? 'neutral'

/** Clearly better or worse than this (centipawns, from the player's view) shows in the face. */
export const POSITION_MOOD_CP = 150

/** Mood of the position from an evaluation that exists anyway (no extra engine call); null = no evaluation yet. */
export function positionMood(cpForPlayer: number | null): Gefuehl {
  if (cpForPlayer === null) return 'neutral'
  return cpForPlayer >= POSITION_MOOD_CP ? 'freude' : cpForPlayer <= -POSITION_MOOD_CP ? 'besorgt' : 'neutral'
}

/** What the avatar shows: the feeling of the current event while there is one (a quip is running), otherwise the position. */
export const avatarMood = (figur: FigurId, event: QuipCategory | null, cpForPlayer: number | null): Gefuehl =>
  event ? moodFor(figur, event) : positionMood(cpForPlayer)
