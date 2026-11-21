import type { CoachShape } from './explain.ts'

export interface BoardShape { orig: string; dest?: string; brush: string; label?: { text: string } }

const text = (c: CoachShape) => (c.kind === 'weak' ? `◆${c.label}` : c.label)

/** Coach shapes for the board: identical arrows collapse into one ("1·2"); shapes ending on the same square share one label so labels never overlap. */
export function boardShapes(list: CoachShape[]): BoardShape[] {
  const merged: { first: CoachShape; texts: string[] }[] = []
  for (const c of list) {
    const same = merged.find((m) => m.first.orig === c.orig && m.first.dest === c.dest)
    if (same) same.texts.push(text(c))
    else merged.push({ first: c, texts: [text(c)] })
  }
  const target = (c: CoachShape) => c.dest ?? c.orig
  return merged.map((m) => {
    const group = merged.filter((o) => target(o.first) === target(m.first))
    const label = group[0] === m ? { label: { text: group.flatMap((g) => g.texts).join('·') } } : {}
    return { orig: m.first.orig, dest: m.first.dest, brush: m.first.dim ? `${m.first.kind}Dim` : m.first.kind, ...label }
  })
}
