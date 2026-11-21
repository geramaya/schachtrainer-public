import type { StoredGame } from '../games/model.ts'
import { resultFor, sideOfPlayer } from '../games/identity.ts'
import type { PlayerSettings } from '../games/identity.ts'
import type { Visit } from '../store/visit.ts'

export type Pose = 'h1' | 'h2' | 'h3'
export type Success = 'stage' | 'streak' | 'win'

export const STREAK_MARKS = [3, 7, 14, 30, 60, 100]
/** Highest streak mark reached (0 below the first). */
export const streakMark = (n: number): number => STREAK_MARKS.filter((m) => m <= n).pop() ?? 0

/** Won games of the player since `since` (ms): own result "Sieg", own games only (imports are not "won since the last visit"). */
export function gamesWonSince(games: StoredGame[], me: PlayerSettings, since: number): number {
  return games.filter((g) => {
    const t = Date.parse(g.date)
    return g.source !== 'import' && Number.isFinite(t) && t > since && resultFor(g, sideOfPlayer(g, me)) === 'Sieg'
  }).length
}

/** What happened since the last visit; nothing to cheer for on the first visit. */
export function successSince(prev: Visit | undefined, now: { stagesDone: number; streak: number; wins: number }): Success | null {
  if (!prev) return null
  if (now.stagesDone > prev.stagesDone) return 'stage'
  if (streakMark(now.streak) > streakMark(prev.streak)) return 'streak'
  if (now.wins > 0) return 'win'
  return null
}

interface Situation { due: number; success: Success | null; firstVisit: boolean }

/** h3 = success since the last visit, h1 = waving (due cards, or the first visit), h2 = pointing at the board (nothing due). */
export function heroPose(s: Situation): Pose {
  if (s.success) return 'h3'
  return s.due > 0 || s.firstVisit ? 'h1' : 'h2'
}

const IMAGES: Record<Pose, { src: string; alt: string }> = {
  h1: { src: 'hero/ferro-h1.webp', alt: 'Ferro, der Fuchs-Professor, winkt dir mit einem Springer zu' },
  h2: { src: 'hero/ferro-h2.webp', alt: 'Ferro, der Fuchs-Professor, zeigt einladend aufs Brett' },
  h3: { src: 'hero/ferro-h3.webp', alt: 'Ferro, der Fuchs-Professor, zwinkert dir zu und hält einen Pokal' },
}
export const heroImage = (p: Pose): { src: string; alt: string } => IMAGES[p]

/** Speech bubble of Ferro (max. 90 characters); final texts. */
export function heroBubble(s: Situation & { streak: number }): string {
  if (s.success === 'stage') return 'Eine Stufe fertig. Der Fuchs ist beeindruckt, und das will was heißen.'
  if (s.success === 'streak') return `${s.streak} Tage in Folge. Du bist hartnäckiger als ich am Hühnerstall.`
  if (s.success === 'win') return "Gewonnen, seit ich dich zuletzt sah. Ich tu so, als wär's mein Verdienst."
  if (s.due === 1) return 'Eine Karte ist fällig. Nur eine. Der Fuchs kann warten, aber nicht ewig.'
  if (s.due > 1) return `${s.due} Karten sind fällig. Schnapp sie dir, bevor sie weglaufen.`
  return s.firstVisit ? 'Na, wieder da? Dann los, die Hühner warten nicht ewig.' : 'Heute ist nichts fällig. Spiel trotzdem, ich hab Hunger auf Beute.'
}
