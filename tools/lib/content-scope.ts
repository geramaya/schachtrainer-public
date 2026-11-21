import type { Deviation, Explanation, Question } from '../../src/content/types.ts'

interface Content { explanations: Explanation[]; questions: Question[]; deviations: Deviation[] }

/** Content ids start with `<openingId>/`; a build of selected openings must not see the others' content. */
export function scopeContent(openingIds: string[], c: Content): Content {
  const inScope = (id: string) => openingIds.some((o) => id.startsWith(`${o}/`))
  return {
    explanations: c.explanations.filter((e) => inScope(e.id)),
    questions: c.questions.filter((q) => inScope(q.id)),
    deviations: c.deviations.filter((d) => inScope(d.explanationId)),
  }
}
