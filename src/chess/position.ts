import { Chess } from 'chess.js'

/**
 * Position identity: FEN fields 1-4 (placement, side, castling, en passant); clocks dropped.
 * The en passant field is normalized through chess.js, which only keeps it when a legal
 * ep capture exists; Lichess/Stockfish FENs set it after every double step.
 */
export function positionKey(fen: string): string {
  return new Chess(fen).fen().split(' ').slice(0, 4).join(' ')
}
