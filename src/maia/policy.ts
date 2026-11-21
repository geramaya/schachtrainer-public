import { Chess } from 'chess.js'
import { MOVE_INDEX, mirrorMove } from './vocab.ts'

export interface PickOptions {
  /** 0 = always the most probable legal move; > 0 = sampling from softmax(logit / temperature) */
  temperature: number
  /** uniform in [0, 1) */
  random: () => number
}

/** Legal moves as UCI from chess.js, ordered by their text (a fixed order makes sampling reproducible). */
const legalUcis = (fen: string): string[] => new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? '')).sort()

/**
 * The move of the model for a position. Only the legal moves of chess.js take part (M9, like `_masked_softmax` in maia2/inference.py):
 * all other logits are ignored, whatever their value. Black: the model saw the mirrored board, so the legal moves are looked up
 * mirrored and the answer is the real move. Throws if no legal move is left; the caller must not play an unchecked model move.
 */
export function chooseMove(logits: ArrayLike<number>, fen: string, o: PickOptions): string {
  const black = fen.split(' ')[1] === 'b'
  const cands: Array<{ uci: string; logit: number }> = []
  for (const uci of legalUcis(fen)) {
    const idx = MOVE_INDEX.get(black ? mirrorMove(uci) : uci)
    if (idx !== undefined && idx < logits.length) cands.push({ uci, logit: logits[idx]! })
  }
  if (!cands.length) throw new Error(`No legal move to choose from: ${fen}`)
  const best = Math.max(...cands.map((c) => c.logit))
  if (o.temperature <= 0) return cands.find((c) => c.logit === best)!.uci
  const w = cands.map((c) => Math.exp((c.logit - best) / o.temperature))
  let r = o.random() * w.reduce((a, b) => a + b, 0)
  for (let i = 0; i < cands.length; i++) { r -= w[i]!; if (r < 0) return cands[i]!.uci }
  return cands.at(-1)!.uci
}
