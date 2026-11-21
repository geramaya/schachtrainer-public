import { computed, ref } from 'vue'
import { clampWidth, parseStored, resolveWidths } from './splitWidths.ts'
import type { SplitSide, StoredWidths } from './splitWidths.ts'

const KEY = 'schachtrainer.layout.v1'

function load(): StoredWidths {
  try { return parseStored(localStorage.getItem(KEY)) } catch { return parseStored(null) }
}
function save(w: StoredWidths) {
  try { localStorage.setItem(KEY, JSON.stringify(w)) } catch { /* storage blocked or full: the widths just stay for this session */ }
}

/** Dragged widths of the side columns (null = default), one setting for all views. */
const stored = ref<StoredWidths>(load())
export const viewportWidth = ref(typeof window === 'undefined' ? 1440 : window.innerWidth)
export const viewportHeight = ref(typeof window === 'undefined' ? 900 : window.innerHeight)
export const widths = computed(() => resolveWidths(stored.value, viewportWidth.value, viewportHeight.value))

export function setWidth(side: SplitSide, px: number, persist: boolean) {
  const other = side === 'left' ? widths.value.right : widths.value.left
  stored.value = { ...stored.value, [side]: clampWidth(side, px, other, viewportWidth.value) }
  if (persist) save(stored.value)
}
export const persistWidths = () => save(stored.value)
export function resetWidth(side: SplitSide) {
  stored.value = { ...stored.value, [side]: null }
  save(stored.value)
}
