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

/** "Besten Zug übernehmen": like undoHeld, but the best move of the engine is played in place of the held one. */
export function adoptBest(held: Held | null, ucis: string[], phase: Phase): { ucis: string[]; error: ReviewError } | null {
  const r = undoHeld(held, ucis, phase)
  return r && held ? { ...r, ucis: [...r.ucis, held.j.betterUci] } : null
}

/** "Weiterspielen" is only possible while the game is running and a move is held. */
export const canKeep = (held: Held | null, phase: Phase): boolean => held !== null && phase === 'play'
