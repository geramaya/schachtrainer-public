import type { Explanation, Source } from '../../src/content/types.ts'
import { buildExplanationsFor } from '../builders.ts'
import type { ExplSpec } from '../builders.ts'

const MEMO: Source = { kind: 'dokument', ref: 'docs/repertoire-v1.8.md, Abschnitt 7: Schottisches Gambit, Jarvis-Memo' }

const BASE = 'e4 e5 Nf3 Nc6 d4'
const CL = `${BASE} exd4 Nxd4`
const GA = `${BASE} exd4 Bc4`
const QH = `${CL} Qh4`
const SC = `${CL} Bc5 Be3 Qf6 c3`

export const SPECS: ExplSpec[] = [
  // --- Schottische Partie (Wurzel)
  { v: 'scotch-game', line: 'e4 e5', at: 1, title: '1. e4: Zentrum und offene Linien',
    text: 'Der Bauer auf e4 kontrolliert die Felder d5 und f5. Zugleich öffnen sich Diagonalen für den Läufer f1 und die Dame d1. Beide Seiten haben danach noch alle Figuren auf der Grundreihe.' },
  { v: 'scotch-game', line: 'e4 e5 Nf3', at: 2, title: '1…e5: Schwarz spiegelt den Aufbau', best: ['Nf3'],
    text: 'Die Zentralbauern e4 und e5 stehen sich gegenüber, und beide sind noch ungedeckt. Weiß greift e5 mit der Entwicklung des Springers an: 2. Sf3.' },
  { v: 'scotch-game', line: BASE, at: 3, title: 'Nach 2. Sf3: der Gegner entscheidet', best: ['Nc6'],
    text: 'Schwarz verteidigt den Bauern e5 am natürlichsten mit 2…Sc6. Danach öffnet 3. d4 das Zentrum sofort.' },
  { v: 'scotch-game', line: BASE, at: 4, title: 'Die Idee: 3. d4', best: ['d4'],
    text: 'Der Bauer d4 greift e5 an und öffnet, wenn getauscht wird, Linien für die Figuren. Weiß fordert die Entscheidung im Zentrum früh.' },
  { v: 'scotch-game', line: BASE, at: 5, title: 'Schwarz nimmt auf d4', best: ['exd4'],
    text: 'Nach 3. d4 steht der Bauer e5 unter Druck, weil der Bauer d4 ihn angreift. Meist nimmt Schwarz auf d4; Weiß plant dann, die Figuren aktiv zu entwickeln.' },
  // --- Klassisch (Hauptlinie)
  { v: 'scotch-game-classical-variation', line: `${CL} Bc5`, at: 6, title: 'Hauptlinie: 4. Sxd4', best: ['Nxd4'],
    text: 'Weiß holt den Bauern mit dem Springer zurück; der Springer steht danach zentral auf d4. Das Schottische Gambit mit 4. Lc4 ist die andere Wahl am selben Punkt: Weiß gibt den Bauern d4 vorerst nicht zurück.' },
  { v: 'scotch-game-classical-variation', line: `${CL} Bc5`, at: 7, title: 'Schwarz wählt seine Antwort', best: ['Bc5', 'Nf6'],
    text: 'Hier verzweigt sich die Theorie. Dieses Repertoire kennt vier Antworten: Klassisch (4…Lc5), Schmidt (4…Sf6), Steinitz (4…Dh4) und Malaniuk (4…Lb4+). Die Engine zählt 4…Lc5 und 4…Sf6 zu den besten Zügen.' },
  { v: 'scotch-game-classical-variation', line: `${CL} Bc5`, at: 8, title: 'Klassisch: Gegen den Springer auf d4', best: ['Be3'],
    text: 'Der Läufer c5 zielt auf den Springer d4. Mit 5. Le3 entwickelt Weiß den Läufer und deckt den Springer.' },
  // --- Lolli
  { v: 'scotch-game-lolli-variation', line: `${BASE} Nxd4`, at: 6, title: '3…Sxd4: Abtausch im Zentrum', best: ['Nxd4'],
    text: 'Schwarz nimmt den Bauern d4 mit dem Springer. Weiß nimmt mit dem Springer zurück; er steht danach zentral auf d4.' },
  { v: 'scotch-game-lolli-variation', line: `${BASE} Nxd4 Nxd4`, at: 7, title: 'Nach 4. Sxd4: Schwarz nimmt zurück', best: ['exd4'],
    text: 'Schwarz hat den Bauern d4 gewonnen, Weiß den Springer. Mit …exd4 schlägt Schwarz nun auch den weißen Springer und steht danach einen Bauern vorn.' },
  { v: 'scotch-game-lolli-variation', line: `${BASE} Nxd4 Nxd4 exd4`, at: 8, title: 'Die Dame holt den Bauern zurück', best: ['Qxd4'],
    text: 'Mit Dxd4 gewinnt Weiß den Bauern zurück; das Material ist wieder gleich. Die Dame steht zentral und greift den Bauern g7 an.' },
  { v: 'scotch-game-lolli-variation', line: `${BASE} Nxd4 Nxd4 exd4 Qxd4`, at: 9, title: 'Material gleich, Dame zentral',
    text: 'Beide Seiten haben je einen Springer und einen Bauern verloren. Die weiße Dame auf d4 greift g7 an (gedeckt vom Läufer f8). Schwarz hat Läufer c8, Läufer f8 und Springer g8 noch nicht entwickelt.' },
  // --- Schottisches Gambit (Dokument)
  { v: 'scotch-game-scotch-gambit', line: GA, at: 7, title: 'Schottisches Gambit: Schock-Modus', best: ['Nf6'], source: MEMO,
    text: 'Züge: 1. e4 e5 2. Sf3 Sc6 3. d4 exd4 4. Lc4. Charakter: Maximaler Straßenkampf ab Sekunde zwei. Warum: Es reißt das Zentrum sofort auf und überfordert unvorbereitete Spieler durch hohen taktischen Druck. Jarvis-Memo: Achtung vor „Wissenden“, die den Angriff durch Züge wie …Sf6 und …d5 oder …Se6 neutralisieren können. Nur spielen, wenn man bereit für eine taktische Achterbahnfahrt ist.' },
  // --- Haxo, London, Advance, Sarratt, Vitzthum (Gambit-Unterlinien)
  { v: 'scotch-game-haxo-gambit', line: `${GA} Bc5`, at: 8, title: 'Haxo-Gambit: Was nun?', best: ['c3', 'Ng5'],
    text: 'Mit …Lc5 deckt Schwarz den vorgerückten Bauern d4. Weiß hat zwei Pläne: c3 greift den Bauern d4 an, und Sg5 richtet Springer und Läufer c4 gemeinsam auf f7, wo nur der König deckt.' },
  { v: 'scotch-game-scotch-gambit-london-defense', line: `${GA} Bb4+`, at: 8, title: 'London-Verteidigung: Schach auf b4', best: ['c3'],
    text: 'c3 beantwortet das Schach: Der Bauer greift den Läufer b4 und den Bauern d4 an.' },
  { v: 'scotch-game-scotch-gambit-advance-variation', line: `${GA} Nf6 e5`, at: 8, title: 'Nach 4…Sf6: Vorstoß', best: ['e5'],
    text: 'Weiß stößt mit dem Bauern e4 nach e5 und greift damit den Springer f6 an.' },
  { v: 'scotch-game-scotch-gambit-advance-variation', line: `${GA} Nf6 e5`, at: 9, title: 'Schwarz antwortet im Zentrum', best: ['d5'], source: MEMO,
    text: 'Das ist die Verteidigungsidee, vor der das Jarvis-Memo warnt: …d5 greift den Läufer c4 an.' },
  { v: 'scotch-game-scotch-gambit-sarratt-variation', line: `${GA} Bc5 Ng5`, at: 9, title: 'Sarratt: Sg5 gegen f7', best: ['Nh6'],
    text: 'Läufer c4 und Springer g5 zielen gemeinsam auf f7. Schwarz deckt f7 mit …Sh6, denn der Springer h6 greift f7.' },
  // --- Malaniuk, Schmidt, Steinitz, Horwitz
  { v: 'scotch-game-malaniuk-variation', line: `${CL} Bb4+`, at: 8, title: 'Malaniuk: Schach auf b4', best: ['c3'],
    text: 'Mit c3 beantwortet Weiß das Schach, greift den Läufer b4 an und deckt den Springer d4.' },
  { v: 'scotch-game-schmidt-variation', line: `${CL} Nf6`, at: 8, title: 'Schmidt: Springerabtausch auf c6', best: ['Nxc6'],
    text: 'Schwarz greift mit 4…Sf6 den ungedeckten Bauern e4 an. Weiß tauscht auf c6; Schwarz muss mit einem Bauern zurücknehmen und bekommt dadurch eine schwächere Bauernstruktur.' },
  { v: 'scotch-game-steinitz-variation', line: QH, at: 8, title: 'Steinitz: Dame gegen e4', best: ['Nc3'],
    text: 'Die schwarze Dame greift den Bauern e4 an. Weiß deckt ihn mit Sc3, der Springer entwickelt sich dabei. Die Alternative 5. Sb5 (Horwitz-Angriff) hat eine eigene Lektion.' },
  { v: 'scotch-game-horwitz-attack', line: `${QH} Nb5`, at: 9, title: 'Horwitz-Angriff: Drohung auf c7', best: ['Bb4+'], threat: 'Nxc7+',
    text: 'Der Springer b5 droht Sxc7+ mit Schach und Angriff auf den Turm a8. Schwarz muss diese Drohung beantworten.' },
  // --- Ghulam-Kassim
  { v: 'scotch-game-ghulam-kassim-variation', line: `${CL} Nxd4 Qxd4 d6 Bd3`, at: 8, title: 'Nach dem Abtausch auf d4', best: ['Qxd4'], blunder: 'Bc4',
    text: 'Schwarz hat den Springer auf d4 genommen. Weiß muss sofort zurücknehmen; ein anderer Zug lässt die Figur stehen und verliert Material.' },
  { v: 'scotch-game-ghulam-kassim-variation', line: `${CL} Nxd4 Qxd4 d6 Bd3`, at: 11, title: 'Die Dame steht aktiv im Zentrum', best: ['Nf6', 'c6'],
    text: 'Weiß hat mit Ld3 entwickelt. In dieser Stellung fehlen beiden Seiten noch mehrere Figuren; wer sie zügiger entwickelt, gewinnt Zeit.' },
  // --- Mieses
  { v: 'scotch-game-mieses-variation', line: `${CL} Nf6 Nxc6 bxc6 e5`, at: 9, title: 'Mieses: nach 5. Sxc6', blunder: 'Nxe4',
    text: 'Schwarz muss auf c6 zurücknehmen. Wer stattdessen den Bauern e4 schlägt, übersieht die Drohung gegen die Dame: Sxc6 greift Dd8.' },
  { v: 'scotch-game-mieses-variation', line: `${CL} Nf6 Nxc6 bxc6 e5`, at: 10, title: 'Mieses: Vorstoß mit e5', best: ['e5'],
    text: 'Schwarz hat jetzt Doppelbauern auf der c-Linie. Der Vorstoß e5 greift den Springer f6 an und vertreibt ihn.' },
  { v: 'scotch-game-mieses-variation', line: `${CL} Nf6 Nxc6 bxc6 e5`, at: 11, title: 'Mieses: Schwarz reagiert', best: ['Qe7'],
    text: 'Die Dame greift den Bauern e5 an und deckt zugleich den angegriffenen Springer f6.' },
  // --- Millennium / Blackburne
  { v: 'scotch-game-classical-variation-millennium-variation', line: `${SC} Qg6`, at: 9, title: 'Nach 5. Le3: Angriff auf den Springer', best: ['Qf6'],
    text: 'Le3 deckt den Springer d4 und entwickelt den Läufer. Schwarz zieht die Dame nach f6; sie greift den Springer d4 und den Bauern f2 an.' },
  { v: 'scotch-game-classical-variation-millennium-variation', line: `${SC} Qg6`, at: 10, title: 'Weiß stützt den Springer', best: ['c3'],
    text: 'Mit c3 deckt Weiß den Springer d4 zusätzlich mit einem Bauern.' },
  { v: 'scotch-game-classical-variation-millennium-variation', line: `${SC} Qg6`, at: 11, title: 'Schwarz: Springer oder Dame', best: ['Nge7', 'Qg6'],
    text: 'Zwei Wege: …Sge7 entwickelt den Springer (Blackburne-Angriff), …Dg6 zieht die Dame nach g6 (Millennium) und greift den Bauern e4 an.' },
  { v: 'scotch-game-classical-variation-millennium-variation', line: `${SC} Qg6`, at: 12, title: 'Millennium: Dame gegen e4', best: ['Qe2'],
    text: 'Die Dame auf g6 greift den Bauern e4 an. Qe2 gehört nach der Engine zu den besten Zügen in dieser Stellung.' },
  { v: 'scotch-game-classical-variation-blackburne-attack', line: `${SC} Nge7 Qd2`, at: 12, title: 'Blackburne: Dd2 deckt, sperrt aber den Sb1',
    text: 'Weiß fehlen noch Sb1, Lf1 und die Rochade. Der Theoriezug Dd2 deckt zusätzlich Le3 und Sd4, nimmt dem Sb1 aber die Felder c3 (eigener Bauer) und d2: ihm bleibt nur Sa3. Die Türme sind danach noch nicht verbunden, weil Sb1 und König zwischen ihnen stehen. Die Engine-Erstwahl kann abweichen.' },
  { v: 'scotch-game-classical-variation-blackburne-attack', line: `${SC} Nge7 Qd2`, at: 13, title: 'Blackburne: Schwarz greift im Zentrum an', best: ['d5'],
    text: 'Mit …d5 greift Schwarz den Bauern e4 an und öffnet den Läufer c8.' },
  // --- Horwitz / Blackburne
  { v: 'scotch-game-horwitz-attack-blackburne-variation', line: `${QH} Nb5 Bb4+ Bd2 Qxe4+ Be2 Kd8 O-O Bxd2 Qxd2`, at: 10, title: 'Schach auf b4 und Läuferzug', best: ['Bd2'],
    text: 'Weiß blockt das Schach mit dem Läufer d2, der den schwarzen Läufer b4 angreift. Der Springer b5 bleibt dabei stehen.' },
  { v: 'scotch-game-horwitz-attack-blackburne-variation', line: `${QH} Nb5 Bb4+ Bd2 Qxe4+ Be2 Kd8 O-O Bxd2 Qxd2`, at: 11, title: 'Schwarz nimmt den Bauern mit Schach', best: ['Qxe4+'],
    text: 'Schwarz schlägt den Bauern e4 mit Schach und hat danach einen Bauern mehr.' },
  { v: 'scotch-game-horwitz-attack-blackburne-variation', line: `${QH} Nb5 Bb4+ Bd2 Qxe4+ Be2 Kd8 O-O Bxd2 Qxd2`, at: 12, title: 'Das Schach beantworten', best: ['Be2'],
    text: 'Be2 blockt das Schach auf der e-Linie.' },
  { v: 'scotch-game-horwitz-attack-blackburne-variation', line: `${QH} Nb5 Bb4+ Bd2 Qxe4+ Be2 Kd8 O-O Bxd2 Qxd2`, at: 14, title: 'Rochade statt Hast', best: ['O-O'],
    text: 'Der schwarze König kann nicht mehr rochieren; Weiß bringt den eigenen König in Sicherheit und entwickelt weiter.' },
  { v: 'scotch-game-horwitz-attack-blackburne-variation', line: `${QH} Nb5 Bb4+ Bd2 Qxe4+ Be2 Kd8 O-O Bxd2 Qxd2`, at: 17, title: 'Stellung nach dem Abtausch', best: ['a6'],
    text: 'Die Läufer sind getauscht. Schwarz hat einen Bauern mehr, doch sein König steht auf d8 und hat das Rochaderecht verloren; Weiß hat bereits rochiert.' },
]

export const buildExplanations = (specs: ExplSpec[] = SPECS): Explanation[] => buildExplanationsFor('scotch', specs)

export const EXPLANATIONS_SCOTCH: Explanation[] = buildExplanations()
