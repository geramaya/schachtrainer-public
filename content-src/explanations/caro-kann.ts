import type { Explanation } from '../../src/content/types.ts'
import { buildExplanationsFor } from '../builders.ts'
import type { ExplSpec } from '../builders.ts'

const R = 'caro-kann-defense'
const ADV = `${R}-advance-variation`
const EXC = `${R}-exchange-variation`
const CLA = `${R}-classical-variation`
const PAN = `${R}-panov-attack`
const TK = `${R}-two-knights-attack`

export const CK_LINES = {
  base: 'e4 c6 d4 d5',
  adv: 'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 Be3 cxd4 Nxd4 Ne7',
  exc: 'e4 c6 d4 d5 exd5 cxd5 Bd3 Nc6 c3 Nf6 Bf4 Bg4 Qb3 Qd7',
  cla: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7 h5 Bh7 Bd3 Bxd3 Qxd3 e6',
  pan: 'e4 c6 d4 d5 exd5 cxd5 c4 Nf6 Nc3 e6 Nf3 Bb4 cxd5 Nxd5 Bd2 Nc6 Bd3 Nf6 O-O O-O',
  tk: 'e4 c6 Nc3 d5 Nf3 Bg4 h3 Bxf3 Qxf3 e6 Be2 Nf6',
  dev1: 'e4 c6 Nf3 d5',
  dev2: 'e4 c6 c4 d5',
  dev3: 'e4 c6 d3 d5',
}
const L = CK_LINES

