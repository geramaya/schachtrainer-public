import { publicUrl } from '../ui/assetBase.ts'
import { loadAudioManifest } from './manifest.ts'
import { quipAudioFile } from './quip-audio.ts'
import type { FigurId } from '../teacher/avatar.ts'

interface AudioLike { src: string; play(): Promise<void>; pause(): void }
/** Shortest silent WAV: played at the first user gesture so the browser allows the element to play later without a gesture. */
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='

/** One audio element for all quips: unlocked by the first user gesture, then reused (a new element per quip is blocked by autoplay rules after the evaluation delay). */
export function createQuipPlayer(make: () => AudioLike, warn: (message: string) => void) {
  let el: AudioLike | null = null
  const element = () => (el ??= make())
  return {
    async unlock(): Promise<void> {
      const a = element()
      a.src = SILENCE
      await a.play().catch((e: unknown) => { if ((e as Error)?.name !== 'AbortError') warn(`Spruch-Audio konnte nicht freigeschaltet werden: ${String(e)}`) }) // AbortError: a real quip took the element over, nothing is wrong
    },
    async play(src: string): Promise<void> {
      const a = element()
      a.pause()
      a.src = src
      await a.play().catch((e: unknown) => warn(`Spruch ${src} konnte nicht abgespielt werden: ${String(e)}`))
    },
    stop(): void { el?.pause() },
  }
}

const player = createQuipPlayer(() => new Audio(), (m) => console.warn(m))

/** Call once at start: the first click or key press unlocks the quip player. */
export function installQuipUnlock(target: Pick<Document, 'addEventListener' | 'removeEventListener'> = document): void {
  const once = () => { target.removeEventListener('pointerdown', once); target.removeEventListener('keydown', once); void player.unlock() }
  target.addEventListener('pointerdown', once)
  target.addEventListener('keydown', once)
}

/** Plays the spoken quip if the manifest has it; no entry or no file stays silent, a refused play is logged. */
export async function playQuip(figur: FigurId, text: string): Promise<void> {
  const file = quipAudioFile(await loadAudioManifest(), figur, text)
  if (file) await player.play(publicUrl(`audio/${file}`))
}

/** Plays a file of public/audio on the same unlocked element (no overlap with quips or other sentences). */
export async function playAudioFile(file: string): Promise<void> { await player.play(publicUrl(`audio/${file}`)) }

export function stopQuip(): void { player.stop() }
