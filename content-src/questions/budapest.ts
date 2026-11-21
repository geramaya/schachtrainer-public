import type { Explanation, Question } from '../../src/content/types.ts'
import { buildQuestionsFor } from '../builders.ts'
import type { QSpec } from '../builders.ts'
import { BUD_IDS as I, BUD_LINES as L } from '../explanations/budapest.ts'

export const QSPECS: QSpec[] = [
  { v: I.R, line: L.root, at: 1, prompt: 'Weiß spielt 1. d4. Welcher Springerzug ist deine Antwort?', answer: 'Nf6' },
  { v: I.R, line: L.root, at: 3, prompt: 'Nach 2. c4: Welcher Bauernzug ist das Budapester Gambit?', choices: [['e5', true], ['e6', false], ['c5', false]] },
  { v: I.R, line: L.root, at: 4, prompt: 'Wie viele Bauern hat Schwarz nach 3. dxe5?', choices: [['Sieben', true], ['Acht', false], ['Sechs', false]] },
  { v: I.ACC, line: L.root, at: 5, prompt: 'Weiß hat auf e5 geschlagen. Welcher Springerzug greift den Bauern an?', answer: 'Ng4' },
  { v: I.MAIN, line: L.root, at: 6, prompt: 'Welche Antwort hat Weiß hier nicht als übliche Hauptlinie?', choices: [['4. h4', true], ['4. Lf4', false], ['4. Sf3', false]] },
  { v: I.RUB, line: L.rub, at: 7, prompt: 'Nach 4. Lf4: Welcher Springerzug greift e5 ein zweites Mal an?', answer: 'Nc6' },
  { v: I.RUB, line: L.rub, at: 8, prompt: 'Wie oft ist der weiße Bauer e5 nach 5. Sf3 gedeckt?', choices: [['Zweimal (Lf4, Sf3)', true], ['Einmal', false], ['Dreimal', false]] },
  { v: I.RUB, line: L.rub, at: 9, prompt: 'Welcher Läuferzug gibt Schach?', answer: 'Bb4+' },
  { v: I.TRAP, line: L.rub, at: 11, prompt: 'Weiß hat 6. Sbd2 gespielt. Welcher Damenzug deckt den Läufer und greift e5 an?', answer: 'Qe7' },
  { v: I.TRAP, line: L.rub, at: 13, prompt: 'Weiß hat a3 gespielt. Welcher Springerzug öffnet die e-Linie?', answer: 'Ngxe5' },
  { v: I.TRAP, line: L.rub, at: 14, prompt: 'Was droht Schwarz nach …Sgxe5?', choices: [['Sd3 mit Doppelschach und Matt', true], ['Lxa3', false], ['Dxe5', false]] },
  { v: I.TRAP, line: L.rub, at: 15, prompt: 'Weiß hat auf b4 geschlagen. Wie gewinnst du?', answer: 'Nd3' },
  { v: I.ADL, line: L.adl, at: 7, prompt: 'Nach 4. Sf3: Welcher Springerzug erhöht den Druck auf e5?', answer: 'Nc6' },
  { v: I.ADL, line: L.adl, at: 11, prompt: 'Welcher Damenzug deckt den Läufer b4?', answer: 'Qe7' },
  { v: I.ADL, line: L.adl, at: 13, prompt: 'Welcher Zug gewinnt den Bauern e5 zurück?', choices: [['Ncxe5 oder Ngxe5', true], ['Lxc3', false], ['Dxe5', false]] },
  { v: I.ALE, line: L.ale, at: 7, prompt: 'Weiß hat 4. e4 gespielt. Wie holst du den Bauern zurück?', answer: 'Nxe5' },
  { v: I.ALE, line: L.ale, at: 11, prompt: 'Der Bauer f4 greift deinen Springer e5 an. Wohin weicht er aus?', answer: 'Nec6' },
  { v: I.ALE, line: L.ale, at: 13, prompt: 'Welcher Bauernzug nimmt dem weißen Springer das Feld e5?', answer: 'd6' },
  { v: I.D5, line: L.d5, at: 5, prompt: 'Weiß spielt 3. d5. Welcher Läuferzug gibt Schach?', answer: 'Bb4+' },
  { v: I.D5, line: L.d5, at: 7, prompt: 'Welcher Bauernzug deckt den Läufer b4?', answer: 'a5' },
  { v: I.D5, line: L.d5, at: 9, prompt: 'Wie viele Bauern haben beide Seiten nach 3. d5?', choices: [['Je acht', true], ['Weiß acht, Schwarz sieben', false], ['Weiß sieben, Schwarz acht', false]] },
  { v: I.E3, line: L.e3, at: 5, prompt: 'Weiß spielt 3. e3. Welcher Zug gibt Schach?', answer: 'Bb4+' },
  { v: I.E3, line: L.e3, at: 7, prompt: 'Weiß hat mit dem Läufer geblockt. Wie tauschst du?', answer: 'Bxd2+' },
]

export const buildQuestions = (explanations: Explanation[]): Question[] => buildQuestionsFor('budapest', explanations, QSPECS)
