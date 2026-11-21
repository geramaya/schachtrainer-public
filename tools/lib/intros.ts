import type { Opening, Variation } from '../../src/content/types.ts'
import { audioTexts } from '../../content-src/audio/index.ts'
import { generateIntro, shortenSpokenText } from '../../src/content/intro.ts'
import { checkAuthoredIntro } from './intro-check.ts'
import type { IntroEntry } from './intro-check.ts'
import type { FactsFile } from './intro-facts.ts'

const SPOKEN = new Map(audioTexts.filter((a) => a.kind === 'variante').map((a) => [a.refId, a.text]))

export interface IntroSources {
  spoken?: Map<string, string>
  /** content-src/intros/<openingId>.ts */
  authored?: Record<string, IntroEntry>
  /** content-src/intro-facts/<openingId>.json; authored texts are only accepted with it */
  facts?: FactsFile | null
  /** receives one line per authored text that was not used, with the reason */
  rejected?: string[]
}

/**
 * Intro of every variation, in this order: the spoken "Idee" text (first sentences that name only moves of the line);
 * else the authored text of content-src/intros/ when `checkAuthoredIntro` accepts it against the fact sheet (no draft);
 * else a text generated from the line and the features of its last position (draft).
 */
export function withIntros(opening: Pick<Opening, 'id' | 'side' | 'entry'>, variations: Variation[], src: IntroSources = {}): Variation[] {
  const spoken = src.spoken ?? SPOKEN
  const authored = src.authored ?? {}
  const reject = (id: string, why: string) => src.rejected?.push(`${id}: ${why}`)
  for (const id of Object.keys(authored)) if (!variations.some((v) => v.id === id)) reject(id, `keine Variante der Eröffnung ${opening.id}`)

  return variations.map((v) => {
    const short = spoken.has(v.id) ? shortenSpokenText(spoken.get(v.id)!, v.line) : null
    if (short) {
      if (authored[v.id]) reject(v.id, 'Sprechtext aus dem Dokument hat Vorrang, geschriebener Text nicht verwendet')
      return { ...v, intro: { text: short, source: { kind: v.fromDocument ? 'dokument' : 'autor', ref: 'Sprechtext der Variante (content-src/audio), gekürzt' } as const, draft: false } }
    }
    const entry = authored[v.id]
    if (entry) {
      const sheet = src.facts?.varianten[v.id]
      const problems = sheet ? checkAuthoredIntro(entry, v.line, sheet, src.facts!.dokument) : ['kein Faktenblatt (node tools/intro-facts.ts)']
      if (problems.length === 0) {
        return { ...v, intro: { text: entry.text, source: { kind: 'autor', ref: `content-src/intros/${opening.id}.ts, belegt: ${entry.belege.join(', ') || 'ohne Plan-/Ideenaussage'}` } as const, draft: false } }
      }
      reject(v.id, problems.join('; '))
    }
    return { ...v, intro: { text: generateIntro(opening, v.line), source: { kind: 'autor', ref: 'Aus Zugfolge und Stellungsmerkmalen (src/content/intro.ts)' } as const, draft: true } }
  })
}
