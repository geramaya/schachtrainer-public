const DAY = 86_400_000
const KEEP_DAYS = 120

const pad = (n: number) => String(n).padStart(2, '0')
/** Local calendar day as "YYYY-MM-DD". */
export const dayKey = (ms: number): string => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Calendar-day arithmetic via noon, so daylight-saving shifts never skip or repeat a day. */
const shiftDay = (ms: number, days: number): number => {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, 12).getTime()
}

/** Adds n answered cards to the day of `now`; keeps only the newest 120 days. */
export function recordTraining(days: Record<string, number>, now: number, n: number): Record<string, number> {
  const k = dayKey(now)
  const out = { ...days, [k]: (days[k] ?? 0) + n }
  const keys = Object.keys(out).sort()
  for (const old of keys.slice(0, Math.max(0, keys.length - KEEP_DAYS))) delete out[old]
  return out
}

/** Consecutive trained days ending today; today may still be open, so a streak ending yesterday stays alive. */
export function streakDays(days: Record<string, number>, now: number): number {
  let t = days[dayKey(now)] ? now : shiftDay(now, -1)
  let n = 0
  while (days[dayKey(t)]) { n++; t = shiftDay(t, -1) }
  return n
}

/** Whole calendar days since the last trained day; null if never. */
export function daysSinceLast(days: Record<string, number>, now: number): number | null {
  const last = Object.keys(days).sort().pop()
  if (!last) return null
  const [y, m, d] = last.split('-').map(Number)
  const lastNoon = new Date(y!, m! - 1, d!, 12).getTime()
  return Math.max(0, Math.round((shiftDay(now, 0) - lastNoon) / DAY))
}

/** The last n days (oldest first) with their card counts, for the streak bars. */
export function recentDays(days: Record<string, number>, now: number, n: number): { day: string; count: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const day = dayKey(shiftDay(now, i - n + 1))
    return { day, count: days[day] ?? 0 }
  })
}

/** "heute später" / "morgen" / "in n Tagen" for the earliest future due time; null if there is none. */
export function nextDueLabel(due: number | undefined, now: number): string | null {
  if (due === undefined) return null
  const diff = Math.round((shiftDay(due, 0) - shiftDay(now, 0)) / DAY)
  return diff <= 0 ? 'heute später' : diff === 1 ? 'morgen' : `in ${diff} Tagen`
}
