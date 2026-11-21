import type { Explanation } from '../../src/content/types.ts'
import { buildExplanationsFor } from '../builders.ts'
import type { ExplSpec } from '../builders.ts'

export const KID_IDS = {
  C4: 'kings-indian-setup-vs-1-c4',
  NF3: 'kings-indian-setup-vs-1-nf3',
  S2NF3: 'kings-indian-setup-vs-1-d4-2-nf3',
  LON: 'kings-indian-setup-vs-london-2-bf4',
  G3: 'kings-indian-setup-vs-1-d4-2-g3',
}
const I = KID_IDS

export const KID_LINES = {
  c4: 'c4 g6 Nc3 Bg7 g3 d6 Bg2 Nf6 Nf3 O-O d4 c5 d5 Re8',
  nf3: 'Nf3 g6 g3 Bg7 Bg2 d6 O-O Nf6 c4 c5 d4 O-O d5 Re8',
  s2nf3: 'd4 Nf6 Nf3 g6 c4 Bg7 Nc3 O-O e4 d6 Be2 e5 O-O exd4 Nxd4 Re8',
  lon: 'd4 Nf6 Bf4 g6 e3 Bg7 Nf3 O-O Be2 d6 h3 b6',
  g3: 'd4 Nf6 g3 g6 Bg2 Bg7 Nf3 O-O O-O d6 c4 c5',
}
const L = KID_LINES
const BAUSTEIN = 'Deine Bausteine sind …g6, …Lg7, …d6 und …O-O.'

