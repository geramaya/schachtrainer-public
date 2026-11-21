import type { Explanation, Question } from '../../src/content/types.ts'
import { buildQuestionsFor } from '../builders.ts'
import type { QSpec } from '../builders.ts'
import { SMITH_MORRA_IDS as I } from '../explanations/smith-morra.ts'

const B = 'e4 c5 d4 cxd4 c3'
const AL = `${B} dxc3 Nxc3 Nc6 Nf3 d6 Bc4 e6`
const NF = `${B} Nf6 e5 Nd5 Nf3`
const DD = `${B} d5 exd5 Qxd5 cxd4`

export const QSPECS: QSpec[] = [
  { v: I.G, line: B, at: 3, prompt: 'Welcher schwarze Bauer greift nach 2. d4 den Bauern d4 an?', choices: [['c5', true], ['d7', false], ['e7', false]] },
  { v: I.G, line: B, at: 4, prompt: 'Nach 2…cxd4: Mit welchem Zug opfert Weiß im Smith-Morra-Gambit einen weiteren Bauern?', choices: [['3. c3', true], ['3. Sxd4', false], ['3. Dxd4', false]] },
  { v: I.G, line: B, at: 5, prompt: 'Nach 3. c3 dxc3 4. Sxc3: Wie steht es materiell?', choices: [['Weiß hat einen Bauern weniger', true], ['Weiß hat einen Bauern mehr', false], ['Material ist gleich', false]] },
  { v: I.ACC, line: AL, at: 6, prompt: 'Schwarz hat auf c3 geschlagen. Wie nimmst du zurück und entwickelst zugleich?', answer: 'Nxc3' },
  { v: I.ACC, line: AL, at: 7, prompt: 'Wie viele Bauern haben beide Seiten nach 4. Sxc3?', choices: [['Weiß sechs, Schwarz sieben', true], ['Weiß sieben, Schwarz sechs', false], ['Beide acht', false]] },
  { v: I.ACC, line: AL, at: 10, prompt: 'Schwarz hat …d6 gespielt. Welcher Läuferzug zielt auf f7?', answer: 'Bc4' },
  { v: I.ACC, line: AL, at: 12, prompt: 'Sc3, Sf3 und Lc4 stehen. Welcher Zug bringt den König in Sicherheit?', answer: 'O-O' },
  { v: I.NF6, line: NF, at: 6, prompt: 'Schwarz greift mit 3…Sf6 den Bauern e4 an. Welcher Bauernzug greift den Springer an?', answer: 'e5' },
  { v: I.NF6, line: NF, at: 7, prompt: 'Was greift der weiße Bauer auf e5 an?', choices: [['Den Springer f6', true], ['Den Bauern d5', false], ['Die Dame d8', false]] },
  { v: I.NF6, line: NF, at: 8, prompt: 'Der Springer steht auf d5. Welcher Zug entwickelt eine Figur?', answer: 'Nf3' },
  { v: I.D5, line: DD, at: 6, prompt: 'Schwarz spielt 3…d5 und greift e4 an. Wie antwortest du?', answer: 'exd5' },
  { v: I.D5, line: DD, at: 7, prompt: 'Nach 4. exd5: Welche Dame-Aufstellung kann ein weißer Springer auf c3 angreifen?', choices: [['Dxd5', true], ['Dd8', false]] },
  { v: I.D5, line: DD, at: 8, prompt: 'Schwarz hat die Dame auf d5 aufgestellt. Wie gewinnst du den Bauern d4 zurück?', answer: 'cxd4' },
]

export const buildQuestions = (explanations: Explanation[]): Question[] => buildQuestionsFor('smith-morra', explanations, QSPECS)
