import { hrefMeinePartien } from '../router.ts'

/**
 * Where to go after the end-of-game analysis: the stored game in the game view, which starts at the first position with
 * the teacher commenting move by move. The Sparring page itself keeps state of the played game (pending, hold, clock,
 * the card of the last move, `view`) and would stick to the final position. Null = stay (nothing stored to open).
 */
export function afterAnalysisHash(id: string | null, stored: boolean): string | null {
  return id && stored ? hrefMeinePartien(id) : null
}
