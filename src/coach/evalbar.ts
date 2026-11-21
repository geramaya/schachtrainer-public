import { isMateCp } from './texts.ts'

const CAP = 800

/** Share of the bar (0-100) that belongs to White for an evaluation from the side of White. */
export const whiteShare = (cp: number): number => 50 + 50 * Math.max(-1, Math.min(1, cp / CAP))

/** `whiteMate`: moves to mate from White's side (+n White mates, -n Black mates); a mate score without it (finished game) shows as "#". */
export function evalLabel(cp: number | null, whiteMate: number | null = null): string {
  if (cp === null) return '–'
  if (whiteMate !== null) return `#${whiteMate}`
  if (isMateCp(cp)) return cp > 0 ? '#' : '#-'
  const v = (Math.abs(cp) / 100).toFixed(1).replace('.', ',')
  return cp > 0 ? `+${v}` : cp < 0 ? `-${v}` : v
}
