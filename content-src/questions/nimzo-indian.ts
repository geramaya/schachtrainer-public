import type { Explanation, Question } from '../../src/content/types.ts'
import { buildQuestionsFor } from '../builders.ts'
import type { QSpec } from '../builders.ts'
import { NIMZO_IDS as I, NIMZO_LINES as L } from '../explanations/nimzo-indian.ts'

export const QSPECS: QSpec[] = [
  // --- Wurzel
  { v: I.R, line: L.root, at: 5, prompt: 'Nach 3. Sc3: Welcher Läuferzug fesselt den Springer?', answer: 'Bb4' },
  { v: I.R, line: L.root, at: 5, prompt: 'Warum ist der Springer c3 nach 3…Lb4 gefesselt?', choices: [['Das Feld d2 ist frei, der Läufer sieht den König e1', true], ['Der Bauer e2 steht im Weg', false], ['Der Springer b1 deckt c3 nicht', false]] },
  { v: I.R, line: L.root, at: 6, prompt: 'Wie heißt 4. a3 in der Nimzo-Indischen Verteidigung?', choices: [['Sämisch-Variante', true], ['Rubinstein-System', false], ['Kmoch-Variante', false]] },
  { v: I.R, line: L.dev1, at: 5, prompt: 'Weiß spielt 3. Sf3 statt Sc3. Welcher Bauernzug ist deine Antwort?', answer: 'd5' },
  { v: I.R, line: L.dev2, at: 5, prompt: 'Weiß spielt 3. g3. Welcher Bauernzug ist deine Antwort?', answer: 'd5' },
  // --- Rubinstein
  { v: I.RUB, line: L.rub, at: 7, prompt: 'Weiß hat 4. e3 gespielt. Welcher Zug bringt deinen König in Sicherheit?', answer: 'O-O' },
  { v: I.RUB, line: L.rub, at: 9, prompt: 'Nach 5. Ld3: Welcher Bauernzug baut ein eigenes Zentrum auf?', answer: 'd5' },
  { v: I.RUB, line: L.rub, at: 11, prompt: 'Welcher Bauernzug greift nach 6. Sf3 den Bauern d4 an?', answer: 'c5' },
  { v: I.RUB, line: L.rub, at: 11, prompt: 'Wie oft ist der Bauer d4 nach 6. Sf3 gedeckt?', choices: [['Zweimal (Bauer e3, Springer f3)', true], ['Einmal', false], ['Dreimal', false]] },
  { v: I.RUB, line: L.rub, at: 15, prompt: 'Der Bauer a3 greift deinen Läufer an. Wie tauschst du?', answer: 'Bxc3' },
  { v: I.RUB, line: L.rub, at: 17, prompt: 'Welche Schwäche hat Weiß nach 9. bxc3?', choices: [['Doppelbauern auf der c-Linie', true], ['Doppelbauern auf der f-Linie', false], ['Einen isolierten Bauern auf d4', false]] },
  { v: I.RUB, line: L.rub, at: 19, prompt: 'Welcher Damenzug deckt den Springer c6?', answer: 'Qc7' },
  // --- Klassisch
  { v: I.CLA, line: L.cla, at: 7, prompt: 'Nach 4. Dc2: Welcher Bauernzug greift den Bauern c4 an?', answer: 'd5' },
  { v: I.CLA, line: L.cla, at: 7, prompt: 'Welche Figur deckt die Dame c2 nach 4. Dc2?', choices: [['Den Springer c3', true], ['Den Läufer b4', false], ['Den Bauern d4', false]] },
  { v: I.CLA, line: L.cla, at: 8, prompt: 'Welche Figur greift der Bauer a3 nach 5. a3 an?', choices: [['Den Läufer b4', true], ['Den Springer c3', false], ['Den Bauern d5', false]] },
  { v: I.CLA, line: L.cla, at: 9, prompt: 'Der Läufer b4 steht angegriffen. Wie gehst du vor?', answer: 'Bxc3' },
  { v: I.CLA, line: L.cla, at: 11, prompt: 'Nach 6. Dxc3: Welcher Springerzug greift die Dame an?', choices: [['Se4', true], ['Sg4', false], ['Sd7', false]] },
  { v: I.CLA, line: L.cla, at: 13, prompt: 'Welcher Bauernzug greift den ungedeckten Bauern d4 an?', answer: 'c5' },
  // --- Sämisch
  { v: I.SAM, line: L.sam, at: 7, prompt: 'Der Bauer a3 greift den Läufer b4 an. Wie tauschst du?', answer: 'Bxc3' },
  { v: I.SAM, line: L.sam, at: 9, prompt: 'Welcher Bauernzug greift nach 5. bxc3 den Bauern d4 an?', answer: 'c5' },
  { v: I.SAM, line: L.sam, at: 9, prompt: 'Was hat Weiß nach 5. bxc3 auf der c-Linie?', choices: [['Doppelbauern, beide ungedeckt', true], ['Einen Freibauern', false], ['Einen gedeckten Bauern c3 und einen Läufer c4', false]] },
  { v: I.SAM, line: L.sam, at: 10, prompt: 'Wie oft ist der Bauer d4 nach 5…c5 gedeckt?', choices: [['Zweimal (Bauer c3, Dame d1)', true], ['Einmal', false], ['Gar nicht', false]] },
  { v: I.SAM, line: L.sam, at: 11, prompt: 'Welcher Bauernzug bereitet den Läufer b7 vor?', answer: 'b6' },
  // --- Kmoch
  { v: I.KM, line: L.km, at: 7, prompt: 'Weiß spielt 4. f3. Welcher Bauernzug besetzt das Zentrum?', answer: 'd5' },
  { v: I.KM, line: L.km, at: 8, prompt: 'Welche Figur greift der Bauer a3 nach 5. a3 an?', choices: [['Den Läufer b4', true], ['Den Springer f6', false], ['Den Bauern d5', false]] },
  { v: I.KM, line: L.km, at: 9, prompt: 'Der Bauer a3 greift deinen Läufer an. Wie antwortest du?', answer: 'Bxc3' },
  { v: I.KER, line: L.km, at: 11, prompt: 'Nach 6. bxc3: Welcher Bauernzug greift das Zentrum an?', answer: 'c5' },
  { v: I.KER, line: L.km, at: 13, prompt: 'Weiß hat auf d5 geschlagen. Wie holst du den Bauern zurück und stellst den Springer ins Zentrum?', answer: 'Nxd5' },
  { v: I.KER, line: L.km, at: 15, prompt: 'Wie viele Bauern haben beide Seiten nach 8. dxc5?', choices: [['Weiß sieben, Schwarz sechs', true], ['Je sieben', false], ['Weiß sechs, Schwarz sieben', false]] },
  // --- Drei Springer
  { v: I.TK, line: L.tk, at: 7, prompt: 'Nach 4. Sf3: Welcher Zug bringt deinen König in Sicherheit?', answer: 'O-O' },
  { v: I.TK, line: L.tk, at: 8, prompt: 'Welchen Plan bereitet 5. g3 vor?', choices: [['Das Läufer-Fianchetto auf g2', true], ['Den Tausch auf c3', false], ['Den Vorstoß e2-e4', false]] },
  { v: I.TK, line: L.tk, at: 11, prompt: 'Wie viele Bauern hat jede Seite nach 6. Sxd4?', choices: [['Je sieben', true], ['Weiß acht, Schwarz sieben', false], ['Je acht', false]] },
  { v: I.TK, line: L.tk, at: 11, prompt: 'Welcher Zug bringt deinen König in Sicherheit?', answer: 'O-O' },
  { v: I.TK, line: L.tk, at: 13, prompt: 'Welcher Bauernzug greift den Bauern c4 an?', answer: 'd5' },
  { v: I.TK, line: L.tk, at: 15, prompt: 'Weiß hat auf d5 geschlagen. Wie holst du den Bauern mit dem Springer zurück?', answer: 'Nxd5' },
  // --- kleine Varianten
  { v: I.LEN, line: L.len, at: 7, prompt: 'Der Läufer g5 fesselt den Springer f6. Welcher Bauernzug greift das Zentrum an?', answer: 'c5' },
  { v: I.SPI, line: L.spi, at: 7, prompt: 'Die Dame b3 greift deinen Läufer an. Welcher Bauernzug deckt ihn und greift d4 an?', answer: 'c5' },
]

export const buildQuestions = (explanations: Explanation[]): Question[] => buildQuestionsFor('nimzo-indian', explanations, QSPECS)
