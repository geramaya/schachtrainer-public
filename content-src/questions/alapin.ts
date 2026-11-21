import type { Explanation, Question } from '../../src/content/types.ts'
import { buildQuestionsFor } from '../builders.ts'
import type { QSpec } from '../builders.ts'
import { ROWS } from '../explanations/alapin.ts'
import { qspecsOf } from '../rows.ts'

export const QSPECS: QSpec[] = qspecsOf(ROWS)

export const buildQuestions = (explanations: Explanation[], specs: QSpec[] = QSPECS): Question[] =>
  buildQuestionsFor('alapin', explanations, specs)
