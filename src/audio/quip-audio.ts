import { hash } from '../teacher/blocks.ts'
import { FIGUREN } from '../teacher/avatar.ts'
import type { FigurId } from '../teacher/avatar.ts'
import type { QuipBook } from '../teacher/quips.ts'
import type { AudioEntry } from './manifest.ts'

const PREFIX = 'quip-'
export const quipAudioId = (figur: FigurId, text: string): string => `${PREFIX}${figur}-${hash(text).toString(36)}`

/** Voice per teacher; null = not chosen yet, that teacher gets no audio. */
export type QuipVoices = Record<FigurId, string | null>

/** `speakText` = text with the teacher's expression tag; only the pipeline sees it, the app shows `text`. */
export type QuipTags = Record<FigurId, string>
export interface QuipAudioText { id: string; kind: 'spruch'; refId: FigurId; title: string; text: string; speakText: string; sources: []; voice: string }

/** Texts for the audio pipeline: only quips without placeholders (the filled text is unknown in advance) of teachers that have a voice. */
export function quipAudioTexts(book: QuipBook, voices: QuipVoices, tags: QuipTags): QuipAudioText[] {
  const out = new Map<string, QuipAudioText>()
  for (const { id: figur } of FIGUREN) {
    const voice = voices[figur]
    if (!voice) continue
    for (const list of Object.values(book[figur] ?? {})) {
      for (const text of list ?? []) {
        if (text.includes('{')) continue
        const id = quipAudioId(figur, text)
        out.set(id, { id, kind: 'spruch', refId: figur, title: `Spruch ${figur}`, text, speakText: tags[figur] ? `${tags[figur]} ${text}` : text, sources: [], voice })
      }
    }
  }
  return [...out.values()]
}

/** File of the spoken quip, or null (no entry = silent). */
export const quipAudioFile = (manifest: Record<string, AudioEntry>, figur: FigurId, text: string): string | null => manifest[quipAudioId(figur, text)]?.file ?? null

export const hasQuipAudio = (manifest: Record<string, AudioEntry>): boolean => Object.keys(manifest).some((k) => k.startsWith(PREFIX))
