import type { Explanation, Source } from '../../src/content/types.ts'
import { buildExplanationsFor } from '../builders.ts'
import type { ExplSpec } from '../builders.ts'

const P = 'tarrasch-defense'
export const TARRASCH_IDS = {
  R: P,
  TWO: `${P}-two-knights-variation`,
  RUBS: `${P}-rubinstein-system`,
  CLA: `${P}-classical-variation`,
  CLAM: `${P}-classical-variation-main-line`,
  SCH: `${P}-schara-gambit`,
  HEN: `${P}-von-hennig-gambit`,
  MAR: `${P}-marshall-gambit`,
  SYM: `${P}-symmetrical-variation`,
}
const I = TARRASCH_IDS
const PRE = 'd4 d5 c4 e6 Nc3 c5'
const MAIN = `${PRE} cxd5 exd5 Nf3 Nc6 g3 Nf6 Bg2 Be7 O-O O-O Bg5 cxd4 Nxd4 h6 Be3 Re8`

export const TARRASCH_LINES = {
  root: PRE,
  main: MAIN,
  sch: `${PRE} cxd5 cxd4`,
  hen: `${PRE} cxd5 cxd4 Qxd4 Nc6 Qd1 exd5`,
  mar: `${PRE} cxd5 exd5 e4 dxe4`,
  sym: `${PRE} e3 Nf6 Nf3 Nc6`,
  dev1: 'd4 d5 c4 e6 Nf3',
  dev2: 'd4 d5 c4 e6 e3',
}
const L = TARRASCH_LINES

const DOC6: Source = { kind: 'dokument', ref: 'docs/repertoire-v1.8.md, Abschnitt 6: Tarrasch-Verteidigung (Option C, aktiv)' }
/** The document names no reply to 3. Sf3 / 3. e3: the answer is the engine best move (assumption, see report). */
export const TARRASCH_DEV_SRC: Source = { kind: 'stockfish', ref: 'Tiefe 16 (Vorabprüfung), Bau prüft Tiefe 18; das Dokument nennt für diesen Weißzug keine Antwort' }

