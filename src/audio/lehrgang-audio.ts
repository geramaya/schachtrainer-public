import { hash } from '../teacher/blocks.ts'
import { isTodo } from '../lehrgang/types.ts'
import type { Lehrgang } from '../lehrgang/types.ts'
import type { AudioEntry } from './manifest.ts'

const PIECE: Record<string, string> = { S: 'Springer', L: 'Läufer', T: 'Turm', D: 'Dame', K: 'König' }
const DIGIT = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun']

/** What the voice says: German SAN as piece and square ("Sf3" -> "Springer f3"), evaluations digit by digit ("+0,35" -> "plus null Komma drei fünf"), move numbers dropped. */
export function speakLehrgang(text: string): string {
  return text
    .replace(/\b\d+(?:\.\.\.|…|\.)\s?(?=[SLTDK]?[a-h]\d|O-O)/g, '')
    .replace(/(^|[\s(])([+−-])(\d+),(\d+)/g, (_m, pre: string, sign: string, a: string, b: string) =>
      `${pre}${sign === '+' ? 'plus' : 'minus'} ${[...a].map((d) => DIGIT[+d]).join(' ')} Komma ${[...b].map((d) => DIGIT[+d]).join(' ')}`)
    .replace(/\b([a-h])x([a-h][1-8])\b/g, '$1 schlägt $2')
    .replace(/\b([SLTDK])([a-h]?)(x?)([a-h][1-8])([+#]?)[?!]{0,2}/g, (_m, p: string, from: string, x: string, sq: string, chk: string) =>
      `${PIECE[p]}${from ? ` ${from}` : ''}${x ? ' schlägt' : ''} ${sq}${chk === '+' ? ' Schach' : chk === '#' ? ' Matt' : ''}`)
    .replace(/\b([a-h][1-8])–([a-h][1-8])\b/g, '$1 bis $2')
}

/** One text per distinct sentence, stable id from the shown text: a sentence used in several lines is voiced once. */
export const lehrgangAudioId = (text: string): string => `lehrgang-${hash(text).toString(36)}`

export interface LehrgangAudioText { id: string; kind: 'lehrgang'; refId: string; title: string; text: string; speakText: string; sources: [] }

/** Sentences of all moves and all plan sections of the courses for the audio pipeline (texts still marked TODO are skipped). */
export function lehrgangAudioTexts(lehrgaenge: Lehrgang[]): LehrgangAudioText[] {
  const out = new Map<string, LehrgangAudioText>()
  const add = (refId: string, title: string, text: string) => {
    if (isTodo(text)) return
    const id = lehrgangAudioId(text)
    if (!out.has(id)) out.set(id, { id, kind: 'lehrgang', refId, title, text, speakText: speakLehrgang(text), sources: [] })
  }
  for (const l of lehrgaenge) {
    for (const s of l.spielplan) add(l.id, `${l.name}: ${s.titel}`, s.text)
    for (const v of l.varianten) for (const z of v.zuege) add(l.id, `${l.name}: ${v.name}`, z.satz)
  }
  return [...out.values()]
}

/** File of the spoken text, or null (no entry = no button). */
export const lehrgangAudioFile = (manifest: Record<string, AudioEntry>, text: string): string | null => manifest[lehrgangAudioId(text)]?.file ?? null