export const SPECS: ExplSpec[] = [
  // --- Wurzel: 1. e4 c6 2. d4 d5
  // 1. e4 (position after one ply) is explained in the Scotch content: the position is shared by both sides
  { v: R, line: L.base, at: 2, title: '1…c6: der Bauer bereitet d5 vor', best: ['d4'],
    text: 'Der Bauer c6 deckt später das Feld d5 mit einem Bauern statt mit einer Figur. Anders als nach 1…e6 bleibt der Läufer c8 frei und kann vor die Bauernkette ziehen. Weiß baut meist mit 2. d4 ein Zentrum auf.' },
  { v: R, line: L.base, at: 3, title: '2. d4: Schwarz greift e4 an', best: ['d5'],
    text: 'Weiß hat die Bauern e4 und d4 im Zentrum. Mit …d5 greift Schwarz den Bauern e4 an und deckt d5 mit dem Bauern c6.' },
  { v: R, line: L.base, at: 4, title: 'Nach 2…d5: Weiß wählt den Weg',
    text: 'Jetzt entscheidet Weiß, wie er den Bauern e4 behandelt: 3. e5 (Vorstoß), 3. exd5 (Abtausch) oder 3. Sc3 und 3. Sd2 (Klassisch). Die weiteren Varianten dieser Eröffnung zeigen je eine Antwort.' },
  // --- Vorstoß 3. e5
  { v: ADV, line: L.adv, at: 5, title: '3. e5: Weiß gewinnt Raum', best: ['Bf5', 'c5'],
    text: 'Der Bauer e5 greift die Felder d6 und f6 an, der Springer g8 verliert damit f6. Schwarz hat zwei Aufgaben: den Läufer c8 vor die Bauernkette bringen, bevor …e6 ihn einsperrt, und später den weißen Bauern d4 angreifen. Die Engine zählt 3…Lf5 und 3…c5 zu den besten Zügen.' },
  { v: ADV, line: L.adv, at: 6, title: 'Der Läufer steht vor der Kette',
    text: 'Der Läufer f5 steht außerhalb der Bauernkette, die Schwarz mit …e6 aufbaut. Er zielt über d3 auf den Bauern c2.' },
  { v: ADV, line: L.adv, at: 7, title: 'Die Kette schließen', best: ['e6'],
    text: 'Der Bauer e6 deckt d5. Schwarz hat jetzt die Bauern c6, d5 und e6; der Läufer c8 ist schon draußen.' },
  { v: ADV, line: L.adv, at: 9, title: 'Der Fuß der Kette', best: ['c5'],
    text: 'Der Bauer c5 greift den Bauern d4 an, den Fuß der weißen Kette d4–e5. Fällt oder tauscht sich d4, verliert der Bauer e5 seine Bauerndeckung.' },
  { v: ADV, line: L.adv, at: 11, title: 'Tausch auf d4', best: ['cxd4', 'Qb6'],
    text: 'Nach …cxd4 und Sxd4 steht der Bauer e5 nicht mehr durch einen Bauern gedeckt. Schwarz hat zwei gute Wege: tauschen auf d4 oder mit …Db6 zusätzlich Druck auf d4 machen.' },
  { v: ADV, line: L.adv, at: 13, title: 'Springer nach e7', best: ['Ne7'],
    text: 'Auf f6 würde der Bauer e5 den Springer angreifen. Darum geht der Springer g8 über e7 ins Spiel und lässt dem Läufer f8 den Weg frei.' },
  // --- Abtausch 3. exd5
  { v: EXC, line: L.exc, at: 5, title: '3. exd5: der Abtausch', best: ['cxd5'],
    text: 'Weiß tauscht den Bauern e4 gegen d5, Schwarz schlägt mit dem Bauern c6 zurück. Danach hat Weiß keinen e-Bauern mehr, Schwarz keinen c-Bauern; beide haben sieben Bauern.' },
  { v: EXC, line: L.exc, at: 6, title: 'Weiß wählt den Aufbau',
    text: 'Weiß kann ruhig mit 4. Ld3 entwickeln oder mit 4. c4 den Bauern d5 angreifen (Panov-Angriff, eigene Variante). Schwarz plant in beiden Fällen die Springer und den Läufer c8 zu entwickeln, bevor …e6 ihn einsperrt.' },
  { v: EXC, line: L.exc, at: 7, title: 'Springer greift d4 an', best: ['Nc6'],
    text: 'Der Läufer d3 deckt c2 und zielt über die Diagonale auf h7. Der Springer c6 greift den Bauern d4 an und entwickelt zugleich.' },
  { v: EXC, line: L.exc, at: 9, title: 'Springer deckt d5', best: ['Nf6', 'Qc7'],
    text: 'Der Bauer c3 stützt d4. Der Springer f6 deckt d5 und entwickelt die zweite Leichtfigur.' },
  { v: EXC, line: L.exc, at: 11, title: 'Läufer greift die Dame an', best: ['Bg4', 'Qb6'],
    text: 'Der Läufer g4 greift die Dame d1 an. Die Diagonale ist frei, weil Weiß seinen Springer g1 noch nicht entwickelt hat.' },
  { v: EXC, line: L.exc, at: 13, title: 'Der Bauer b7 braucht Schutz', best: ['Qd7'],
    text: 'Die Dame b3 greift den ungedeckten Bauern b7 an. Die Dame d7 deckt b7 entlang der siebten Reihe und zugleich den Läufer g4.' },
  // --- Klassisch 3. Sc3 dxe4 4. Sxe4 Lf5
  { v: CLA, line: L.cla, at: 5, title: '3. Sc3: Druck auf d5', best: ['dxe4'],
    text: 'Der Springer c3 greift d5 an und deckt e4. Schwarz löst die Spannung mit …dxe4; Weiß schlägt mit dem Springer zurück. Beide Seiten haben danach sieben Bauern.' },
  { v: CLA, line: L.cla, at: 6, title: 'Weiß nimmt zurück', best: ['Nxe4'],
    text: 'Der Springer holt den Bauern e4 zurück und steht zentral. Der Läufer c8 hat nun die Diagonale c8–h3 frei.' },
  { v: CLA, line: L.cla, at: 7, title: 'Der Läufer vor die Kette', best: ['Bf5', 'Nf6'],
    text: 'Der Läufer f5 greift den Springer e4 an, solange die Bauernkette noch nicht gebaut ist. Das ist die Idee des Klassischen Systems: Läufer c8 erst entwickeln, dann …e6.' },
  { v: CLA, line: L.cla, at: 8, title: 'Springer greift den Läufer an', best: ['Ng3'],
    text: 'Der Springer g3 greift den Läufer f5 an und deckt h5 und e4.' },
  { v: CLA, line: L.cla, at: 9, title: 'Rückzug nach g6', best: ['Bg6'],
    text: 'Der Läufer g6 bleibt auf der Diagonale b1–h7 und zielt über f5, e4 und d3 auf c2.' },
  { v: CLA, line: L.cla, at: 11, title: 'Platz für den Läufer', best: ['h6'],
    text: 'Der Bauer h4 will mit h5 den Läufer g6 angreifen. Der Bauer h6 gibt dem Läufer das Feld h7.' },
  { v: CLA, line: L.cla, at: 13, title: 'Entwicklung des Damenspringers', best: ['Nd7'],
    text: 'Der Springer d7 entwickelt eine Figur und bereitet …Sgf6 und …e6 vor.' },
  { v: CLA, line: L.cla, at: 15, title: 'Ausweichen nach h7', best: ['Bh7'],
    text: 'Der Bauer h5 greift das Feld g6 an, nicht h7. Auf h7 bleibt der Läufer auf der Diagonale b1–h7 und ist nicht angreifbar.' },
  { v: CLA, line: L.cla, at: 17, title: 'Läufertausch', best: ['Bxd3'],
    text: 'Die beiden Läufer auf der Diagonale tauschen sich. Danach hat Weiß den aktiven Läufer d3 abgegeben, und die Dame nimmt auf d3 zurück.' },
  { v: CLA, line: L.cla, at: 19, title: 'Das Gerüst: …e6', best: ['e6', 'Qc7'],
    text: 'Der Bauer e6 deckt die Felder d5 und f5 und öffnet den Läufer f8. Schwarz hat noch Läufer f8 und Springer g8 zu entwickeln.' },
  // --- Panov 4. c4
  { v: PAN, line: L.pan, at: 7, title: '4. c4: der Panov-Angriff', best: ['Nf6'],
    text: 'Der Bauer c4 greift d5 an. Der Springer f6 deckt d5 zum zweiten Mal (neben der Dame d8) und entwickelt zugleich.' },
  { v: PAN, line: L.pan, at: 9, title: 'Zwei Aufbauten', best: ['e6', 'Nc6'],
    text: 'Schwarz hat zwei gute Aufbauten: …e6 (Hauptlinie, später …Lb4) und …Sc6 (Moderne Verteidigung). Der Bauer e6 deckt d5 und öffnet den Läufer f8.' },
  { v: PAN, line: L.pan, at: 11, title: 'Fesselung des Springers', best: ['Bb4', 'Be7'],
    text: 'Der Läufer b4 fesselt den Springer c3 an den König e1: Zwischen Läufer und König liegt nur der Springer.' },
  { v: PAN, line: L.pan, at: 13, title: 'Der Isolani entsteht', best: ['Nxd5', 'exd5'],
    text: 'Nach …Sxd5 hat Weiß einen isolierten Bauern auf d4, denn die Bauern c und e fehlen. Schwarz hat sechs Bauern, Weiß ebenfalls.' },
  { v: PAN, line: L.pan, at: 15, title: 'Ziel: der Isolani', best: ['Nc6', 'O-O'],
    text: 'Der Springer c6 greift den isolierten Bauern d4 an.' },
  { v: PAN, line: L.pan, at: 17, title: 'Springer zurück nach f6', best: ['O-O'],
    text: 'Der Läufer d3 zielt auf h7. Der Springer f6 deckt h7 und räumt das Feld d5.' },
  { v: PAN, line: L.pan, at: 19, title: 'Beide Könige rochiert', best: ['O-O'],
    text: 'Beide Seiten haben rochiert. Die c-Linie ist offen, und Weiß hat den isolierten Bauern d4.' },
  // --- Zweispringer 2. Sc3 d5 3. Sf3
  { v: TK, line: L.tk, at: 3, title: '2. Sc3: kein d4', best: ['d5'],
    text: 'Weiß entwickelt den Springer, bevor er d4 spielt. Der Springer c3 deckt e4 und greift d5 an. Schwarz spielt trotzdem …d5.' },
  { v: TK, line: L.tk, at: 5, title: '3. Sf3: zweiter Springer', best: ['dxe4', 'Bg4'],
    text: 'Schwarz hat zwei gute Wege: …dxe4 oder …Lg4. Der Läufer g4 greift den Springer f3 an, hinter dem die Dame d1 steht.' },
  { v: TK, line: L.tk, at: 7, title: 'Läufer gegen Springer', best: ['Bxf3'],
    text: 'Nach …Lxf3 und Dxf3 hat Weiß zwei Läufer; Schwarz hat Läufer f8 und zwei Springer.' },
  { v: TK, line: L.tk, at: 9, title: 'Die Kette: …e6', best: ['e6'],
    text: 'Der Bauer e6 deckt d5 und öffnet den Läufer f8. Der Läufer c8 ist getauscht, die Bauernkette kann ohne Sorge um ihn aufgebaut werden.' },
  { v: TK, line: L.tk, at: 11, title: 'Springer entwickeln', best: ['Nf6'],
    text: 'Der Springer f6 deckt d5 und entwickelt die letzte Leichtfigur des Königsflügels.' },
]

export const EXPLANATIONS_CARO_KANN: Explanation[] = buildExplanationsFor('caro-kann', SPECS)
export const CARO_KANN_IDS = { R, ADV, EXC, CLA, PAN, TK }
