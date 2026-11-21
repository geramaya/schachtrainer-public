import type { Explanation, Question } from '../../src/content/types.ts'
import { buildQuestionsFor } from '../builders.ts'
import type { QSpec } from '../builders.ts'
import { TARRASCH_IDS as I, TARRASCH_LINES as L } from '../explanations/tarrasch.ts'

export const QSPECS: QSpec[] = [
  // --- Wurzel
  { v: I.R, line: L.root, at: 3, prompt: 'Nach 2. c4: Welcher Bauernzug deckt den Bauern d5?', answer: 'e6' },
  { v: I.R, line: L.root, at: 5, prompt: 'Nach 3. Sc3: Welcher Bauernzug führt zur Tarrasch-Verteidigung?', choices: [['3…c5', true], ['3…c6', false], ['3…b6', false]] },
  { v: I.R, line: L.root, at: 5, prompt: 'Wie oft ist der Bauer d5 nach 3. Sc3 gedeckt?', choices: [['Zweimal (Dame d8, Bauer e6)', true], ['Einmal', false], ['Dreimal', false]] },
  { v: I.R, line: L.root, at: 6, prompt: 'Welchen Bauern greift der Bauer c5 an?', choices: [['Den Bauern d4', true], ['Den Bauern c4', false], ['Den Springer c3', false]] },
  // --- Zwei Springer
  { v: I.TWO, line: L.main, at: 7, prompt: 'Weiß hat auf d5 geschlagen. Wie nimmst du in der Hauptlinie zurück?', answer: 'exd5' },
  { v: I.TWO, line: L.main, at: 8, prompt: 'Wie viele Bauern hat jede Seite nach 4…exd5?', choices: [['Je sieben', true], ['Je acht', false], ['Weiß acht, Schwarz sieben', false]] },
  { v: I.TWO, line: L.main, at: 9, prompt: 'Nach 5. Sf3: Welcher Springerzug greift d4 ein zweites Mal an?', answer: 'Nc6' },
  // --- Rubinstein-System
  { v: I.RUBS, line: L.main, at: 10, prompt: 'Welche Figuren greifen nach 5…Sc6 den Bauern d4 an?', choices: [['Bauer c5 und Springer c6', true], ['Bauer c5 und Läufer f8', false], ['Springer c6 und Dame d8', false]] },
  { v: I.RUBS, line: L.main, at: 11, prompt: 'Nach 6. g3: Welcher Springerzug entwickelt und deckt d5?', answer: 'Nf6' },
  { v: I.RUBS, line: L.main, at: 12, prompt: 'Von wem ist der Bauer d5 nach 6…Sf6 gedeckt?', choices: [['Dame d8 und Springer f6', true], ['Nur von der Dame d8', false], ['Läufer f8 und Dame d8', false]] },
  // --- Klassische Variante
  { v: I.CLA, line: L.main, at: 13, prompt: 'Welcher Läuferzug entwickelt den Läufer f8 und bereitet die Rochade vor?', answer: 'Be7' },
  { v: I.CLA, line: L.main, at: 14, prompt: 'Was geschieht durch 8. O-O mit dem Turm h1?', choices: [['Er kommt nach f1', true], ['Er kommt nach d1', false], ['Er bleibt auf h1', false]] },
  { v: I.CLA, line: L.main, at: 15, prompt: 'Welcher Zug bringt deinen König in Sicherheit?', answer: 'O-O' },
  // --- Hauptlinie
  { v: I.CLAM, line: L.main, at: 17, prompt: 'Nach 9. Lg5: Welcher Bauernzug öffnet die c-Linie?', answer: 'cxd4' },
  { v: I.CLAM, line: L.main, at: 17, prompt: 'Wie oft ist der Springer f6 nach 9. Lg5 gedeckt?', choices: [['Zweimal (Läufer e7, Bauer g7)', true], ['Einmal', false], ['Dreimal', false]] },
  { v: I.CLAM, line: L.main, at: 19, prompt: 'Warum ist der Bauer d5 nach 10. Sxd4 isoliert?', choices: [['Auf der c- und der e-Linie steht kein schwarzer Bauer', true], ['Er hat keinen Bauern hinter sich', false], ['Zwei weiße Bauern greifen ihn an', false]] },
  { v: I.CLAM, line: L.main, at: 19, prompt: 'Welcher Bauernzug fragt den Läufer g5?', answer: 'h6' },
  { v: I.CLAM, line: L.main, at: 21, prompt: 'Welcher Turmzug besetzt die halboffene e-Linie?', answer: 'Re8' },
  // --- kleine Varianten
  { v: I.MAR, line: L.mar, at: 9, prompt: 'Weiß spielt 5. e4. Wie gewinnst du einen Bauern?', answer: 'dxe4' },
  { v: I.SYM, line: L.sym, at: 7, prompt: 'Weiß spielt 4. e3. Welcher Springerzug ist eine gute Entwicklung?', answer: 'Nf6' },
  // --- was Weiß statt 3. Sc3 spielt
  { v: I.R, line: L.dev1, at: 5, prompt: 'Weiß spielt 3. Sf3 statt Sc3. Welcher Springerzug ist deine Antwort?', answer: 'Nf6' },
  { v: I.R, line: L.dev2, at: 5, prompt: 'Weiß spielt 3. e3. Welcher Springerzug ist deine Antwort?', answer: 'Nf6' },
]

export const buildQuestions = (explanations: Explanation[]): Question[] => buildQuestionsFor('tarrasch', explanations, QSPECS)
