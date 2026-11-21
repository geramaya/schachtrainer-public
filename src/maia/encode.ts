/**
 * Input of the Maia-2 model: 18 planes of 8x8 (float32) plus the Elo class of both sides.
 * Port of `board_to_tensor`, `map_to_category` / `create_elo_dict` and `preprocessing` in CSSLab/maia2 (`maia2/utils.py`, `maia2/inference.py`, MIT, commit 67bee6ce).
 * Planes: 0-5 own P N B R Q K, 6-11 opponent P N B R Q K, 12 side to move (always 1: Black is mirrored to White),
 * 13-16 castling rights (own K, own Q, opponent K, opponent Q), 17 en passant square. Row = rank - 1 (a1 = row 0, col 0).
 * The rights and the en passant square are read from the FEN as chess.js writes it (en passant only if a capture is possible).
 */
export const LEVEL_MIN = 1100
export const LEVEL_MAX = 1900
export const ELO_CLASSES = 11

/** Elo class 0..10: <1100 = 0, 1100-1199 = 1 … 1900-1999 = 9, >=2000 = 10. Clamped so the model never gets an index outside its embedding (M8). */
export function eloCategory(elo: number): number {
  if (!Number.isFinite(elo)) throw new RangeError(`Elo is not a number: ${elo}`)
  return Math.min(ELO_CLASSES - 1, Math.max(0, Math.floor((elo - 1000) / 100)))
}

const PIECES = 'pnbrqk'

export function maiaInput(fen: string, level: number): { boards: Float32Array; eloSelf: number; eloOppo: number } {
  const [placement, turn, castling, ep] = fen.split(' ')
  if (!placement || (turn !== 'w' && turn !== 'b') || castling === undefined || ep === undefined) throw new Error(`Invalid FEN: ${fen}`)
  const black = turn === 'b'
  const boards = new Float32Array(18 * 64)
  const set = (plane: number, rank: number, file: number) => { boards[plane * 64 + (black ? 7 - rank : rank) * 8 + file] = 1 }

  placement.split('/').forEach((line, i) => {
    const rank = 7 - i
    let file = 0
    for (const ch of line) {
      if (ch >= '1' && ch <= '8') { file += Number(ch); continue }
      const type = PIECES.indexOf(ch.toLowerCase())
      if (type < 0) throw new Error(`Invalid FEN: ${fen}`)
      const white = ch === ch.toUpperCase()
      set(type + (white !== black ? 0 : 6), rank, file) // own pieces: planes 0-5 (after mirroring the side to move is White)
      file++
    }
  })
  boards.fill(1, 12 * 64, 13 * 64)
  const own = black ? 'kq' : 'KQ'
  const opp = black ? 'KQ' : 'kq'
  ;[own[0]!, own[1]!, opp[0]!, opp[1]!].forEach((right, i) => { if (castling.includes(right)) boards.fill(1, (13 + i) * 64, (14 + i) * 64) })
  if (ep !== '-') set(17, Number(ep[1]) - 1, ep.charCodeAt(0) - 97)
  const category = eloCategory(level)
  return { boards, eloSelf: category, eloOppo: category }
}
