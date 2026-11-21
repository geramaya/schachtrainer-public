import type { Explanation, Source } from '../../src/content/types.ts'
import { buildExplanationsFor } from '../builders.ts'
import type { ExplSpec } from '../builders.ts'

const P = 'nimzo-indian-defense'
export const NIMZO_IDS = {
  R: P,
  RUB: `${P}-rubinstein-system`,
  CLA: `${P}-classical-variation`,
  SAM: `${P}-samisch-variation`,
  KM: `${P}-kmoch-variation`,
  KER: `${P}-samisch-variation-keres-variation`,
  TK: `${P}-three-knights-variation`,
  LEN: `${P}-leningrad-variation`,
  SPI: `${P}-spielmann-variation`,
}
const I = NIMZO_IDS
const PRE = 'd4 Nf6 c4 e6 Nc3 Bb4'

export const NIMZO_LINES = {
  root: PRE,
  rub: `${PRE} e3 O-O Bd3 d5 Nf3 c5 O-O Nc6 a3 Bxc3 bxc3 dxc4 Bxc4`,
  cla: `${PRE} Qc2 d5 a3 Bxc3 Qxc3 Ne4 Qc2 c5`,
  sam: `${PRE} a3 Bxc3 bxc3 c5 e3 b6`,
  km: `${PRE} f3 d5 a3 Bxc3 bxc3 c5 cxd5 Nxd5 dxc5 f5`,
  tk: `${PRE} Nf3 c5 g3 cxd4 Nxd4 O-O Bg2 d5 cxd5 Nxd5`,
  len: `${PRE} Bg5 h6 Bh4 c5`,
  spi: `${PRE} Qb3 c5 dxc5 Nc6`,
  dev1: 'd4 Nf6 c4 e6 Nf3',
  dev2: 'd4 Nf6 c4 e6 g3',
}
const L = NIMZO_LINES

const DOC6: Source = { kind: 'dokument', ref: 'docs/repertoire-v1.8.md, Abschnitt 6: Nimzo-Indisch (Option B, stabil)' }
/** The document names no reply to 3. Sf3 / 3. g3: the answer is the engine best move (assumption, see report). */
export const NIMZO_DEV_SRC: Source = { kind: 'stockfish', ref: 'Tiefe 16 (Vorabprüfung), Bau prüft Tiefe 18; das Dokument nennt für diesen Weißzug keine Antwort' }

