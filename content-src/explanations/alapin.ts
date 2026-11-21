import type { Explanation, Source } from '../../src/content/types.ts'
import { buildExplanationsFor } from '../builders.ts'
import { ch, mv, row, specsOf } from '../rows.ts'
import type { Row } from '../rows.ts'

const DOC5: Source = { kind: 'dokument', ref: 'docs/repertoire-v1.8.md, Abschnitt 5: Alapin-Variante' }

export const ALAPIN_ID = 'sicilian-defense-alapin-variation'
const A = ALAPIN_ID
const BAR = `${A}-barmen-defense`
const SMD = `${A}-smith-morra-declined`
const D5 = 'e4 c5 c3 d5 exd5 Qxd5 d4'
const NF = 'e4 c5 c3 Nf6 e5 Nd5 d4 cxd4'

export const ROWS: Row[] = [
  row(A, 'e4 c5', '2. c3: Zentrum mit Bauern auf e4 und d4',
    'Der Bauer c3 bereitet d4 vor: Weiß baut ein klassisches Zentrum mit Bauern auf e4 und d4. Laut Dokument ist das die „Clean Code“-Lösung, die dem Sizilianer die Schärfe nimmt.',
    [ch('Nach 1. e4 c5: Welcher Zug ist die Alapin-Variante?', '2. c3', ['2. d4', '2. Sf3']),
      ch('Was bereitet 2. c3 vor?', 'Den Zentrumsaufbau mit Bauern auf e4 und d4', ['Einen frühen Königsangriff', 'Den Damentausch'])],
    { source: DOC5 }),
  row(A, 'e4 c5 c3', 'Nach 2. c3: 2…d5 oder 2…Sf6',
    'Das Dokument nennt als Antworten 2…d5 oder 2…Sf6; beide greifen den Bauern e4 an. Die Engine zählt 2…Sf6 und 2…e5 zu den besten Zügen.',
    [ch('Welche zwei Antworten nennt das Dokument auf 2. c3?', '2…d5 oder 2…Sf6', ['2…e6 oder 2…g6', '2…d6 oder 2…Sc6']),
      ch('Welcher Bauernzug greift e4 sofort an?', '2…d5', ['2…e5', '2…d6'])],
    { best: ['Nf6'], source: DOC5 }),
  // --- 2…d5
  row(BAR, 'e4 c5 c3 d5', '2…d5: Weiß nimmt den Bauern',
    'Der Bauer d5 greift e4 an. 3. exd5 schlägt ihn; Weiß hat danach einen Bauern mehr (8 gegen 7), bis Schwarz zurücknimmt.',
    [mv('Wie beantwortest du 2…d5?', 'exd5'),
      ch('Wie viele Bauern hat Weiß nach 3. exd5?', 'Acht gegen sieben', ['Sieben gegen acht', 'Je acht'])],
    { best: ['exd5'] }),
  row(BAR, 'e4 c5 c3 d5 exd5', '3…Dxd5: die Dame im Zentrum',
    'Die Dame schlägt d5 und steht offen im Zentrum; der Springer b1 kann sie mit Sc3 angreifen.',
    [ch('Welche schwarze Figur schlägt in der Barmen-Verteidigung auf d5?', 'Die Dame', ['Der Springer', 'Der Läufer']),
      mv('Wie nimmt Schwarz den Bauern zurück?', 'Qxd5')],
    { best: ['Qxd5'] }),
  row(BAR, 'e4 c5 c3 d5 exd5 Qxd5', '4. d4: das Bauernzentrum',
    'Der Bauer d4 greift den Bauern c5 an. Die Engine zählt auch 4. Sf3 zu den besten Zügen.',
    [mv('Welcher Bauernzug greift c5 an?', 'd4'),
      ch('Welche weißen Bauern stehen nach 4. d4 im Zentrum?', 'c3 und d4', ['e4 und d4', 'b2 und c2'])],
    { best: ['d4', 'Nf3'] }),
  row(BAR, D5, 'Nach 4. d4: drei Wege für Schwarz',
    'Der Bauer d4 steht im Angriff des Bauern c5. Schwarz kann auf d4 schlagen, den Springer f6 entwickeln oder mit Sc6 den Bauern d4 angreifen; die Engine zählt alle drei zu den besten Zügen. Das Material ist gleich (7 gegen 7).',
    [mv('Welcher schwarze Zug schlägt den Bauern d4?', 'cxd4'),
      ch('Wie viele Bauern hat jede Seite nach 4. d4?', 'Je sieben', ['Je acht', 'Weiß acht, Schwarz sieben'])],
    { best: ['cxd4', 'Nf6'] }),
  row(`${A}-anti-alapin-gambit`, 'e4 c5 c3 d5 exd5 Nf6', '3…Sf6: Weiß hat einen Bauern mehr',
    'Schwarz verzichtet auf das Zurückschlagen; Weiß hat einen Bauern mehr (8 gegen 7). Schach mit Da4+ oder Lb5+ zwingt Schwarz zur Antwort.',
    [mv('Welcher Läuferzug gibt Schach?', 'Bb5+'),
      ch('Wie viele Bauern hat Weiß mehr?', 'Einen', ['Zwei', 'Keinen'])],
    { best: ['Qa4+', 'Bb5+'] }),
  row(`${BAR}-modern-line`, `${D5} Nf6 Nf3 Bg4`, 'Der Läufer g4 fesselt den Springer f3',
    'Der Läufer g4 fesselt den Springer f3 gegen die Dame d1. Das Material ist gleich (7 gegen 7). Die Engine zählt dxc5 und Le2 zu den besten Zügen; Le2 beendet die Fesselung.',
    [ch('Was fesselt der Läufer g4?', 'Den Springer f3 gegen die Dame d1', ['Den Springer f3 gegen den König', 'Den Bauern d4 gegen die Dame']),
      mv('Welcher Läuferzug beendet die Fesselung?', 'Be2')],
    { best: ['dxc5', 'Be2'] }),
  row(`${BAR}-central-exchange`, `${D5} cxd4 cxd4 Nc6 Nf3 Bg4`, 'Der isolierte Damenbauer d4',
    'Weiß hat auf der c- und der e-Linie keine Bauern mehr: der Bauer d4 ist ein isolierter Damenbauer. Das Material ist gleich (6 gegen 6). Sc3 greift die Dame d5 an.',
    [mv('Welcher Springerzug greift die Dame d5 an?', 'Nc3'),
      ch('Wie heißt ein Bauer ohne Nachbarbauern auf den Nebenlinien?', 'Isolierter Bauer', ['Rückständiger Bauer', 'Freibauer'])],
    { best: ['Nc3'] }),
  row(`${BAR}-milner-barry-attack`, `${D5} Nc6 Nf3 cxd4 cxd4 e5 Nc3 Bb4 Be2`, 'Milner-Barry: der Läufer b4 fesselt',
    'Der Läufer b4 fesselt den Springer c3 gegen den König e1. Das Material ist gleich (6 gegen 6).',
    [ch('Was fesselt der Läufer b4?', 'Den Springer c3 gegen den König e1', ['Den Springer c3 gegen die Dame d1', 'Den Bauern d4 gegen den König'])]),
  row(`${BAR}-endgame-variation`, `${D5} cxd4 cxd4 Nc6 Nf3 Bg4 Nc3 Bxf3 gxf3 Qxd4 Qxd4 Nxd4`, 'Endspielvariante: Damen getauscht',
    'Die Damen sind getauscht. Weiß hat einen Bauern weniger (5 gegen 6) und doppelte f-Bauern auf f2 und f3. Sb5 greift den Springer d4 an.',
    [mv('Welcher Springerzug greift den Springer d4 an?', 'Nb5'),
      ch('Welche Schwäche hat Weiß in der Bauernstruktur?', 'Doppelte f-Bauern', ['Doppelte c-Bauern', 'Einen Freibauern'])],
    { best: ['Nb5'] }),
  // --- 2…Sf6
  row(SMD, 'e4 c5 c3 Nf6', '2…Sf6: der Bauer e5 greift den Springer an',
    'Der Springer f6 greift den Bauern e4 an. 3. e5 greift ihn an und gewinnt Raum.',
    [mv('Welcher Bauernzug greift den Springer f6 an?', 'e5'),
      ch('Welchen Bauern greift der Springer f6 an?', 'e4', ['d4', 'c3'])],
    { best: ['e5'] }),
  row(SMD, 'e4 c5 c3 Nf6 e5', '3…Sd5: der Springer geht ins Zentrum',
    'Der Springer d5 steht im Zentrum und greift den Bauern c3 an. Die Engine nennt 3…Sd5 den besten Zug.',
    [mv('Wohin zieht der angegriffene Springer f6?', 'Nd5'),
      ch('Welchen weißen Bauern greift der Springer d5 an?', 'Den Bauern c3', ['Den Bauern e5', 'Den Bauern f2'])],
    { best: ['Nd5'] }),
  row(SMD, 'e4 c5 c3 Nf6 e5 Nd5', '4. d4 oder 4. Sf3',
    'Der Bauer c3 ist durch den Bauern b2 und den Springer b1 gedeckt. Weiß hat zwei gute Wege: 4. Sf3 entwickelt, 4. d4 baut das Zentrum.',
    [mv('Welcher Bauernzug baut das Zentrum aus?', 'd4'),
      ch('Wer deckt den Bauern c3?', 'Bauer b2 und Springer b1', ['Nur der König', 'Nur der Läufer f1'])],
    { best: ['Nf3', 'd4'] }),
  row(SMD, 'e4 c5 c3 Nf6 e5 Nd5 d4', 'Nach 4. d4: Schlagen oder halten',
    'Der Bauer d4 greift c5 an. 4…cxd4 schlägt ihn, 4…d6 greift den Bauern e5 an.',
    [mv('Welcher Zug schlägt den Bauern d4?', 'cxd4'),
      ch('Welchen Bauern greift 4…d6 an?', 'e5', ['d4', 'c3'])],
    { best: ['cxd4', 'd6'] }),
  row(SMD, NF, '4…cxd4: Weiß holt den Bauern zurück',
    'Weiß hat einen Bauern weniger (7 gegen 8). 5. cxd4 holt ihn zurück; es bleibt das Bauernzentrum d4 und e5.',
    [mv('Wie holst du den Bauern zurück?', 'cxd4'),
      ch('Wie viele Bauern hat Weiß vor dem Zurückschlagen?', 'Sieben', ['Acht', 'Sechs'])],
    { best: ['cxd4', 'Nf3'] }),
]

export const SPECS = specsOf(ROWS)
export const buildExplanations = (): Explanation[] => buildExplanationsFor('alapin', SPECS)
export const EXPLANATIONS_ALAPIN: Explanation[] = buildExplanations()
