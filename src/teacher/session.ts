import type { ReviewError } from '../train/review.ts'
import type { Judgement } from './judge.ts'

/** A Fehler/Patzer that waits for the player's decision. */
export interface Held { j: Judgement; uci: string; fenBefore: string; san: string; hinted: boolean; revealed: boolean }
export type Phase = 'setup' | 'play' | 'over'

/** Takes the held move back; only while the game is running. Returns the shortened game and the mistake for the training, or null. */
export function undoHeld(held: Held | null, ucis: string[], phase: Phase): { ucis: string[]; error: ReviewError } | null {
  if (!held || phase !== 'play') return null
  return {
    ucis: ucis.slice(0, -1),
    error: { ply: ucis.length - 1, uci: held.uci, san: held.san, lossCp: held.j.lossCp, severity: held.j.rating as 'fehler' | 'patzer', fenBefore: held.fenBefore, betterUci: held.j.betterUci, betterSan: held.j.betterSan },
  }
}

/** "Weiterspielen" is only possible while the game is running and a move is held. */
export const canKeep = (held: Held | null, phase: Phase): boolean => held !== null && phase === 'play'
