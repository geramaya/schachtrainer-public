import type { Explanation, Source } from '../../src/content/types.ts'
import { buildExplanationsFor } from '../builders.ts'
import type { ExplSpec } from '../builders.ts'

const P = 'indian-defense-budapest-gambit'
const ACC = `${P}-accepted`
const MAIN = `${ACC}-main-line`
export const BUD_IDS = {
  R: P, ACC, MAIN,
  RUB: `${MAIN}-rubinstein-variation`,
  ADL: `${MAIN}-adler-variation`,
  ALE: `${MAIN}-alekhine-variation`,
  TRAP: 'budapest-gambit-smothered-mate-trap',
  D5: 'budapest-gambit-declined-3-d5',
  E3: 'budapest-gambit-declined-3-e3',
}
const I = BUD_IDS
const TRAP_SRC: Source = { kind: 'dokument', ref: 'docs/repertoire-v1.8.md, Abschnitt 7: Budapester Falle (Das erstickte Matt)' }

export const BUD_LINES = {
  root: 'd4 Nf6 c4 e5 dxe5 Ng4',
  rub: 'd4 Nf6 c4 e5 dxe5 Ng4 Bf4 Nc6 Nf3 Bb4+ Nbd2 Qe7 a3 Ngxe5 axb4 Nd3',
  adl: 'd4 Nf6 c4 e5 dxe5 Ng4 Nf3 Nc6 Bf4 Bb4+ Nc3 Qe7 Bd2 Ncxe5',
  ale: 'd4 Nf6 c4 e5 dxe5 Ng4 e4 Nxe5 a3 g6 f4 Nec6 Bd2 d6 Nf3 Bh6',
  d5: 'd4 Nf6 c4 e5 d5 Bb4+ Bd2 a5 e3 Na6 Bd3 Nc5 Bc2 Nfe4',
  e3: 'd4 Nf6 c4 e5 e3 Bb4+ Bd2 Bxd2+ Qxd2 exd4 Qxd4 Nc6',
}
const L = BUD_LINES