export const SPECS: ExplSpec[] = [
  // --- Wurzel 1. d4 d5 2. c4 e6 3. Sc3 c5
  // 1. d4 is explained in the Budapest content (validate.ts demands one explanation per position, builders.ts finds by key)
  { v: I.R, line: L.root, at: 2, title: '1…d5: das Damengambit', best: ['c4'],
    text: 'Der Bauer c4 greift den Bauern d5 an. Die Engine zählt 2. c4 zu den besten Zügen.' },
  { v: I.R, line: L.root, at: 3, title: '2. c4: der Bauer e6', best: ['e6', 'c6'],
    text: 'Der Bauer e6 deckt den Bauern d5 und öffnet dem Läufer f8 die Diagonale. Dafür sperrt er die Diagonale des Läufers c8.' },
  { v: I.R, line: L.root, at: 4, title: 'Weiß entwickelt den Springer', best: ['Nc3', 'Nf3'],
    text: 'Der Springer c3 greift den Bauern d5 an. Die Engine zählt 3. Sc3 und 3. Sf3 zu den besten Zügen.' },
  { v: I.R, line: L.root, at: 5, title: '3. Sc3: …c5, die Tarrasch-Verteidigung', best: ['Nf6', 'Bb4'], source: DOC6,
    text: 'Der Bauer d5 wird vom Bauern c4 und vom Springer c3 angegriffen und von Dame d8 und Bauer e6 gedeckt. Die Engine zählt 3…Sf6 und 3…Lb4 zu den besten Zügen. Dein Dokument wählt 3…c5 (Option C, aktiv): Du nimmst später einen isolierten Bauern in Kauf, damit die Figuren maximale Freiheit haben.' },
  { v: I.R, line: L.root, at: 6, title: '3…c5: der Bauer greift d4 an', best: ['cxd5'], source: DOC6,
    text: 'Der Bauer c5 greift den Bauern d4 an; d4 ist nur von der Dame d1 gedeckt. Die Engine zählt 4. cxd5 zu den besten Zügen. Danach entscheidet sich, ob du auf d5 mit dem Bauern e6 zurückschlägst.' },

  // --- Zwei Springer 4. cxd5 exd5 5. Sf3
  { v: I.TWO, line: L.main, at: 7, title: '4. cxd5: Schwarz schlägt zurück', best: ['exd5', 'cxd4'],
    text: 'Weiß hat auf d5 geschlagen. Schwarz hat zwei gute Wege: …exd5 (Hauptlinie, mit dem späteren isolierten Bauern) oder …cxd4 (Schara-Gambit). Die Engine zählt beide zu den besten Zügen.' },
  { v: I.TWO, line: L.main, at: 8, title: '4…exd5: die Bauernstruktur', best: ['Nf3'],
    text: 'Beide Seiten haben sieben Bauern. Der Bauer c5 greift d4 an und ist vom Läufer f8 gedeckt; der Bauer d5 wird vom Springer c3 angegriffen und von der Dame d8 gedeckt. Die Engine zählt 5. Sf3 zu den besten Zügen.' },
  { v: I.TWO, line: L.main, at: 9, title: '5. Sf3: Schwarz entwickelt', best: ['Nc6', 'Nf6'],
    text: 'Der Bauer d4 wird vom Bauern c5 angegriffen und von Springer f3 und Dame d1 gedeckt. Mit …Sc6 greift Schwarz d4 ein zweites Mal an.' },

  // --- Rubinstein-System 6. g3
  { v: I.RUBS, line: L.main, at: 10, title: '5…Sc6: zwei gegen zwei auf d4', best: ['g3', 'dxc5'],
    text: 'Der Bauer d4 wird vom Bauern c5 und vom Springer c6 angegriffen und vom Springer f3 und der Dame d1 gedeckt. Weiß hat zwei Hauptwege: 6. g3 (Rubinstein-System) und 6. dxc5.' },
  { v: I.RUBS, line: L.main, at: 11, title: '6. g3: der Läufer geht nach g2', best: ['Nf6'],
    text: 'Der Bauer g3 bereitet das Läufer-Fianchetto auf g2 vor. Der Läufer wird auf der Diagonale h1-a8 den Bauern d5 ins Visier nehmen, sobald der Springer f3 weicht.' },
  { v: I.RUBS, line: L.main, at: 12, title: '6…Sf6: der Bauer d5 ist gedeckt', best: ['Bg2'],
    text: 'Der Bauer d5 wird vom Springer c3 angegriffen und von Dame d8 und Springer f6 gedeckt. Die Engine zählt 7. Lg2 zu den besten Zügen.' },

  // --- Klassische Variante 7. Lg2 Le7 8. O-O O-O
  { v: I.CLA, line: L.main, at: 13, title: '7. Lg2: Schwarz entwickelt den Läufer', best: ['cxd4', 'Be7'],
    text: 'Der Läufer g2 steht hinter dem Springer f3. Schwarz entwickelt den Läufer f8 nach e7 (Prager Hauptlinie) und bereitet die Rochade vor; die Engine zählt 7…Le7 und 7…cxd4 zu den besten Zügen.' },
  { v: I.CLA, line: L.main, at: 14, title: '7…Le7: Weiß rochiert', best: ['O-O', 'dxc5'],
    text: 'Mit 8. O-O kommt der König in Sicherheit und der Turm nach f1. Die Engine zählt 8. O-O und 8. dxc5 zu den besten Zügen.' },
  { v: I.CLA, line: L.main, at: 15, title: '8. O-O: auch Schwarz rochiert', best: ['O-O', 'c4'],
    text: 'Weiß hat rochiert, Schwarz rochiert ebenfalls. Der Bauer c5 greift den Bauern d4 an. Die Engine zählt …O-O und …c4 zu den besten Zügen.' },

  // --- Hauptlinie 9. Lg5 cxd4 10. Sxd4 h6 11. Le3 Te8
  { v: I.CLAM, line: L.main, at: 17, title: '9. Lg5: der Springer f6 wird angegriffen', best: ['cxd4', 'c4'],
    text: 'Der Läufer g5 greift den Springer f6 an; er ist vom Läufer e7 und vom Bauern g7 gedeckt. Schwarz schlägt auf d4 und öffnet die c-Linie.' },
  { v: I.CLAM, line: L.main, at: 19, title: 'Der isolierte Bauer d5', best: ['h6', 'Re8'],
    text: 'Beide Seiten haben sechs Bauern. Der Bauer d5 ist isoliert: Auf der c- und der e-Linie steht kein schwarzer Bauer. Dafür ist die c-Linie ohne Bauern, die e-Linie ist für Schwarz halboffen, und der Bauer d5 wird zweimal gedeckt (Dame d8, Springer f6) und zweimal angegriffen (Springer c3, Läufer g2). Das Feld vor dem Bauern, d4, besetzt ein weißer Springer.' },
  { v: I.CLAM, line: L.main, at: 20, title: '10…h6: der Läufer muss weichen', best: ['Be3'],
    text: 'Der Bauer h6 greift den Läufer g5 an. Die Engine zählt 11. Le3 zu den besten Zügen; der Läufer deckt dort den Springer d4.' },
  { v: I.CLAM, line: L.main, at: 21, title: '11. Le3: Figuren auf die offenen Linien', best: ['Bg4', 'Re8'],
    text: 'Die e-Linie ist für Schwarz halboffen, weil der schwarze Bauer e fehlt und der weiße Bauer e2 bleibt. Der Turm e8 besetzt die Linie hinter dem Läufer e7. Der Springer d4 ist von Läufer e3 und Dame d1 gedeckt und wird vom Springer c6 angegriffen.' },

  // --- kleine Varianten
  { v: I.MAR, line: L.mar, at: 9, title: '5. e4: das Marshall-Gambit', best: ['dxe4'],
    text: 'Der Bauer e4 greift den Bauern d5 an. Der Bauer d5 wird vom Bauern e4 und vom Springer c3 angegriffen und nur von der Dame d8 gedeckt. Nach …dxe4 hat Schwarz einen Bauern mehr (sieben gegen sechs).' },
  { v: I.SYM, line: L.sym, at: 7, title: '4. e3: die symmetrische Variante', best: ['Nf6', 'Nc6'],
    text: 'Der Bauer e3 stützt d4: Der Bauer d4 wird nun von Bauer e3 und Dame d1 gedeckt und vom Bauern c5 angegriffen. Schwarz entwickelt die Springer.' },
]

export const EXPLANATIONS_TARRASCH: Explanation[] = buildExplanationsFor('tarrasch', SPECS)
