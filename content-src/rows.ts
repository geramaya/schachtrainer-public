import type { Source } from '../src/content/types.ts'
import type { ExplSpec, QSpec } from './builders.ts'
import { words } from './lib.ts'

/** A question attached to an explanation row; `v` overrides the variation of the row (the key is the row's position). */
export interface QPart { prompt: string; answer?: string; choices?: [string, boolean][]; v?: string }
export interface Row { spec: ExplSpec; qs: QPart[] }

/** Move question: the answer must be one of the row's `best` claims (builders.ts enforces this). */
export const mv = (prompt: string, answer: string, v?: string): QPart => ({ prompt, answer, v })
/** Choice question: the first alternative is the correct one, the rest are wrong. */
export const ch = (prompt: string, right: string, wrong: string[], v?: string): QPart => ({
  prompt, v, choices: [[right, true], ...wrong.map((w): [string, boolean] => [w, false])],
})

interface Opts { best?: string[]; threat?: string; source?: Source; at?: number }

/** `at` defaults to the whole line, i.e. the explanation sits on the position after the last move of `line`. */
export function row(v: string, line: string, title: string, text: string, qs: QPart[], o: Opts = {}): Row {
  const { at, ...claims } = o
  return { spec: { v, line, at: at ?? words(line).length, title, text, ...claims }, qs }
}

export const specsOf = (rows: Row[]): ExplSpec[] => rows.map((r) => r.spec)

export const qspecsOf = (rows: Row[]): QSpec[] =>
  rows.flatMap((r) => r.qs.map((q): QSpec => ({ v: q.v ?? r.spec.v, line: r.spec.line, at: r.spec.at, prompt: q.prompt, answer: q.answer, choices: q.choices })))
