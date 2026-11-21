import type { Opening, Variation } from '../../src/content/types.ts'
import { shortenSpokenText } from '../../src/content/intro.ts'
import { audioTexts } from '../../content-src/audio/index.ts'
import { withIntros } from './intros.ts'
import type { IntroSources } from './intros.ts'

const SPOKEN = new Map(audioTexts.filter((a) => a.kind === 'variante').map((a) => [a.refId, a.text]))

export interface IntroReport {
  /** variations that need an authored text: no usable spoken text */
  todo: string[]
  /** of those, the ones whose authored text is accepted */
  done: string[]
  /** one entry per authored text, in file order: accepted or the reason it is not used */
  checks: { id: string; ok: boolean; why: string }[]
}

/** What `add-intros --todo/--check` print; writes nothing. */
export function introReport(opening: Pick<Opening, 'id' | 'side' | 'entry'>, variations: Variation[], src: IntroSources = {}): IntroReport {
  const spoken = src.spoken ?? SPOKEN
  const authored = src.authored ?? {}
  const rejected: string[] = []
  withIntros(opening, variations, { ...src, spoken, rejected })
  const why = new Map(rejected.map((r) => [r.slice(0, r.indexOf(': ')), r.slice(r.indexOf(': ') + 2)]))
  const checks = Object.keys(authored).map((id) => ({ id, ok: !why.has(id), why: why.get(id) ?? '' }))
  const todo = variations.filter((v) => !(spoken.has(v.id) && shortenSpokenText(spoken.get(v.id)!, v.line))).map((v) => v.id)
  return { todo, done: todo.filter((id) => checks.some((c) => c.id === id && c.ok)), checks }
}
