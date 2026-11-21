/**
 * Accuracy in percent, after the method Lichess describes publicly (https://lichess.org/page/accuracy); own implementation.
 * - Win chance from centipawns: 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)
 * - Accuracy of one move from the drop of the win chance (percentage points, view of the mover):
 *   103.1668 * exp(-0.04354 * drop) - 3.1669, clamped to 0..100 (a gain counts as no drop)
 * - Accuracy of a game: the mean of the volatility-weighted arithmetic mean and the harmonic mean of the move accuracies.
 * Follows lila AccuracyPercent.scala and scalachess WinPercent (read 2026-11): constants as in the source (103.1668100711649, -0.04354415386753951,
 * -3.166924740191411), the +1 "uncertainty bonus", accuracy 100 when the win chance does not drop, centipawns limited to +-1000 before the win chance,
 * volatility window (positions - 1) / 10 limited to 2..8, weights = standard deviation of the window limited to 0.5..12.
 * Own approximations: the windows are laid out from each move (lila slides them over the whole game); the harmonic mean uses max(accuracy, 1).
 */
const CP_LIMIT = 1000
export const winPercent = (cp: number): number => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * Math.max(-CP_LIMIT, Math.min(CP_LIMIT, cp)))) - 1)

export const moveAccuracy = (winBefore: number, winAfter: number): number =>
  winAfter >= winBefore ? 100 : Math.max(0, Math.min(100, 103.1668100711649 * Math.exp(-0.04354415386753951 * (winBefore - winAfter)) - 3.166924740191411 + 1))
const WEIGHT_MIN = 0.5
const WEIGHT_MAX = 12

/** One weight per move from the win chances (white view) of all positions: the standard deviation of the window starting at the move, limited to 0.5..12. */
export function volatilityWeights(winsWhite: number[]): number[] {
  const moves = Math.max(0, winsWhite.length - 1)
  const window = Math.max(2, Math.min(8, Math.floor((winsWhite.length - 1) / 10)))
  return Array.from({ length: moves }, (_, i) => {
    const w = winsWhite.slice(i, Math.min(winsWhite.length, i + window + 1))
    const mean = w.reduce((a, b) => a + b, 0) / w.length
    const sd = Math.sqrt(w.reduce((a, b) => a + (b - mean) ** 2, 0) / w.length)
    return Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, sd))
  })
}

export function gameAccuracy(moves: { acc: number; weight: number }[]): number | null {
  if (!moves.length) return null
  const totalWeight = moves.reduce((a, m) => a + m.weight, 0)
  const weighted = moves.reduce((a, m) => a + m.acc * m.weight, 0) / totalWeight
  const harmonic = moves.length / moves.reduce((a, m) => a + 1 / Math.max(m.acc, 1), 0)
  return (weighted + harmonic) / 2
}
