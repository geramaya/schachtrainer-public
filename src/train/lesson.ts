import type { Explanation, Question } from '../content/types.ts'

/** Robustness rule: an explanation with claims that is still a draft is never shown. */
export const isShown = (e: Explanation): boolean => !(e.status === 'entwurf' && e.claims.length > 0)

const BADGE: Record<Explanation['status'], string> = { entwurf: 'Entwurf', 'engine-geprüft': 'Engine-geprüft', 'human-ok': 'Von dir bestätigt' }
export const badgeLabel = (s: Explanation['status']): string => BADGE[s]

/** Explanations attach to position keys, never to move sequences; with `openingId` only that opening's explanations count (ids start with `<openingId>/`). */
export const explanationAtKey = (list: Explanation[], key: string, openingId?: string): Explanation | undefined =>
  list.find((e) => e.key === key && isShown(e) && (openingId === undefined || e.id.startsWith(`${openingId}/`)))

/** wrongSoFar = wrong attempts before this one: first miss retries, second reveals the solution. */
export function judgeMove(q: Question, uci: string, wrongSoFar: number): 'correct' | 'retry' | 'reveal' {
  if (uci === q.answerUci) return 'correct'
  return wrongSoFar >= 1 ? 'reveal' : 'retry'
}