export const SPECS: ExplSpec[] = [
  // --- Wurzel 1. d4 Sf6 2. c4 e6 3. Sc3 Lb4
  // 1. d4, 1…Sf6 and 2. c4 are explained in the Budapest content (validate.ts demands one explanation per position, builders.ts finds by key)
  { v: I.R, line: L.root, at: 4, title: 'Weiß entwickelt den Springer', best: ['Nc3'],
    text: 'Der Springer c3 kontrolliert e4 und d5 und bereitet den Zentrumsvorstoß e2-e4 vor. Genau diesen Vorstoß will das Nimzo-Indische bremsen.' },
  { v: I.R, line: L.root, at: 5, title: '3. Sc3: Der Läufer fesselt', best: ['Bb4'], source: DOC6,
    text: 'Der Läufer b4 fesselt den Springer c3 gegen den König e1, weil das Feld d2 frei ist. Der Springer f6 überwacht e4. Das Motto aus deinem Dokument: Fesselung statt Bauernstruktur.' },
  { v: I.R, line: L.root, at: 6, title: 'Die Fesselung: Weiß wählt', source: DOC6,
    text: 'Weiß hat fünf übliche Antworten: 4. e3 (Rubinstein), 4. Dc2 (Klassisch), 4. a3 (Sämisch), 4. Sf3 (Drei Springer) und 4. f3 (Kmoch). Jede Variante zeigt deine Antwort darauf.' },

  // --- Rubinstein 4. e3
  { v: I.RUB, line: L.rub, at: 7, title: '4. e3: das Rubinstein-System', best: ['O-O', 'c5'],
    text: 'Der Bauer e3 stützt d4 und öffnet dem Läufer f1 die Diagonale; die Diagonale des Läufers c1 ist dadurch blockiert. Schwarz rochiert zuerst oder greift mit …c5 sofort das Zentrum an. Die Engine zählt beide zu den besten Zügen.' },
  { v: I.RUB, line: L.rub, at: 9, title: '5. Ld3: Weiß entwickelt kompakt', best: ['d5', 'c5'],
    text: 'Der Läufer d3 zielt über e4, f5 und g6 auf h7. Schwarz hat zwei Aufbaupläne: …d5 setzt ein eigenes Zentrum, …c5 greift den Bauern d4 an.' },
  { v: I.RUB, line: L.rub, at: 11, title: '6. Sf3: …c5 gegen das Zentrum', best: ['c5', 'b6'],
    text: 'Der Bauer d4 ist zweimal gedeckt (Bauer e3, Springer f3). Der Bauer d5 wird vom Bauern c4 und vom Springer c3 angegriffen (der Springer ist gefesselt) und von Dame d8, Bauer e6 und Springer f6 gedeckt. Mit …c5 greift Schwarz die Mitte an.' },
  { v: I.RUB, line: L.rub, at: 15, title: '8. a3: die Frage an den Läufer', best: ['Bxc3'],
    text: 'Der Bauer a3 greift den Läufer b4 an. Schwarz tauscht ihn gegen den Springer. Schlägt Weiß mit dem Bauern b2 zurück, stehen zwei weiße Bauern auf der c-Linie.' },
  { v: I.RUB, line: L.rub, at: 17, title: 'Doppelbauern auf der c-Linie',
    text: 'Weiß hat Doppelbauern auf c3 und c4, keinen Bauern auf der b-Linie und einen isolierten Bauern auf a3. Dafür besitzt Weiß das Läuferpaar (c1 und d3). Der Bauer d4 wird von c5 und Sc6 angegriffen und von c3, e3 und Sf3 gedeckt.' },
  { v: I.RUB, line: L.rub, at: 18, title: '9…dxc4: der Bauer greift den Läufer an', best: ['Bxc4'],
    text: 'Der schwarze Bauer c4 greift den Läufer d3 an; der Läufer ist von der Dame d1 gedeckt. Weiß schlägt den Bauern zurück. Danach haben beide Seiten sieben Bauern.' },
  { v: I.RUB, line: L.rub, at: 19, title: '10. Lxc4: die Dame deckt den Springer', best: ['Qc7'],
    text: 'Die Dame c7 deckt den Springer c6 und zielt über d6, e5, f4 und g3 auf den Bauern h2. Die Schwächen von Weiß bleiben der Doppelbauer auf der c-Linie und der isolierte Bauer a3.' },

  // --- Klassisch 4. Dc2
  { v: I.CLA, line: L.cla, at: 7, title: '4. Dc2: die Dame deckt den Springer', best: ['d5'],
    text: 'Die Dame c2 deckt den Springer c3 und kontrolliert e4. Nach …Lxc3 kann Weiß mit der Dame zurückschlagen und behält seine Bauernstruktur. Die Engine zählt 4…d5 zu den besten Zügen.' },
  { v: I.CLA, line: L.cla, at: 8, title: '4…d5: der Bauer greift c4 an', best: ['a3'],
    text: 'Der Bauer d5 greift den Bauern c4 an und besetzt das Zentrum. Die Engine zählt 5. a3 zu den besten Zügen: Der Bauer a3 greift den Läufer b4 an.' },
  { v: I.CLA, line: L.cla, at: 9, title: '5. a3: Der Läufer muss sich entscheiden', best: ['Bxc3'],
    text: 'Der Läufer b4 steht angegriffen. Schwarz tauscht ihn gegen den Springer c3. Schlägt Weiß mit der Dame zurück, bleibt seine Bauernstruktur heil.' },
  { v: I.CLA, line: L.cla, at: 11, title: '6. Dxc3: die Dame steht auf c3', best: ['O-O', 'dxc4'],
    text: 'Weiß hat das Läuferpaar. Mit …Se4 würde der Springer die Dame c3 angreifen. Die Engine zählt sofort …O-O und …dxc4 zu den besten Zügen.' },
  { v: I.CLA, line: L.cla, at: 12, title: '6…Se4: die Dame wird angegriffen', best: ['Qc2'],
    text: 'Der Springer e4 greift die Dame c3 an und ist vom Bauern d5 gedeckt. Die Dame weicht nach c2 und greift den Springer e4 an.' },
  { v: I.CLA, line: L.cla, at: 13, title: '7. Dc2: …c5 gegen d4', best: ['c5'],
    text: 'Der Bauer d4 hat nach 7. Dc2 keine Deckung. Der Bauer c5 greift ihn an und öffnet die c-Linie.' },

  // --- Sämisch 4. a3
  { v: I.SAM, line: L.sam, at: 7, title: '4. a3: die Frage an den Läufer', best: ['Bxc3'],
    text: 'Der Bauer a3 greift den Läufer b4 an. Schwarz tauscht sofort. Weiß schlägt dann meist mit dem Bauern b2 zurück: Die c-Bauern verdoppeln sich, dafür bekommt Weiß das Läuferpaar.' },
  { v: I.SAM, line: L.sam, at: 9, title: '5. bxc3: Doppelbauern', best: ['c5'],
    text: 'Weiß hat Doppelbauern auf c3 und c4; beide sind von keiner Figur gedeckt. Weiß besitzt das Läuferpaar. Schwarz setzt den Bauern c4 mit …c5 und …b6 unter Druck.' },
  { v: I.SAM, line: L.sam, at: 10, title: '5…c5: der Bauer d4 wird angegriffen', best: ['e3'],
    text: 'Der Bauer d4 wird vom Bauern c5 angegriffen und vom Bauern c3 und der Dame d1 gedeckt. Die Engine zählt 6. e3 zu den besten Zügen: Der Bauer e3 stützt d4 und öffnet den Läufer f1.' },
  { v: I.SAM, line: L.sam, at: 11, title: '6. e3: der Läufer geht nach b7', best: ['b6'],
    text: 'Mit …b6 bereitet Schwarz den Läufer b7 vor, der auf den Königsflügel zielt. Anschließend kommt …Sc6 gegen d4, später …Sa5 gegen den Bauern c4.' },

  // --- Kmoch 4. f3
  { v: I.KM, line: L.km, at: 7, title: '4. f3: der Bauer deckt e4', best: ['d5', 'c5'],
    text: 'Der Bauer f3 deckt e4 und bereitet e2-e4 vor. Er nimmt dem Springer g1 das Feld f3. Schwarz reagiert mit …d5 oder …c5; die Engine zählt beide zu den besten Zügen.' },
  { v: I.KM, line: L.km, at: 8, title: '4…d5: Weiß fragt den Läufer', best: ['a3'],
    text: 'Der Bauer d5 greift den Bauern c4 an. Die Engine zählt 5. a3 zu den besten Zügen: Der Bauer a3 greift den Läufer b4 an.' },
  { v: I.KM, line: L.km, at: 9, title: '5. a3: Tausch auf c3', best: ['Bxc3'],
    text: 'Schwarz gibt den Läufer für den Springer c3. Nach bxc3 hat Weiß Doppelbauern auf der c-Linie und das Läuferpaar, der Bauer f3 hat dem Springer g1 aber das Feld f3 genommen.' },
  // --- Keres-Variante: 6. bxc3 c5 7. cxd5 Sxd5 8. dxc5
  { v: I.KER, line: L.km, at: 11, title: '6. bxc3: …c5 gegen das Zentrum', best: ['c5', 'O-O'],
    text: 'Weiß hat Doppelbauern auf der c-Linie. Schwarz greift das Zentrum mit …c5 an. Die Engine zählt …c5 und …O-O zu den besten Zügen.' },
  { v: I.KER, line: L.km, at: 13, title: '7. cxd5: Schwarz holt den Bauern zurück', best: ['exd5', 'Nxd5'],
    text: 'Weiß hat auf d5 geschlagen. Mit …Sxd5 gerät der Springer ins Zentrum und greift den Bauern c3 an; mit …exd5 entsteht ein anderes Bauerngerüst.' },
  { v: I.KER, line: L.km, at: 14, title: '7…Sxd5: der Bauer c5 hängt', best: ['dxc5'],
    text: 'Der Bauer c5 wird vom Bauern d4 angegriffen und ist ungedeckt. Der Bauer c3 wird vom Springer d5 angegriffen und ist ebenfalls ungedeckt. Beide Seiten haben sieben Bauern.' },
  { v: I.KER, line: L.km, at: 15, title: '8. dxc5: Schwarz sucht Gegenspiel', best: ['Qa5', 'f5'],
    text: 'Weiß hat einen Bauern mehr (sieben gegen sechs). Die Dame a5 würde die Bauern c3 und c5 angreifen. Schwarz holt sich Gegenspiel mit …Da5 oder …f5.' },

  // --- Drei Springer 4. Sf3
  { v: I.TK, line: L.tk, at: 7, title: '4. Sf3: der Springer deckt d4', best: ['O-O'],
    text: 'Der Springer f3 deckt d4 und e5. Der Läufer c1 hat seine Diagonale noch frei, weil e3 nicht gespielt ist. Die Engine zählt 4…O-O zu den besten Zügen.' },
  { v: I.TK, line: L.tk, at: 8, title: '4…c5: Weiß wählt den Fianchetto-Plan', best: ['g3'],
    text: 'Der Bauer c5 greift den Bauern d4 an. Mit g3 bereitet Weiß das Läufer-Fianchetto auf g2 vor.' },
  { v: I.TK, line: L.tk, at: 10, title: '5…cxd4: der Springer schlägt zurück', best: ['Nxd4'],
    text: 'Schwarz hat auf d4 geschlagen; Weiß schlägt mit dem Springer zurück. Danach haben beide Seiten sieben Bauern.' },
  { v: I.TK, line: L.tk, at: 11, title: '6. Sxd4: …O-O oder …Se4', best: ['O-O', 'Ne4'],
    text: 'Der Springer c3 bleibt gefesselt, solange d2 frei ist. Der Springer d4 ist nur von der Dame d1 gedeckt. Mit …Se4 würde Schwarz den gefesselten Springer c3 zusätzlich angreifen.' },
  { v: I.TK, line: L.tk, at: 13, title: '7. Lg2: …d5 gegen c4', best: ['d5'],
    text: 'Mit …d5 greift Schwarz den Bauern c4 an und besetzt das Zentrum. Ein Tausch auf d5 öffnet die Linien für die Läufer.' },
  { v: I.TK, line: L.tk, at: 15, title: '8. cxd5: Schwarz holt den Bauern zurück', best: ['Nxd5'],
    text: 'Der weiße Bauer d5 wird von Dame d8, Bauer e6 und Springer f6 angegriffen und von Springer c3 und Läufer g2 gedeckt. Weiß hat einen Bauern mehr (sieben gegen sechs), bis Schwarz zurückschlägt.' },
  { v: I.TK, line: L.tk, at: 16, title: '8…Sxd5: der gefesselte Springer',
    text: 'Der Springer c3 wird vom Läufer b4 und vom Springer d5 angegriffen und nur vom Bauern b2 gedeckt. Beide Seiten haben sechs Bauern.' },

  // --- kleine Varianten
  { v: I.LEN, line: L.len, at: 7, title: '4. Lg5: die Fesselung am Springer f6', best: ['c5'],
    text: 'Der Läufer g5 fesselt den Springer f6 gegen die Dame d8. Die Engine zählt 4…c5 zu den besten Zügen; die Eröffnungsdatenbank (Lichess) führt als Fortsetzung 4…h6.' },
  { v: I.SPI, line: L.spi, at: 7, title: '4. Db3: die Dame greift den Läufer an', best: ['c5'],
    text: 'Die Dame b3 greift den Läufer b4 an; er steht ohne Deckung. Der Bauer c5 deckt ihn und greift d4 an.' },

]

export const EXPLANATIONS_NIMZO: Explanation[] = buildExplanationsFor('nimzo-indian', SPECS)
