import { ref } from 'vue'
import type { Category } from '../analysis/category.ts'

const NOTABLE: readonly Category[] = ['brilliant', 'great', 'miss', 'blunder', 'mistake', 'inaccuracy']

/** The categories worth a glance in the short overview (the full table has all): those that occur at all. */
export function briefSigns(counts: Record<Category, number>): { cat: Category; n: number }[] {
  return NOTABLE.filter((c) => counts[c] > 0).map((c) => ({ cat: c, n: counts[c] }))
}

/** Result shown once: the score alone, or the viewpoint word with the score in brackets. */
export const resultText = (score: string, forViewer: string): string => (forViewer === score ? score : `${forViewer} (${score})`)

/** Stored open/closed states of the collapsible blocks; untrusted data, only booleans stay. */
export function parseOpen(raw: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) for (const [k, v] of Object.entries(raw)) if (typeof v === 'boolean') out[k] = v
  return out
}

const KEY = 'schachtrainer.open'
const storage = (): Storage | undefined => { try { return typeof localStorage === 'undefined' ? undefined : localStorage } catch { return undefined } }
function load(): Record<string, boolean> {
  try { const raw = storage()?.getItem(KEY); return parseOpen(raw ? JSON.parse(raw) : null) } catch { return {} }
}
export const openStates = ref<Record<string, boolean>>(load())
export function setOpen(id: string, open: boolean): void {
  openStates.value = { ...openStates.value, [id]: open }
  try { storage()?.setItem(KEY, JSON.stringify(openStates.value)) } catch { /* stays for this session */ }
}
