import { Chess } from 'chess.js'
import { positionKey } from '../chess/position.ts'

/** Ply a line view opens at: the start position, unless the URL names a position that lies on the line. */
export function startPlyFor(keys: string[], fen?: string): number {
  if (!fen) return 0
  try {
    const i = keys.indexOf(positionKey(new Chess(fen).fen()))
    return i < 0 ? 0 : i
  } catch { return 0 }
}
