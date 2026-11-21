import { winPercent } from './accuracy.ts'
import type { Ev } from './nag.ts'

/** Vertical position in a box of `height`: the win chance of white (see accuracy.ts) maps to the height, so big advantages flatten out and a mate sits exactly on the edge. */
export function graphY(e: Ev, height: number): number {
  const win = e.mate !== null ? (e.mate > 0 ? 100 : 0) : winPercent(e.cp)
  return height * (1 - win / 100)
}

/** One point per known position, spread over the width; `ply` = the number of moves played before that position. */
export function graphPoints(positions: (Ev | null)[], width: number, height: number): { x: number; y: number; ply: number }[] {
  const last = Math.max(1, positions.length - 1)
  const out: { x: number; y: number; ply: number }[] = []
  positions.forEach((p, ply) => { if (p) out.push({ x: (ply / last) * width, y: graphY(p, height), ply }) })
  return out
}

/** The position nearest to a horizontal coordinate. */
export function plyAtX(x: number, width: number, plies: number): number {
  if (plies <= 0 || width <= 0) return 0
  return Math.max(0, Math.min(plies, Math.round((x / width) * plies)))
}
