import { publicUrl } from '../ui/assetBase.ts'
import { loadAudioManifest } from './manifest.ts'
import { quipAudioFile } from './quip-audio.ts'
import type { FigurId } from '../teacher/avatar.ts'

let current: HTMLAudioElement | null = null

/** Plays the spoken quip if the manifest has it; no entry, no file or a blocked player stay silent. */
export async function playQuip(figur: FigurId, text: string): Promise<void> {
  const file = quipAudioFile(await loadAudioManifest(), figur, text)
  if (!file) return
  current?.pause()
  current = new Audio(publicUrl(`audio/${file}`))
  await current.play().catch(() => undefined)
}

export function stopQuip(): void {
  current?.pause()
  current = null
}
