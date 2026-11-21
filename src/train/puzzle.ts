import { Chess } from 'chess.js'
import type { Puzzle, Side } from '../content/types.ts'
import { applyUci } from '../chess/game.ts'

/** Lichess format: moves[0] is the opponent's move that creates the puzzle; the user then moves, replies alternate. */
export function puzzleStart(p: Puzzle): { fen: string; lastMove: [string, string]; userSide: Side } {
  const first = p.moves[0]!
  const r = applyUci(p.fen, first)
  if (!r) throw new Error(`Puzzle ${p.id}: first move ${first} is illegal`)
  return { fen: r.fen, lastMove: [first.slice(0, 2), first.slice(2, 4)], userSide: r.fen.split(' ')[1] === 'b' ? 'black' : 'white' }
}

/**
 * Judges the user's move. `played` = all moves of the puzzle played so far including moves[0].
 * Any move that mates counts as solved (Lichess convention for mate-in-one alternatives).
 */
export function puzzleStep(p: Puzzle, played: string[], uci: string): 'richtig' | 'falsch' | 'gelöst' {
  const chess = new Chess(p.fen)
  try {
    for (const m of played) chess.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] })
    chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }) // an illegal move is never right, even if the puzzle lists it
  } catch {
    return 'falsch'
  }
  if (uci === p.moves[played.length]) return played.length + 1 >= p.moves.length ? 'gelöst' : 'richtig'
  return chess.isCheckmate() ? 'gelöst' : 'falsch'
}

export const sortPuzzles = (list: Puzzle[]): Puzzle[] => [...list].sort((a, b) => a.rating - b.rating)
