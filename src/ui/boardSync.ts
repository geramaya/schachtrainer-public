/**
 * Config for re-syncing a running board: chessground clears the own arrows and circles whenever it is given a `fen`
 * (even the same one), so an unchanged position is synced without it. Only a real change of position passes the fen on.
 */
export function syncConfig<T extends { fen?: string }>(cfg: T, lastFen: string | null): Omit<T, 'fen'> & { fen?: string } {
  if (cfg.fen !== lastFen) return cfg
  const { fen: _same, ...rest } = cfg
  return rest
}
