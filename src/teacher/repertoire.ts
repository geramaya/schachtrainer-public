import type { ContentBundle, Side } from '../content/types.ts'
import type { OpeningOverlays } from '../store/overlays.ts'
import { expectedMove, treeFor } from '../content/tree.ts'
import { applyUci } from '../chess/game.ts'
import { positionKey } from '../chess/position.ts'
import { toGermanSan } from '../chess/notation.ts'
import { bookExit, gameFens } from '../train/review.ts'
import { BOOK_NOTES, pick } from './blocks.ts'

export type RepertoireNote =
  | { kind: 'treffer'; san: string }
  | { kind: 'abweichung'; plannedSan: string | null }
  | { kind: 'gegner' }

/** Where the move just played stands against the repertoire tree; null when the game was already out of the book or the opponent stays in the known replies. `ucisBefore` = the game so far. */
export function repertoireNote(ucisBefore: string[], uci: string, startFen: string, b: ContentBundle, openingId: string, ov: OpeningOverlays, ownSide: Side): RepertoireNote | null {
  if (bookExit(ucisBefore, b, openingId, ov, startFen) !== null) return null
  const fenBefore = gameFens(startFen, ucisBefore).at(-1)!
  if (!treeFor(b, openingId)[positionKey(fenBefore)]) return null // the game never was in the tree
  const own = (fenBefore.split(' ')[1] === 'b' ? 'black' : 'white') === ownSide
  const exit = bookExit([...ucisBefore, uci], b, openingId, ov, startFen)
  if (exit === null) return own ? { kind: 'treffer', san: applyUci(fenBefore, uci)!.san } : null
  if (!own) return { kind: 'gegner' }
  const planned = expectedMove(b, openingId, positionKey(fenBefore), ov)
  const plannedSan = planned ? applyUci(fenBefore, planned.uci)?.san ?? null : null
  return { kind: 'abweichung', plannedSan }
}

/** `reveal`: the planned move of a deviation is named (only after the player asked for it). */
export function repertoireSentence(n: RepertoireNote, seed: string, reveal = false): string {
  if (n.kind === 'treffer') return pick(seed, BOOK_NOTES.treffer(toGermanSan(n.san)))
  if (n.kind === 'abweichung') return pick(seed, reveal && n.plannedSan ? BOOK_NOTES.abweichungPlan(toGermanSan(n.plannedSan)) : [...BOOK_NOTES.abweichung])
  return pick(seed, [...BOOK_NOTES.gegner])
}
