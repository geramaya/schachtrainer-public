/**
 * Move vocabulary of Maia-2 (1880 moves): the order is the output order of the model.
 * Port of `get_all_possible_moves` in CSSLab/maia2 `maia2/utils.py` (MIT, commit 67bee6ce): for every square a queen and then a knight
 * alone on an empty board, python-chess yields the target squares from the highest to the lowest square index; then the white
 * promotions. Black moves are mirrored (rank = 9 - rank) before they are looked up, so only white promotions exist.
 * Test: sha256 of the move list equals the one of `all_moves.json` (CSSLab/maia-platform-frontend c2afeeaa, file sha256 8a14d9f5…77c919f).
 */
const FILES = 'abcdefgh'
const name = (sq: number): string => FILES[sq % 8]! + (Math.floor(sq / 8) + 1)

const KNIGHT_STEPS: Array<[number, number]> = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]
const QUEEN_DIRS: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]

/** Target square indices (a1 = 0, rank * 8 + file) of a piece on `from`, highest first. */
function targets(from: number, kind: 'queen' | 'knight'): number[] {
  const f = from % 8
  const r = Math.floor(from / 8)
  const out: number[] = []
  const on = (x: number, y: number) => x >= 0 && x < 8 && y >= 0 && y < 8
  if (kind === 'knight') {
    for (const [dx, dy] of KNIGHT_STEPS) if (on(f + dx, r + dy)) out.push((r + dy) * 8 + f + dx)
  } else {
    for (const [dx, dy] of QUEEN_DIRS) for (let k = 1; on(f + dx * k, r + dy * k); k++) out.push((r + dy * k) * 8 + f + dx * k)
  }
  return out.sort((a, b) => b - a)
}

function build(): string[] {
  const moves: string[] = []
  for (let sq = 0; sq < 64; sq++) {
    for (const kind of ['queen', 'knight'] as const) for (const to of targets(sq, kind)) moves.push(name(sq) + name(to))
  }
  for (const file of FILES) {
    for (const piece of 'qrbn') moves.push(`${file}7${file}8${piece}`)
    if (file !== 'a') for (const piece of 'qrbn') moves.push(`${file}7${FILES[FILES.indexOf(file) - 1]}8${piece}`)
    if (file !== 'h') for (const piece of 'qrbn') moves.push(`${file}7${FILES[FILES.indexOf(file) + 1]}8${piece}`)
  }
  return moves
}

export const ALL_MOVES: string[] = build()
export const MOVE_INDEX: ReadonlyMap<string, number> = new Map(ALL_MOVES.map((m, i) => [m, i]))

const mirrorSquare = (sq: string): string => sq[0]! + (9 - Number(sq[1]))
/** The move as seen from the other side of the board (`mirror_move` in maia2/utils.py). */
export const mirrorMove = (uci: string): string => mirrorSquare(uci.slice(0, 2)) + mirrorSquare(uci.slice(2, 4)) + uci.slice(4)
