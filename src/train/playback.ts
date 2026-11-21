/** One autoplay tick: advance a ply; stop on a key position or at the end of the line. */
export function playStep(ply: number, keyPlies: number[], last: number): { ply: number; playing: boolean } {
  const next = Math.min(last, ply + 1)
  return { ply: next, playing: next < last && !keyPlies.includes(next) }
}