export const SPECS: ExplSpec[] = [
  // --- Wurzel 1. d4 Sf6 2. c4 e5
  { v: I.R, line: L.root, at: 1, title: '1. d4: Weiß beginnt mit dem Damenbauern', best: ['Nf6'],
    text: 'Der Bauer d4 kontrolliert e5 und c5. Schwarz antwortet mit dem Springer f6, der e4 überwacht und noch alle Bauern flexibel lässt.' },
  { v: I.R, line: L.root, at: 2, title: '1…Sf6: Weiß nimmt Raum', best: ['c4'],
    text: 'Mit c4 greift Weiß das Feld d5 an und baut ein breites Bauernzentrum auf. Schwarz hat jetzt die Wahl zwischen ruhigen Aufbauten und dem Gambit.' },
  { v: I.R, line: L.root, at: 3, title: '2. c4: das Gambit …e5',
    text: 'Der Bauer e5 greift den Bauern d4 an und opfert sich: Nimmt Weiß mit dxe5, steht Schwarz einen Bauern hinter, hat dafür aber schnelle Entwicklung.' },
  { v: I.R, line: L.root, at: 4, title: 'Weiß nimmt den Bauern', best: ['dxe5'],
    text: 'Nach 3. dxe5 hat Weiß acht Bauern, Schwarz sieben. Der Bauer e5 steht vorgeschoben und muss gedeckt werden.' },
  // --- Angenommen
  { v: ACC, line: L.root, at: 5, title: '3…Sg4: der Springer greift e5 an', best: ['Ng4'],
    text: 'Der Springer g4 greift den Bauern e5 an und zielt auf f2. Schwarz will den Bauern zurückgewinnen und entwickelt dabei eine Figur.' },
  { v: MAIN, line: L.root, at: 6, title: 'Hauptlinie: Weiß wählt',
    text: 'Weiß hat drei übliche Wege: 4. Lf4 (Rubinstein), 4. e4 (Aljechin) und 4. Sf3 (Adler). Jede Variante zeigt deine Antwort darauf.' },
  // --- Rubinstein 4. Lf4
  { v: I.RUB, line: L.rub, at: 7, title: '4. Lf4: Weiß deckt e5', best: ['Nc6', 'Bb4+'],
    text: 'Der Läufer f4 deckt den Bauern e5. Schwarz entwickelt mit …Sc6 (zweiter Angreifer auf e5) oder gibt zuerst Schach mit …Lb4+. Die Engine zählt beide zu den besten Zügen.' },
  { v: I.RUB, line: L.rub, at: 8, title: 'Weiß entwickelt', best: ['Nf3'],
    text: 'Der Springer f3 deckt e5 ein zweites Mal. Der Bauer e5 wird jetzt vom Springer g4 und vom Springer c6 angegriffen, vom Läufer f4 und vom Springer f3 gedeckt.' },
  { v: I.RUB, line: L.rub, at: 9, title: 'Schach auf der Diagonale', best: ['Bb4+'],
    text: 'Der Läufer b4 gibt Schach und zwingt Weiß zu einer Antwort. Mit dem Läufer entwickelt Schwarz eine dritte Leichtfigur, bevor er rochiert.' },
  // --- Falle
  { v: I.TRAP, line: L.rub, at: 10, title: 'Die Falle beginnt: Schach beantworten', best: ['Nc3'], source: TRAP_SRC,
    text: 'Weiß muss das Schach beantworten. Die Engine zählt 6. Sc3 zu den besten Zügen. Die Falle entsteht nach 6. Sbd2: Dann steht der Springer auf d2 und blockiert die d-Linie.' },
  { v: I.TRAP, line: L.rub, at: 11, title: 'Die Dame deckt den Läufer', best: ['Qe7'], source: TRAP_SRC,
    text: 'Die Dame e7 deckt den Läufer b4 und greift den Bauern e5 an. Der Bauer e5 wird nun dreifach angegriffen (Sc6, Sg4, De7) und zweifach gedeckt (Lf4, Sf3).' },
  { v: I.TRAP, line: L.rub, at: 12, title: 'Weiß greift den Läufer an', source: TRAP_SRC,
    text: 'Der Bauer a3 greift den Läufer b4 an. Der Läufer steht ungedeckt von Bauern; er wird von der Dame e7 gedeckt.' },
  { v: I.TRAP, line: L.rub, at: 13, title: 'Das Opfer: …Sgxe5', best: ['Ngxe5'], source: TRAP_SRC,
    text: 'Der Springer g4 schlägt auf e5 und öffnet damit die e-Linie von der Dame e7 bis zum König e1. Weiß darf den Läufer b4 jetzt nicht ungeprüft nehmen.' },
  { v: I.TRAP, line: L.rub, at: 14, title: 'Nimmt Weiß den Läufer, folgt Matt', best: ['Nxe5', 'Bxe5'], threat: 'Nd3', blunder: 'axb4', source: TRAP_SRC,
    text: 'Schwarz droht Sd3 mit Doppelschach: Der Springer gibt Schach und die Dame e7 über die offene e-Linie ebenfalls. Der Zug axb4 gewinnt zwar einen Läufer, lässt die Drohung aber zu. Weiß hat bessere Züge: auf e5 zurückschlagen.' },
  { v: I.TRAP, line: L.rub, at: 15, title: 'Das erstickte Matt', best: ['Nd3'], source: TRAP_SRC,
    text: 'Sd3 ist Doppelschach. Dem König bleibt kein Feld: d1 und f1 sind durch eigene Figuren besetzt, f2 durch den eigenen Bauern, und e2 wird von der Dame e7 über die e-Linie angegriffen. Weiß ist matt.' },
  // --- Adler 4. Sf3
  { v: I.ADL, line: L.adl, at: 7, title: '4. Sf3: Adler-Variante', best: ['Nc6'],
    text: 'Weiß entwickelt den Springer und deckt e5 ein erstes Mal. Schwarz erhöht mit …Sc6 den Druck auf e5: Der Bauer wird nun von zwei Springern angegriffen.' },
  { v: I.ADL, line: L.adl, at: 8, title: 'Weiß deckt mit dem Läufer', best: ['Bf4'],
    text: 'Der Läufer f4 deckt e5 ein zweites Mal. Der Bauer e5 ist jetzt von Sf3 und Lf4 gedeckt, von Sg4 und Sc6 angegriffen.' },
  { v: I.ADL, line: L.adl, at: 11, title: '6. Sc3: Schwarz deckt den Läufer', best: ['Qe7'],
    text: 'Der Springer c3 steht neben dem Läufer b4. Die Dame e7 deckt den Läufer b4 und greift e5 an.' },
  { v: I.ADL, line: L.adl, at: 13, title: 'Der Bauer fällt', best: ['Ncxe5', 'Ngxe5'],
    text: 'Schwarz schlägt auf e5 und gleicht das Material aus: Beide Seiten haben danach sieben Bauern.' },
  // --- Aljechin 4. e4
  { v: I.ALE, line: L.ale, at: 7, title: '4. e4: Weiß baut ein Zentrum', best: ['Nxe5'],
    text: 'Der Bauer e4 stützt das Zentrum. Der Springer g4 schlägt auf e5 und gewinnt den Bauern zurück; er steht danach zentral.' },
  { v: I.ALE, line: L.ale, at: 9, title: 'Der Bauer a3 nimmt b4', best: ['g6', 'd6'],
    text: 'Der Bauer a3 verhindert …Lb4. Schwarz bereitet mit …g6 die Entwicklung des Läufers f8 vor oder spielt …d6.' },
  { v: I.ALE, line: L.ale, at: 11, title: 'Der Springer weicht', best: ['Nec6'],
    text: 'Der Bauer f4 greift den Springer e5 an. Der Springer e5 geht nach c6 und steht dort neben dem anderen Springer.' },
  { v: I.ALE, line: L.ale, at: 13, title: 'Ein Bauer deckt das Zentrum', best: ['d6'],
    text: 'Der Bauer d6 nimmt dem weißen Springer das Feld e5 und öffnet den Läufer c8.' },
  { v: I.ALE, line: L.ale, at: 15, title: 'Läufer auf die Diagonale', best: ['Bh6'],
    text: 'Der Läufer h6 greift den Bauern f4 an und entwickelt sich, ohne die Bauernstruktur am Königsflügel zu stören.' },
  // --- abgelehnt 3. d5
  { v: I.D5, line: L.d5, at: 5, title: '3. d5: Weiß lehnt ab', best: ['Bb4+'],
    text: 'Der Bauer d5 rückt vor, statt den Bauern e5 zu schlagen. Beide Seiten haben acht Bauern. Der Läufer b4 gibt Schach.' },
  { v: I.D5, line: L.d5, at: 7, title: 'Läufer d2: Tausch oder Ausweichen', best: ['a5'],
    text: 'Der Läufer d2 blockiert das Schach. Der Bauer a5 deckt den Läufer b4 mit einem Bauern.' },
  { v: I.D5, line: L.d5, at: 9, title: 'Springer nach a6 und c5', best: ['Na6', 'd6'],
    text: 'Der Springer a6 geht über c5 ins Zentrum; von c5 aus zielt er auf d3 und e4.' },
  // --- abgelehnt 3. e3
  { v: I.E3, line: L.e3, at: 5, title: '3. e3: Weiß lehnt ab', best: ['Bb4+', 'exd4'],
    text: 'Weiß verteidigt d4 mit dem Bauern e3. Schwarz hat zwei gute Wege: Schach mit dem Läufer b4 oder sofort …exd4.' },
  { v: I.E3, line: L.e3, at: 7, title: 'Läufertausch', best: ['Bxd2+'],
    text: 'Der Läufer d2 blockiert das Schach, Schwarz tauscht den Läufer b4 gegen ihn. Danach hat jede Seite einen Läufer weniger.' },
]

export const EXPLANATIONS_BUDAPEST: Explanation[] = buildExplanationsFor('budapest', SPECS)
