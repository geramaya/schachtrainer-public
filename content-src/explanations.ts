import type { Explanation } from '../src/content/types.ts'
import * as smithMorraDev from './deviations/smith-morra.ts'
import { buildDeviations as scotchDev, deviationExplanations } from './deviations/scotch.ts'
import { EXPLANATIONS_SCOTCH } from './explanations/scotch.ts'
import * as caroKannDev from './deviations/caro-kann.ts'
import { EXPLANATIONS_CARO_KANN, CARO_KANN_IDS } from './explanations/caro-kann.ts'
import { EXPLANATIONS_BUDAPEST } from './explanations/budapest.ts'
import { EXPLANATIONS_KINGS_INDIAN } from './explanations/kings-indian.ts'
import { buildQuestions as caroKannQ } from './questions/caro-kann.ts'
import { buildQuestions as budapestQ } from './questions/budapest.ts'
import { buildQuestions as kingsIndianQ } from './questions/kings-indian.ts'
import { EXPLANATIONS_SMITH_MORRA, SMITH_MORRA_IDS } from './explanations/smith-morra.ts'
import { buildQuestions as scotchQ } from './questions/scotch.ts'
import { buildQuestions as smithMorraQ } from './questions/smith-morra.ts'
import * as nimzoDev from './deviations/nimzo-indian.ts'
import { EXPLANATIONS_NIMZO, NIMZO_IDS } from './explanations/nimzo-indian.ts'
import { buildQuestions as nimzoQ } from './questions/nimzo-indian.ts'
import * as tarraschDev from './deviations/tarrasch.ts'
import { EXPLANATIONS_TARRASCH, TARRASCH_IDS } from './explanations/tarrasch.ts'
import { buildQuestions as tarraschQ } from './questions/tarrasch.ts'
import { EXPLANATIONS_ITALIAN } from './explanations/italian.ts'
import { EXPLANATIONS_ALAPIN, ALAPIN_ID } from './explanations/alapin.ts'
import { EXPLANATIONS_VIENNA, VIENNA_ID } from './explanations/vienna.ts'
import * as alapinDev from './deviations/alapin.ts'
import * as viennaDev from './deviations/vienna.ts'
import { buildDeviations as italianDev } from './deviations/italian.ts'
import { buildQuestions as italianQ } from './questions/italian.ts'
import { buildQuestions as alapinQ } from './questions/alapin.ts'
import { buildQuestions as viennaQ } from './questions/vienna.ts'

const count = (list: Explanation[], prefix: string) => list.filter((e) => e.id.startsWith(prefix)).length

/**
 * All explanation drafts. Claims in here are checked against Stockfish by the build (verifyExplanations);
 * status and `verified` written here are ignored for explanations with claims. content-src never sets `human-ok`.
 */
export const EXPLANATIONS: Explanation[] = [
  ...EXPLANATIONS_SCOTCH,
  ...deviationExplanations(count(EXPLANATIONS_SCOTCH, 'scotch/scotch-game/')),
  ...EXPLANATIONS_SMITH_MORRA,
  ...smithMorraDev.deviationExplanations(count(EXPLANATIONS_SMITH_MORRA, `smith-morra/${SMITH_MORRA_IDS.G}/`)),
  ...EXPLANATIONS_CARO_KANN,
  ...caroKannDev.deviationExplanations(count(EXPLANATIONS_CARO_KANN, `caro-kann/${CARO_KANN_IDS.R}/`)),
  ...EXPLANATIONS_BUDAPEST,
  ...EXPLANATIONS_KINGS_INDIAN,
  ...EXPLANATIONS_NIMZO,
  ...nimzoDev.deviationExplanations(count(EXPLANATIONS_NIMZO, `nimzo-indian/${NIMZO_IDS.R}/`)),
  ...EXPLANATIONS_TARRASCH,
  ...tarraschDev.deviationExplanations(count(EXPLANATIONS_TARRASCH, `tarrasch/${TARRASCH_IDS.R}/`)),
  ...EXPLANATIONS_ITALIAN,
  ...EXPLANATIONS_ALAPIN,
  ...alapinDev.deviationExplanations(count(EXPLANATIONS_ALAPIN, `alapin/${ALAPIN_ID}/`)),
  ...EXPLANATIONS_VIENNA,
  ...viennaDev.deviationExplanations(count(EXPLANATIONS_VIENNA, `vienna/${VIENNA_ID}/`)),
]
export const QUESTIONS = [...scotchQ(EXPLANATIONS), ...smithMorraQ(EXPLANATIONS), ...caroKannQ(EXPLANATIONS), ...budapestQ(EXPLANATIONS), ...kingsIndianQ(EXPLANATIONS), ...nimzoQ(EXPLANATIONS), ...tarraschQ(EXPLANATIONS), ...italianQ(EXPLANATIONS), ...alapinQ(EXPLANATIONS), ...viennaQ(EXPLANATIONS)]
export const DEVIATIONS = [...scotchDev(EXPLANATIONS), ...smithMorraDev.buildDeviations(EXPLANATIONS), ...caroKannDev.buildDeviations(EXPLANATIONS), ...nimzoDev.buildDeviations(EXPLANATIONS), ...tarraschDev.buildDeviations(EXPLANATIONS), ...italianDev(EXPLANATIONS), ...alapinDev.buildDeviations(EXPLANATIONS), ...viennaDev.buildDeviations(EXPLANATIONS)]