export const SPECS: ExplSpec[] = [
  // --- gegen 1. c4
  { v: I.C4, line: L.c4, at: 1, title: '1. c4: Weiß nimmt Raum',
    text: `Der Bauer c4 greift das Feld d5 an. Du baust ruhig auf, ohne dem weißen Aufbau nachzulaufen. ${BAUSTEIN}` },
  { v: I.C4, line: L.c4, at: 3, title: 'Der Läufer auf der langen Diagonale',
    text: 'Mit …Lg7 steht der Läufer auf der Diagonale h8–a1. Er zielt auf den Springer c3 und, wenn sich die Linie öffnet, auf das Feld b2.' },
  { v: I.C4, line: L.c4, at: 5, title: 'Der Bauer d6',
    text: 'Der Bauer d6 deckt e5 und c5 und öffnet dem Läufer c8 die Diagonale. Zugleich steht er auf einem Feld, auf dem später …e5 oder …c5 möglich ist.' },
  { v: I.C4, line: L.c4, at: 9, title: 'Rochade', best: ['O-O'],
    text: 'Die Rochade bringt den König nach g8 und den Turm nach f8. Der Läufer g7 ist danach der wichtigste Schutz des Königs.' },
  { v: I.C4, line: L.c4, at: 11, title: 'Gegenstoß gegen d4', best: ['c5'],
    text: 'Der Bauer c5 greift den Bauern d4 an. Das ist der Gegenstoß im Zentrum, den dein Aufbau vorbereitet hat.' },
  { v: I.C4, line: L.c4, at: 13, title: 'Der Turm auf die e-Linie', best: ['Re8'],
    text: 'Der Turm e8 steht auf der e-Linie. Er hält die e-Linie besetzt und unterstützt spätere Züge im Zentrum.' },
  // --- gegen 1. Sf3
  { v: I.NF3, line: L.nf3, at: 1, title: '1. Sf3: Weiß wartet ab',
    text: `Der Springer f3 deckt e5 und d4, ohne das Bauernzentrum festzulegen. Du antwortest mit demselben Aufbau. ${BAUSTEIN}` },
  { v: I.NF3, line: L.nf3, at: 3, title: 'Läufer auf die Diagonale', best: ['Bg7'],
    text: 'Der Läufer g7 steht auf der langen Diagonale h8–a1 und wartet dort auf die Öffnung des Zentrums.' },
  { v: I.NF3, line: L.nf3, at: 7, title: 'Springer nach f6', best: ['Nf6'],
    text: 'Der Springer f6 deckt d5 und h7 und kontrolliert e4. Mit Springer, Läufer und Bauern d6, g6 steht der Aufbau.' },
  { v: I.NF3, line: L.nf3, at: 9, title: 'Der Bauer c5', best: ['c5'],
    text: 'Der Bauer c5 greift das Feld d4 an, bevor Weiß seinen Bauern dorthin stellt.' },
  { v: I.NF3, line: L.nf3, at: 11, title: 'Rochade', best: ['O-O'],
    text: 'Beide Seiten haben ihre Leichtfiguren am Königsflügel entwickelt. Mit der Rochade ist dein König sicher.' },
  { v: I.NF3, line: L.nf3, at: 13, title: 'Turm auf die e-Linie', best: ['Re8'],
    text: 'Der Bauer d5 gewinnt Raum. Der Turm e8 besetzt die e-Linie.' },
  // --- gegen 1. d4 Sf6 2. Sf3
  { v: I.S2NF3, line: L.s2nf3, at: 3, title: '2. Sf3: der Aufbau beginnt',
    text: `Weiß entwickelt den Springer und hat das Zentrum noch nicht festgelegt. ${BAUSTEIN}` },
  { v: I.S2NF3, line: L.s2nf3, at: 5, title: 'Läufer g7', best: ['Bg7'],
    text: 'Der Bauer c4 greift d5 an. Der Läufer g7 geht auf die lange Diagonale.' },
  { v: I.S2NF3, line: L.s2nf3, at: 7, title: 'Rochade vor dem Zentrum', best: ['O-O'],
    text: 'Weiß hat Sc3 und c4 gespielt. Schwarz rochiert, bevor sich das Zentrum öffnet.' },
  { v: I.S2NF3, line: L.s2nf3, at: 9, title: 'Weiß hat e4 gespielt', best: ['d6'],
    text: 'Weiß hat die Bauern c4, d4 und e4 aufgestellt. Der Bauer d6 greift e5 vor und hält das Zentrum unter Kontrolle.' },
  { v: I.S2NF3, line: L.s2nf3, at: 11, title: 'Der Zentrumsstoß', best: ['e5'],
    text: 'Der Bauer e5 greift den Bauern d4 an. Das ist der klassische Gegenstoß des Königsindischen Aufbaus.' },
  { v: I.S2NF3, line: L.s2nf3, at: 13, title: 'Tausch auf d4', best: ['exd4'],
    text: 'Schwarz schlägt auf d4, danach nimmt der Springer zurück. Das Zentrum ist geklärt, der Läufer g7 hat die lange Diagonale.' },
  { v: I.S2NF3, line: L.s2nf3, at: 15, title: 'Turm gegen den Bauern e4', best: ['Re8'],
    text: 'Der Turm e8 greift den Bauern e4 an.' },
  // --- gegen London 2. Lf4
  { v: I.LON, line: L.lon, at: 3, title: '2. Lf4: Weiß setzt auf den Londoner Aufbau', best: ['g6'],
    text: 'Der Läufer f4 steht auf der Diagonale c1–h6 außerhalb der Bauernkette. Du bleibst bei deinem Aufbau.' },
  { v: I.LON, line: L.lon, at: 5, title: 'Läufer g7', best: ['Bg7'],
    text: 'Der Läufer g7 geht auf die lange Diagonale und zielt auf b2.' },
  { v: I.LON, line: L.lon, at: 7, title: 'Rochade', best: ['O-O'],
    text: 'Der König geht nach g8. Der Springer f3 deckt d4 und h4.' },
  { v: I.LON, line: L.lon, at: 9, title: 'Der Bauer d6',
    text: 'Der Bauer d6 bereitet …Sbd7 und …e5 oder …c5 vor.' },
  { v: I.LON, line: L.lon, at: 11, title: 'Läufer c8 auf die Diagonale', best: ['b6'],
    text: 'Der Bauer b6 bereitet …Lb7 vor; der Läufer b7 zielt dann über e4 auf den Königsflügel.' },
  // --- gegen 1. d4 Sf6 2. g3
  { v: I.G3, line: L.g3, at: 3, title: '2. g3: Weiß fianchettiert', best: ['g6'],
    text: `Weiß stellt den Läufer auf g2. Auch hier gilt dein Aufbau. ${BAUSTEIN}` },
  { v: I.G3, line: L.g3, at: 7, title: 'Rochade', best: ['O-O'],
    text: 'Beide Läufer stehen auf langen Diagonalen: Lg2 und Lg7 blicken sich an. Schwarz rochiert.' },
  { v: I.G3, line: L.g3, at: 9, title: 'Der Bauer d6',
    text: 'Der Bauer d6 deckt c5 und e5 und gibt dem Läufer c8 die Diagonale frei.' },
  { v: I.G3, line: L.g3, at: 11, title: 'Gegenstoß c5',
    text: 'Der Bauer c5 greift d4 an. Weiß hat die Bauern c4 und d4 im Zentrum.' },
]

export const EXPLANATIONS_KINGS_INDIAN: Explanation[] = buildExplanationsFor('kings-indian', SPECS)
