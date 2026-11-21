import type { Explanation, Question } from '../../src/content/types.ts'
import { buildQuestionsFor } from '../builders.ts'
import type { QSpec } from '../builders.ts'
import { KID_IDS as I, KID_LINES as L } from '../explanations/kings-indian.ts'

export const QSPECS: QSpec[] = [
  { v: I.C4, line: L.c4, at: 3, prompt: 'Auf welcher Diagonale steht dein Läufer nach …Lg7?', choices: [['h8–a1', true], ['f8–a3', false], ['g7–a1 über f1', false]] },
  { v: I.C4, line: L.c4, at: 5, prompt: 'Was deckt der Bauer d6 zusätzlich zu e5?', choices: [['Das Feld c5', true], ['Das Feld b5', false], ['Das Feld f4', false]] },
  { v: I.C4, line: L.c4, at: 9, prompt: 'Springer und Läufer stehen. Welcher Zug bringt den König in Sicherheit?', answer: 'O-O' },
  { v: I.C4, line: L.c4, at: 11, prompt: 'Weiß hat d4 gespielt. Welcher Bauernzug greift ihn an?', answer: 'c5' },
  { v: I.NF3, line: L.nf3, at: 3, prompt: 'Weiß fianchettiert mit g3. Welcher Läuferzug ist dein Baustein?', answer: 'Bg7' },
  { v: I.NF3, line: L.nf3, at: 7, prompt: 'Welcher Springerzug kontrolliert e4 und deckt d5 und h7?', answer: 'Nf6' },
  { v: I.NF3, line: L.nf3, at: 9, prompt: 'Welcher Bauernzug greift das Feld d4 an?', answer: 'c5' },
  { v: I.NF3, line: L.nf3, at: 11, prompt: 'Welcher Zug bringt den König in Sicherheit?', answer: 'O-O' },
  { v: I.S2NF3, line: L.s2nf3, at: 5, prompt: 'Nach 3. c4: Welcher Zug stellt den Läufer auf die lange Diagonale?', answer: 'Bg7' },
  { v: I.S2NF3, line: L.s2nf3, at: 9, prompt: 'Weiß hat e4 gespielt. Welcher Bauernzug kontrolliert e5?', answer: 'd6' },
  { v: I.S2NF3, line: L.s2nf3, at: 11, prompt: 'Welcher Bauernzug ist der klassische Gegenstoß?', answer: 'e5' },
  { v: I.S2NF3, line: L.s2nf3, at: 13, prompt: 'Wie klärst du das Zentrum nach der Rochade von Weiß?', answer: 'exd4' },
  { v: I.LON, line: L.lon, at: 3, prompt: 'Weiß spielt 2. Lf4. Welcher Bauernzug bleibt dein Aufbau?', answer: 'g6' },
  { v: I.LON, line: L.lon, at: 5, prompt: 'Welcher Zug stellt den Läufer auf die lange Diagonale?', answer: 'Bg7' },
  { v: I.LON, line: L.lon, at: 7, prompt: 'Welcher Zug bringt den König in Sicherheit?', answer: 'O-O' },
  { v: I.G3, line: L.g3, at: 3, prompt: 'Weiß spielt 2. g3. Welcher Bauernzug bleibt dein Aufbau?', answer: 'g6' },
]

export const buildQuestions = (explanations: Explanation[]): Question[] => buildQuestionsFor('kings-indian', explanations, QSPECS)
