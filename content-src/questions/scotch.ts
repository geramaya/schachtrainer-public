import type { Explanation, Question } from '../../src/content/types.ts'
import { buildQuestionsFor } from '../builders.ts'
import type { QSpec } from '../builders.ts'

const BASE = 'e4 e5 Nf3 Nc6 d4'
const CL = `${BASE} exd4 Nxd4`
const GA = `${BASE} exd4 Bc4`
const QH = `${CL} Qh4`
const SC = `${CL} Bc5 Be3 Qf6 c3`
const HB = `${QH} Nb5 Bb4+ Bd2 Qxe4+ Be2 Kd8 O-O Bxd2 Qxd2`

export const QSPECS: QSpec[] = [
  { v: 'scotch-game', line: 'e4 e5', at: 1, prompt: 'Welche Felder kontrolliert der Bauer auf e4 nach 1. e4?', choices: [
    ['d5 und f5', true],
    ['d4 und f4', false],
    ['e5 und e6', false]] },
  { v: 'scotch-game', line: 'e4 e5 Nf3', at: 2, prompt: 'Nach 1. e4 e5: Welcher Springerzug greift den Bauern e5 an?', answer: 'Nf3' },
  { v: 'scotch-game', line: BASE, at: 4, prompt: 'Nach 1. e4 e5 2. Sf3 Sc6: Welcher Zug ist das Markenzeichen der Schottischen Partie?', answer: 'd4' },
  { v: 'scotch-game', line: BASE, at: 5, prompt: 'Was erreicht Weiß mit 3. d4?', choices: [
    ['Das Zentrum wird sofort geöffnet, Linien für die Figuren entstehen', true],
    ['Der Läufer wird auf c4 festgelegt', false],
    ['Weiß sichert den König durch frühe Rochade', false]] },
  { v: 'scotch-game-classical-variation', line: `${CL} Bc5`, at: 6, prompt: 'Nach 3…exd4: Welchen Zug spielst du in der Hauptlinie?', answer: 'Nxd4' },
  { v: 'scotch-game-classical-variation', line: `${CL} Bc5`, at: 8, prompt: 'Schwarz hat 4…Lc5 gespielt, der Läufer zielt auf d4. Wie entwickelst du mit Tempo?', answer: 'Be3' },
  { v: 'scotch-game-classical-variation', line: `${CL} Bc5`, at: 7, prompt: 'Welche Aussage über die Antworten auf 4. Sxd4 stimmt?', choices: [
    ['Das Repertoire kennt mehrere Antworten; …Lc5 und …Sf6 zählt die Engine zu den besten Zügen', true],
    ['Nur …Lc5 kommt in Frage', false],
    ['Schwarz muss sofort die Dame ziehen', false]] },
  { v: 'scotch-game-lolli-variation', line: `${BASE} Nxd4`, at: 6, prompt: 'Schwarz nimmt mit 3…Sxd4 den Bauern. Wie antwortest du?', answer: 'Nxd4' },
  { v: 'scotch-game-lolli-variation', line: `${BASE} Nxd4 Nxd4 exd4`, at: 8, prompt: 'Schwarz hat mit dem e-Bauern auf d4 zurückgenommen und steht einen Bauern vorn. Wie gewinnst du den Bauern zurück?', answer: 'Qxd4' },
  { v: 'scotch-game-lolli-variation', line: `${BASE} Nxd4 Nxd4`, at: 7, prompt: 'Nach 4. Sxd4: Was bleibt Schwarz, wenn er nicht zurücknimmt?', choices: [
    ['Er steht eine Figur gegen einen Bauern im Nachteil', true],
    ['Er steht einen Bauern vorn', false]] },
  { v: 'scotch-game-lolli-variation', line: `${BASE} Nxd4 Nxd4`, at: 7, prompt: 'Wo steht der weiße Springer nach 4. Sxd4?', choices: [
    ['Zentral auf d4', true],
    ['Auf f3, er hat nicht genommen', false]] },
  { v: 'scotch-game-scotch-gambit', line: GA, at: 7, prompt: 'Wann passt das Schottische Gambit laut Jarvis-Memo?', choices: [
    ['Wenn man bereit für eine taktische Achterbahnfahrt ist', true],
    ['Wenn man eine ruhige, risikoarme Partie will', false]] },
  { v: 'scotch-game-scotch-gambit', line: GA, at: 7, prompt: 'Auf welchen Punkt zielt der Läufer c4 nach 4. Lc4?', choices: [
    ['f7, gedeckt nur vom König', true],
    ['f5', false],
    ['b5', false]] },
  { v: 'scotch-game-scotch-gambit', line: GA, at: 7, prompt: 'Vor welchen Verteidigungsideen warnt das Jarvis-Memo?', choices: [
    ['…Sf6 und …d5 oder …Se6', true],
    ['…a6 und …h6', false],
    ['…f5 und …g5', false]] },
  { v: 'scotch-game-haxo-gambit', line: `${GA} Bc5`, at: 8, prompt: 'Nach 4. Lc4 Lc5: Welcher Bauernzug greift den Bauern d4 an?', answer: 'c3' },
  { v: 'scotch-game-haxo-gambit', line: `${GA} Bc5`, at: 8, prompt: 'Welcher Springerzug nach g5 erhöht sofort den Druck auf f7?', answer: 'Ng5' },
  { v: 'scotch-game-malaniuk-variation', line: `${CL} Bb4+`, at: 8, prompt: 'Schwarz gibt Schach auf b4. Wie beantwortest du es solide?', answer: 'c3' },
  { v: 'scotch-game-schmidt-variation', line: `${CL} Nf6`, at: 8, prompt: 'Nach 4…Sf6: Mit welchem Zug störst du die schwarze Bauernstruktur?', answer: 'Nxc6' },
  { v: 'scotch-game-schmidt-variation', line: `${CL} Nf6`, at: 8, prompt: 'Warum nimmst du auf c6?', choices: [
    ['Schwarz muss mit dem b- oder d-Bauern zurücknehmen, die Struktur leidet', true],
    ['Um die eigene Dame zu aktivieren', false]] },
  { v: 'scotch-game-schmidt-variation', line: `${CL} Nf6`, at: 8, prompt: 'Welchen Bauern greift der schwarze Springer f6 an?', choices: [
    ['e4, der noch ungedeckt ist', true],
    ['d4, der längst getauscht ist', false],
    ['f2', false]] },
  { v: 'scotch-game-scotch-gambit-london-defense', line: `${GA} Bb4+`, at: 8, prompt: 'Schwarz gibt Schach auf b4. Welche Antwort baut das Zentrum auf?', answer: 'c3' },
  { v: 'scotch-game-steinitz-variation', line: QH, at: 8, prompt: 'Die schwarze Dame greift e4 an. Welcher Zug deckt den Bauern und entwickelt?', answer: 'Nc3' },
  { v: 'scotch-game-steinitz-variation', line: QH, at: 8, prompt: 'Welchen ungedeckten weißen Bauern greift die Dame h4 an?', choices: [
    ['e4', true],
    ['f2, vom König gedeckt', false],
    ['d4', false]] },
  { v: 'scotch-game-steinitz-variation', line: `${QH} Nb5`, at: 9, prompt: 'Nach der Alternative 5. Sb5: Welcher Zug mit Schach droht dem Springer auf c7?', choices: [
    ['Sxc7+, mit Angriff auf den Turm a8', true],
    ['Sxa7+, mit Schach', false]] },
  { v: 'scotch-game-horwitz-attack', line: `${QH} Nb5`, at: 9, prompt: 'Welche Drohung entsteht nach 5. Sb5?', choices: [
    ['Sxc7+ mit Schach', true],
    ['Dd1xd8', false]] },
  { v: 'scotch-game-scotch-gambit-advance-variation', line: `${GA} Nf6 e5`, at: 8, prompt: 'Nach 4…Sf6: Welcher scharfe Zug greift den Springer an?', answer: 'e5' },
  { v: 'scotch-game-scotch-gambit-advance-variation', line: `${GA} Nf6 e5`, at: 9, prompt: 'Welche Antwort bringt Schwarz Erleichterung im Zentrum?', choices: [
    ['…d5, Angriff auf den Läufer', true],
    ['…h6 als Wartezug', false]] },
  { v: 'scotch-game-scotch-gambit-sarratt-variation', line: `${GA} Bc5`, at: 8, prompt: 'Welcher Zug richtet Springer und Läufer gemeinsam gegen f7?', answer: 'Ng5' },
  { v: 'scotch-game-scotch-gambit-sarratt-variation', line: `${GA} Bc5 Ng5`, at: 9, prompt: 'Wie verteidigt sich Schwarz hier mit …Sh6?', choices: [
    ['Der Springer deckt f7 und hält die Verteidigung zusammen', true],
    ['Er greift den Springer g5 an', false]] },
  { v: 'scotch-game-ghulam-kassim-variation', line: `${CL} Nxd4 Qxd4 d6 Bd3`, at: 8, prompt: 'Schwarz hat auf d4 genommen. Wie nimmst du zurück?', answer: 'Qxd4' },
  { v: 'scotch-game-ghulam-kassim-variation', line: `${CL} Nxd4 Qxd4 d6 Bd3`, at: 8, prompt: 'Welcher Zug wäre hier ein grober Fehler?', choices: [
    ['Lc4 und die Figur auf d4 stehen lassen', true],
    ['Dxd4', false]] },
  { v: 'scotch-game-mieses-variation', line: `${CL} Nf6 Nxc6 bxc6 e5`, at: 9, prompt: 'Nach 5. Sxc6: Welcher schwarze Zug wäre ein grober Fehler?', choices: [
    ['Sxe4', true],
    ['bxc6', false]] },
  { v: 'scotch-game-mieses-variation', line: `${CL} Nf6 Nxc6 bxc6 e5`, at: 10, prompt: 'Welcher Bauernzug greift den Springer f6 an?', answer: 'e5' },
  { v: 'scotch-game-mieses-variation', line: `${CL} Nf6 Nxc6 bxc6 e5`, at: 10, prompt: 'Was ist die strukturelle Folge von …bxc6?', choices: [
    ['Schwarz hat Doppelbauern auf der c-Linie', true],
    ['Schwarz hat Doppelbauern auf der f-Linie', false]] },
  { v: 'scotch-game-classical-variation-millennium-variation', line: `${SC} Qg6`, at: 10, prompt: 'Nach 5…Df6: Welcher Zug stützt den Springer d4?', answer: 'c3' },
  { v: 'scotch-game-classical-variation-millennium-variation', line: `${SC} Qg6`, at: 12, prompt: 'Die schwarze Dame auf g6 greift e4 an. Welcher Damenzug gehört nach der Engine zu den besten?', answer: 'Qe2' },
  { v: 'scotch-game-classical-variation-blackburne-attack', line: `${SC} Nge7 Qd2`, at: 12, prompt: 'Welche Folge hat Dd2 in der Blackburne-Struktur für den Springer b1?', choices: [
    ['Ihm bleibt nur Sa3, weil c3 und d2 besetzt sind', true],
    ['Er kann jetzt nach c3 springen', false],
    ['Er steht sofort im Schach', false]] },
  { v: 'scotch-game-classical-variation-blackburne-attack', line: `${SC} Nge7 Qd2`, at: 13, prompt: 'Welcher Gegenzug greift den Bauern e4 an und öffnet den Läufer c8?', choices: [
    ['…d5', true],
    ['…a6', false]] },
  { v: 'scotch-game-horwitz-attack-blackburne-variation', line: HB, at: 12, prompt: 'Schwarz hat mit Schach auf e4 genommen. Wie beantwortest du das Schach?', answer: 'Be2' },
  { v: 'scotch-game-horwitz-attack-blackburne-variation', line: HB, at: 14, prompt: 'Der schwarze König zog auf d8. Wie bringst du deinen König in Sicherheit?', answer: 'O-O' },
]

export const buildQuestions = (explanations: Explanation[], specs: QSpec[] = QSPECS): Question[] =>
  buildQuestionsFor('scotch', explanations, specs)
