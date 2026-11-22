import { ref } from 'vue'
import { BASE } from '../ui/assetBase.ts'
import { assetUrl } from '../ui/asset-url.ts'
import { browserStorage } from '../store/state.ts'
import { emptyState, loadState, markFalle, markStep, saveState } from './store.ts'
import type { LehrgangState, Step } from './store.ts'
import { LEHRGANG_SCHEMA } from './types.ts'
import type { Lehrgang, LehrgangBundle } from './types.ts'

const storage = browserStorage()
export const lehrgangState = ref<LehrgangState>(storage ? loadState(storage) : emptyState())
const persist = (s: LehrgangState) => { lehrgangState.value = s; if (storage) saveState(storage, s) }
export const doneStep = (lehrgang: string, variante: string, step: Step) => persist(markStep(lehrgangState.value, lehrgang, variante, step))
export const doneFalle = (lehrgang: string, falle: string) => persist(markFalle(lehrgangState.value, lehrgang, falle))

export const lehrgaenge = ref<Lehrgang[] | null>(null)
export const lehrgangFehler = ref('')
let loading: Promise<void> | null = null
/** Loads public/content/lehrgaenge.json once (small, separate from the 3.7 MB bundle); a failure is shown on the page and can be retried. */
export function ensureLehrgaenge(): Promise<void> {
  loading ??= (async () => {
    try {
      const res = await fetch(assetUrl('content/lehrgaenge.json', BASE))
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const b = (await res.json()) as Partial<LehrgangBundle>
      if (b.schemaVersion !== LEHRGANG_SCHEMA || !Array.isArray(b.lehrgaenge)) throw new Error('unbekanntes Format (npm run lehrgang:build?)')
      lehrgaenge.value = b.lehrgaenge
      lehrgangFehler.value = ''
    } catch (e) {
      lehrgangFehler.value = `Die Lehrgänge konnten nicht geladen werden (${(e as Error).message}).`
      loading = null
    }
  })()
  return loading
}
