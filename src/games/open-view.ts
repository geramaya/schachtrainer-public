/** Plies shown when a game is opened: the start position, unless a move was asked for on purpose (clamped into the game). */
export function initialView(total: number, requested?: number | null): number {
  if (requested === undefined || requested === null) return 0
  return Math.max(0, Math.min(total, requested))
}
