import { Chess } from 'chess.js'
import type { Color, Square } from 'chess.js'
import { VALUE } from '../coach/texts.ts'
import type { PieceType } from '../coach/texts.ts'

/**
 * Facts for the optional board layers (hanging pieces, attackers/defenders, square control, reach of a piece).
 * Pure chess.js, no engine.
 *
 * Definitions (and their limits, on purpose simple):
 * - "attacks" is geometric (chess.js `attackers`): a piece attacks the squares it could capture on, own pieces included
 *   (then it defends them). A king attacks the squares next to it even if the enemy defends them.
 * - A piece that is pinned to its own king (absolute pin) only counts on squares of its pin line. Pins are judged on the
 *   position as shown, not after a hypothetical capture. A king in check is not special: attacks still count.
 * - X-ray attackers (a rook behind a rook, a queen behind a bishop on the same line) are NOT counted.
 * - En passant: the pawn that just moved two squares is attacked by every pawn that may take it en passant.
 * - A piece "hangs" when it is attacked and either has no defender or is attacked by a cheaper piece
 *   (values pawn 1, minor 3, rook 5, queen 9, king 100). Kings never hang. Longer exchanges are not calculated.
 */

export interface PieceStat { square: string; type: PieceType; color: Color; attackers: string[]; defenders: string[]; hanging: boolean }

const FILES = 'abcdefgh'
const ALL_SQUARES: Square[] = [...Array(8).keys()].flatMap((r) => [...FILES].map((f) => `${f}${r + 1}` as Square))
const enemy = (c: Color): Color => (c === 'w' ? 'b' : 'w')
const step = (a: number, b: number) => Math.sign(b - a)

/** For each piece of `color` that is pinned to its king: the squares it may still move or capture on (the pin line incl. the pinner). */
function pins(fen: string, color: Color): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  const base = new Chess(fen)
  const king = base.board().flat().find((p) => p?.type === 'k' && p.color === color)
  if (!king) return out
  const before = new Set(base.attackers(king.square, enemy(color)))
  for (const p of base.board().flat()) {
    if (!p || p.color !== color || p.type === 'k') continue
    const probe = new Chess(fen)
    probe.remove(p.square)
    const pinner = probe.attackers(king.square, enemy(color)).find((s) => !before.has(s))
    if (!pinner) continue
    const dx = step(king.square.charCodeAt(0), pinner.charCodeAt(0))
    const dy = step(Number(king.square[1]), Number(pinner[1]))
    const line = new Set<string>()
    for (let f = king.square.charCodeAt(0) + dx, r = Number(king.square[1]) + dy; ; f += dx, r += dy) {
      const sq = `${String.fromCharCode(f)}${r}`
      line.add(sq)
      if (sq === pinner) break
    }
    out.set(p.square, line)
  }
  return out
}

interface Context { chess: Chess; pinned: Record<Color, Map<string, Set<string>>> }

function context(fen: string): Context {
  return { chess: new Chess(fen), pinned: { w: pins(fen, 'w'), b: pins(fen, 'b') } }
}

/** Pieces of `by` that attack `square`, without those that are pinned away from it. */
function attackersOf(ctx: Context, square: Square, by: Color): string[] {
  return ctx.chess.attackers(square, by).filter((from) => {
    const line = ctx.pinned[by].get(from)
    return !line || line.has(square)
  })
}

/** Attackers of the pawn that just moved two squares: pawns of the side to move that may capture it en passant. */
function enPassantAttackers(fen: string, pawn: Square): string[] {
  const target = fen.split(' ')[3]
  if (!target || target === '-' || target[0] !== pawn[0]) return []
  return new Chess(fen).moves({ verbose: true }).filter((m) => m.flags.includes('e') && `${m.to[0]}${m.from[1]}` === pawn).map((m) => m.from)
}

export function pieceStats(fen: string): PieceStat[] {
  const ctx = context(fen)
  const out: PieceStat[] = []
  for (const p of ctx.chess.board().flat()) {
    if (!p) continue
    const attackers = [...attackersOf(ctx, p.square, enemy(p.color)), ...(p.type === 'p' ? enPassantAttackers(fen, p.square) : [])]
    const defenders = attackersOf(ctx, p.square, p.color)
    const cheapest = Math.min(...attackers.map((s) => VALUE[ctx.chess.get(s as Square)!.type as PieceType]), Infinity)
    const hanging = p.type !== 'k' && attackers.length > 0 && (defenders.length === 0 || cheapest < VALUE[p.type as PieceType])
    out.push({ square: p.square, type: p.type as PieceType, color: p.color, attackers, defenders, hanging })
  }
  return out
}

/** Number of attackers of each side on each of the 64 squares (empty or occupied). */
export function controlMap(fen: string): Record<string, { white: number; black: number }> {
  const ctx = context(fen)
  return Object.fromEntries(ALL_SQUARES.map((sq) => [sq, { white: attackersOf(ctx, sq, 'w').length, black: attackersOf(ctx, sq, 'b').length }]))
}

/** Squares the piece on `from` attacks (own pieces on them are defended); empty if the square is empty. */
export function reachSquares(fen: string, from: string): string[] {
  const ctx = context(fen)
  const piece = ctx.chess.get(from as Square)
  if (!piece) return []
  return ALL_SQUARES.filter((sq) => sq !== from && attackersOf(ctx, sq, piece.color).includes(from))
}
