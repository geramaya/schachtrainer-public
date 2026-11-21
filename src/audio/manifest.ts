import { publicUrl } from '../ui/assetBase.ts'
export interface AudioEntry {
  file: string
  title: string
  text: string
  sources: { kind: string; ref: string }[]
  durationSec: number
}

let cached: Promise<Record<string, AudioEntry>> | null = null

/** Loads /audio/manifest.json once; a missing or broken file means "no audio" (empty record). */
export function loadAudioManifest(): Promise<Record<string, AudioEntry>> {
  cached ??= fetch(publicUrl('audio/manifest.json'))
    .then((r) => (r.ok ? (r.json() as Promise<Record<string, AudioEntry>>) : {}))
    .catch(() => ({}))
  return cached
}
