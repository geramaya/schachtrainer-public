import { ref } from 'vue'
import { loadSettings, saveSettings } from '../coach/cevalSettings.ts'
import type { EngineSettings, StorageLike } from '../coach/cevalSettings.ts'

function storage(): StorageLike | undefined {
  try { return typeof localStorage === 'undefined' ? undefined : localStorage } catch { return undefined } // access itself can throw (blocked storage)
}

/** One setting set for every engine field of the app (persistent). */
export const engineSettings = ref<EngineSettings>(loadSettings(storage()))

export function setEngineSettings(patch: Partial<EngineSettings>): void {
  engineSettings.value = { ...engineSettings.value, ...patch }
  saveSettings(engineSettings.value, storage())
}
