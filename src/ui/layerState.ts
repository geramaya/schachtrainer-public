import { ref } from 'vue'
import { LAYERS, parseLayerSettings } from './layerSettings.ts'
import type { LayerId, LayerLock, LayerSettings } from './layerSettings.ts'

const KEY = 'schachtrainer.layers.v1'
const storage = (): Storage | undefined => { try { return typeof localStorage === 'undefined' ? undefined : localStorage } catch { return undefined } }

/** Which board layers are switched on (persistent, one setting for every board of the app; all off by default). */
export const layerSettings = ref<LayerSettings>(parseLayerSettings(storage()?.getItem(KEY) ?? null))
/** An open exercise is on the board: the menu shows the locked layers as such (set by the board). */
export const layersLocked = ref<LayerLock>(false)

export function setLayer(id: LayerId, on: boolean): void {
  layerSettings.value = { ...layerSettings.value, [id]: on }
  try { storage()?.setItem(KEY, JSON.stringify(layerSettings.value)) } catch { /* blocked or full: the choice lasts for this session */ }
}

export const anyLayerOn = (): boolean => LAYERS.some((l) => layerSettings.value[l.id])
