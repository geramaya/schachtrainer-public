import type { Arrow, Claim, Deviation, Explanation, Question, Source } from '../src/content/types.ts'
import { keyAfter, uciOf, uciOfOther, words } from './lib.ts'

/**
 * One explanation per key position of a variation line. `at` = number of plies played from the start.
 * Everything concrete about moves is a claim (best / threat / blunder) and is checked by Stockfish in the build;
 * the prose only describes plans, ideas and countable facts. Status stays `entwurf`; the build sets `engine-geprüft`.
 */
export interface ExplSpec {
  v: string
  line: string
  at: number
  title: string
  text: string
  best?: string[]
  threat?: string
  blunder?: string
  source?: Source
}

/**
 * `move`: the answer must be one of the explanation's `best` claims at that position (so Stockfish stands behind it).
 * `choice`: ideas and plans only; correct answers about concrete moves hang on a claim of the explanation as well.
 */
export interface QSpec {
  v: string
  line: string
  at: number
  prompt: string
  answer?: string
  choices?: [string, boolean][]
}

/** An opponent deviation: `line` up to `at` plies ends with the deviating move `reply`; `answer` is the repertoire reply. */
export type DeviationSpec = ExplSpec & { reply: string; answer: string }

export const AUTOR: Source = { kind: 'autor', ref: 'Eröffnungsgrundlagen, allgemein-strategisch formuliert' }

const ARROW_FOR: Record<Claim['kind'], Arrow['brush']> = { best: 'green', blunder: 'red', threat: 'blue' }

export function buildExplanationsFor(opening: string, specs: ExplSpec[]): Explanation[] {
  const counter: Record<string, number> = {}
  return specs.map((s) => {
    const sans = words(s.line).slice(0, s.at)
    const claims: Claim[] = [
      ...(s.best ?? []).map((m): Claim => ({ kind: 'best', uci: uciOf(sans, m) })),
      ...(s.threat ? [{ kind: 'threat', uci: uciOfOther(sans, s.threat) } as Claim] : []),
      ...(s.blunder ? [{ kind: 'blunder', uci: uciOf(sans, s.blunder) } as Claim] : []),
    ]
    const n = (counter[s.v] = (counter[s.v] ?? 0) + 1)
    return {
      id: `${opening}/${s.v}/${n}`,
      key: keyAfter(sans),
      title: s.title,
      text: s.text,
      arrows: claims.map((c) => ({ orig: c.uci.slice(0, 2), dest: c.uci.slice(2, 4), brush: ARROW_FOR[c.kind] })),
      claims,
      status: 'entwurf',
      source: s.source ?? AUTOR,
    }
  })
}

export function buildQuestionsFor(opening: string, explanations: Explanation[], specs: QSpec[]): Question[] {
  const counter: Record<string, number> = {}
  return specs.map((q) => {
    const sans = words(q.line).slice(0, q.at)
    const key = keyAfter(sans)
    const expl = explanations.find((e) => e.key === key && e.id.startsWith(`${opening}/`))
    if (!expl) throw new Error(`Frage "${q.prompt}": keine Erklärung an Position nach ${sans.join(' ')}`)
    const n = (counter[q.v] = (counter[q.v] ?? 0) + 1)
    const base = { id: `${opening}/${q.v}/q${n}`, key, variationId: q.v, prompt: q.prompt, explanationId: expl.id }
    if (q.answer) {
      const uci = uciOf(sans, q.answer)
      if (!expl.claims.some((c) => c.kind === 'best' && c.uci === uci)) {
        throw new Error(`Frage "${q.prompt}": ${q.answer} ist keine best-Behauptung von ${expl.id}`)
      }
      return { ...base, kind: 'move' as const, answerUci: uci }
    }
    return { ...base, kind: 'choice' as const, choices: q.choices!.map(([text, correct]) => ({ text, correct })) }
  })
}

/** Deviation explanations continue the numbering of the variation `v` after its `offset` explanations. */
export function deviationExplanationsFor(opening: string, specs: DeviationSpec[], offset: number): Explanation[] {
  return buildExplanationsFor(opening, specs).map((e, i) => ({ ...e, id: `${opening}/${specs[i]!.v}/${offset + i + 1}` }))
}

export function buildDeviationsFor(explanations: Explanation[], specs: DeviationSpec[]): Deviation[] {
  return specs.map((d) => {
    const all = words(d.line)
    const key = keyAfter(all.slice(0, d.at))
    // the opening is the one whose explanation ids carry the variation id; the same position may be explained in several openings
    const opening = explanations.find((e) => e.id.split('/')[1] === d.v)?.id.split('/')[0]
    const expl = explanations.find((e) => e.key === key && (opening === undefined || e.id.startsWith(`${opening}/`)))
    if (!expl) throw new Error(`Abweichung ${d.reply}: keine Erklärung`)
    const before = all.slice(0, d.at - 1)
    return {
      key: keyAfter(before), variationId: d.v, replyUci: uciOf(before, d.reply),
      punishUci: uciOf(all.slice(0, d.at), d.answer), explanationId: expl.id,
    }
  })
}
