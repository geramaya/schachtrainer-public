import { ref } from 'vue'
import { loadSettings, saveSettings } from '../coach/cevalSettings.ts'
import type { EngineSettings, StorageLike } from '../coach/cevalSettings.ts'
import { loadLehrgangSettings, saveLehrgangSettings } from '../lehrgang/engine.ts'

function storage(): StorageLike | undefined {
  try { return typeof localStorage === 'undefined' ? undefined : localStorage } catch { return undefined } // access itself can throw (blocked storage)
}

/** One setting set for every engine field of the app (persistent). */
export const engineSettings = ref<EngineSettings>(loadSettings(storage()))

export function setEngineSettings(patch: Partial<EngineSettings>): void {
  engineSettings.value = { ...engineSettings.value, ...patch }
  saveSettings(engineSettings.value, storage())
}

/** The engine field of the Lehrgang prototype: own persistent setting set, off by default. */
export const lehrgangEngineSettings = ref<EngineSettings>(loadLehrgangSettings(storage()))

export function setLehrgangEngineSettings(patch: Partial<EngineSettings>): void {
  lehrgangEngineSettings.value = { ...lehrgangEngineSettings.value, ...patch }
  saveLehrgangSettings(lehrgangEngineSettings.value, storage())
}
