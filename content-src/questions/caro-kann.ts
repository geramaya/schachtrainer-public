import type { Explanation, Question } from '../../src/content/types.ts'
import { buildQuestionsFor } from '../builders.ts'
import type { QSpec } from '../builders.ts'
import { CARO_KANN_IDS as I, CK_LINES as L } from '../explanations/caro-kann.ts'

export const QSPECS: QSpec[] = [
  { v: I.R, line: L.base, at: 2, prompt: 'Welche Figur bleibt nach 1…c6 anders als nach 1…e6 frei?', choices: [['Der Läufer c8', true], ['Der Läufer f8', false], ['Der Springer g8', false]] },
  { v: I.R, line: L.base, at: 3, prompt: 'Weiß hat e4 und d4 besetzt. Wie greifst du den Bauern e4 an?', answer: 'd5' },
  { v: I.R, line: L.base, at: 4, prompt: 'Wie nennt sich 3. e5 in der Caro-Kann-Verteidigung?', choices: [['Vorstoß-Variante', true], ['Abtausch-Variante', false], ['Klassische Variante', false]] },
  { v: I.R, line: L.dev1, at: 3, prompt: 'Weiß spielt 2. Sf3 statt d4. Wie bleibst du im Repertoire?', answer: 'd5' },
  { v: I.R, line: L.dev2, at: 3, prompt: 'Weiß spielt 2. c4. Welcher Zug bleibt deine Antwort?', answer: 'd5' },
  { v: I.R, line: L.dev3, at: 3, prompt: 'Weiß spielt 2. d3. Welcher Zug bleibt deine Antwort?', answer: 'd5' },
  { v: I.ADV, line: L.adv, at: 5, prompt: 'Nach 3. e5: Welcher Zug bringt den Läufer c8 vor die Bauernkette?', answer: 'Bf5' },
  { v: I.ADV, line: L.adv, at: 7, prompt: 'Welcher Bauernzug deckt d5 und schließt die Kette?', answer: 'e6' },
  { v: I.ADV, line: L.adv, at: 9, prompt: 'Welcher Bauernzug greift den Fuß d4 der weißen Kette an?', answer: 'c5' },
  { v: I.ADV, line: L.adv, at: 13, prompt: 'Warum geht der Springer g8 nach e7 und nicht nach f6?', choices: [['Der Bauer e5 greift f6 an', true], ['f6 ist durch den Läufer f5 besetzt', false], ['Sf6 gibt Schach', false]] },
  { v: I.EXC, line: L.exc, at: 5, prompt: 'Weiß hat auf d5 getauscht. Wie nimmst du zurück?', answer: 'cxd5' },
  { v: I.EXC, line: L.exc, at: 7, prompt: 'Welcher Springerzug greift den Bauern d4 an?', answer: 'Nc6' },
  { v: I.EXC, line: L.exc, at: 11, prompt: 'Welcher Läuferzug greift die weiße Dame an?', answer: 'Bg4' },
  { v: I.EXC, line: L.exc, at: 13, prompt: 'Die Dame b3 greift einen ungedeckten Bauern an. Welchen?', choices: [['b7', true], ['a7', false], ['f7', false]] },
  { v: I.CLA, line: L.cla, at: 5, prompt: 'Nach 3. Sc3: Wie löst du die Spannung im Zentrum?', answer: 'dxe4' },
  { v: I.CLA, line: L.cla, at: 7, prompt: 'Der Springer steht auf e4. Welcher Zug entwickelt den Läufer c8 mit Angriff?', answer: 'Bf5' },
  { v: I.CLA, line: L.cla, at: 11, prompt: 'Weiß hat h4 gespielt. Welcher Bauernzug gibt dem Läufer g6 das Feld h7?', answer: 'h6' },
  { v: I.CLA, line: L.cla, at: 15, prompt: 'Der Bauer h5 greift g6 an. Wohin weicht der Läufer aus?', answer: 'Bh7' },
  { v: I.CLA, line: L.cla, at: 17, prompt: 'Weiß hat Ld3 gespielt. Welcher Zug tauscht die Läufer?', answer: 'Bxd3' },
  { v: I.PAN, line: L.pan, at: 7, prompt: 'Der Bauer c4 greift d5 an. Welcher Springerzug deckt d5 und entwickelt?', answer: 'Nf6' },
  { v: I.PAN, line: L.pan, at: 11, prompt: 'Welcher Läuferzug fesselt den Springer c3 an den König?', answer: 'Bb4' },
  { v: I.PAN, line: L.pan, at: 13, prompt: 'Weiß hat auf d5 geschlagen. Mit welchem Zug entsteht der Isolani d4?', answer: 'Nxd5' },
  { v: I.PAN, line: L.pan, at: 19, prompt: 'Welcher weiße Bauer ist isoliert?', choices: [['d4', true], ['b2', false], ['g2', false]] },
  { v: I.TK, line: L.tk, at: 3, prompt: 'Weiß spielt 2. Sc3. Welcher Zug bleibt deine Antwort?', answer: 'd5' },
  { v: I.TK, line: L.tk, at: 5, prompt: 'Welcher Läuferzug greift den Springer f3 an?', answer: 'Bg4' },
  { v: I.TK, line: L.tk, at: 7, prompt: 'Weiß hat h3 gespielt. Wie tauschst du den Läufer gegen den Springer?', answer: 'Bxf3' },
  { v: I.TK, line: L.tk, at: 9, prompt: 'Welcher Bauernzug deckt d5 und öffnet den Läufer f8?', answer: 'e6' },
]

export const buildQuestions = (explanations: Explanation[]): Question[] => buildQuestionsFor('caro-kann', explanations, QSPECS)
