import type { Explanation } from '../../src/content/types.ts'
import { buildExplanationsFor } from '../builders.ts'
import type { ExplSpec } from '../builders.ts'

const G = 'sicilian-defense-smith-morra-gambit'
const ACC = `${G}-accepted`
const NF6 = `${G}-declined-alapin-formation`
const D5 = `${G}-declined-scandinavian-formation`
const B = 'e4 c5 d4 cxd4 c3'
const AL = `${B} dxc3 Nxc3 Nc6 Nf3 d6 Bc4 e6`

/** Gambit moves (3. c3) are document choices, not engine moves: no best claim for them, only countable facts. */
export const SPECS: ExplSpec[] = [
  { v: G, line: B, at: 2, title: '1…c5: das Sizilianische',
    text: 'Der Bauer c5 greift das Feld d4 an. Schwarz tauscht damit später einen Flügelbauern gegen den weißen Zentrumsbauern. Das Smith-Morra-Gambit beantwortet 2. d4 gezielt: Weiß gibt den Bauern lieber ab, als die lange Sizilianisch-Theorie zu spielen.' },
  { v: G, line: B, at: 3, title: '2. d4: das Zentrum anbieten',
    text: 'Der Bauer d4 steht auf einem Feld, das der Bauer c5 angreift. Nimmt Schwarz mit 2…cxd4, hat er einen Bauern gewonnen und eine halboffene c-Linie.' },
  { v: G, line: B, at: 4, title: 'Nach 2…cxd4: Weiß fehlt ein Bauer',
    text: 'Weiß hat einen Bauern weniger. Üblich wäre jetzt 3. Sxd4 (Offenes Sizilianisch). Das Gambit wählt stattdessen 3. c3 und opfert noch einen Bauern für Entwicklung.' },
  { v: G, line: B, at: 5, title: '3. c3: der zweite Bauer', best: ['dxc3'],
    text: 'Der Bauer c3 greift d4 an. Nimmt Schwarz mit …dxc3, steht Weiß nach 4. Sxc3 einen Bauern hinter; dafür sind Läufer f1 und Dame d1 geöffnet und Weiß entwickelt mit Zügen auf Sc3, Sf3 und Lc4.' },
  { v: ACC, line: AL, at: 6, title: 'Nach 3…dxc3: mit dem Springer zurücknehmen', best: ['Nxc3'],
    text: 'Schwarz hat jetzt zwei Bauern mehr gewonnen, Weiß schlägt c3 zurück. Sxc3 nimmt den Bauern und entwickelt zugleich den Springer.' },
  { v: ACC, line: AL, at: 7, title: 'Drei Hauptaufbauten', best: ['Nc6', 'e6'],
    text: 'Weiß hat sechs Bauern, Schwarz sieben. Schwarz baut meist mit …Sc6, …d6 oder …e6 auf; die Engine zählt …Sc6 und …e6 hier zu den besten Zügen.' },
  { v: ACC, line: AL, at: 9, title: 'Sf3: schnell entwickeln', best: ['d6', 'e6'],
    text: 'Weiß hat Sc3 und Sf3 entwickelt, Schwarz erst den Sc6. Schwarz spielt jetzt …d6 oder …e6 und bereitet den Läufer vor.' },
  { v: ACC, line: AL, at: 10, title: 'Lc4: Druck auf f7', best: ['Bc4'],
    text: 'Der Läufer c4 zielt über d5 und e6 auf f7. Er gehört zum Plan: Springer und Läufer entwickeln, dann rochieren und die offenen Linien mit den Türmen besetzen.' },
  { v: ACC, line: AL, at: 11, title: 'Schwarz verteidigt', best: ['e6'],
    text: 'Schwarz stützt mit …e6 den Punkt f7 durch einen Bauern; der Läufer c8 bleibt dafür hinter dem Bauern e6 eingesperrt.' },
  { v: ACC, line: AL, at: 12, title: 'Rochade statt Hast', best: ['O-O'],
    text: 'Weiß hat Sc3, Sf3 und Lc4 entwickelt, Schwarz erst den Sc6. Die Rochade bringt den König in Sicherheit und aktiviert den Turm h1, bevor die Dame ins Spiel kommt.' },
  { v: NF6, line: `${B} Nf6 e5 Nd5 Nf3`, at: 6, title: '3…Sf6: Schwarz lehnt den Bauern ab', best: ['e5'],
    text: 'Der Springer f6 greift den Bauern e4 an. Weiß antwortet mit dem Vorstoß e5, der den Springer angreift.' },
  { v: NF6, line: `${B} Nf6 e5 Nd5 Nf3`, at: 7, title: 'Der Springer muss weichen', best: ['Nd5'],
    text: 'Der Bauer e5 greift den Springer f6 an. Der Springer geht meist nach d5, wo er den Bauern c3 anvisiert.' },
  { v: NF6, line: `${B} Nf6 e5 Nd5 Nf3`, at: 8, title: 'Entwicklung oder Tausch', best: ['Nf3', 'cxd4'],
    text: 'Weiß kann mit cxd4 den Bauern zurückgewinnen und ein Zentrum mit e5 und d4 aufbauen, oder mit Sf3 entwickeln. Beide Züge hält die Engine für gut.' },
  { v: D5, line: `${B} d5 exd5 Qxd5 cxd4`, at: 6, title: '3…d5: Schwarz schlägt im Zentrum zurück', best: ['exd5'],
    text: 'Der Bauer d5 greift e4 an. Weiß schlägt auf d5 und gewinnt einen Bauern; das Gambit ist damit abgelehnt.' },
  { v: D5, line: `${B} d5 exd5 Qxd5 cxd4`, at: 7, title: 'Schwarz nimmt zurück', best: ['Qxd5', 'Nf6'],
    text: 'Schwarz holt den Bauern mit der Dame zurück oder entwickelt den Springer f6. Die Dame auf d5 kann vom Springer c3 mit Tempo angegriffen werden.' },
  { v: D5, line: `${B} d5 exd5 Qxd5 cxd4`, at: 8, title: 'Der Bauer d4 fällt', best: ['cxd4'],
    text: 'Mit cxd4 nimmt Weiß den vorgerückten Bauern d4. Material ist danach gleich, und Weiß hat Entwicklungsvorsprung nach Sc3 und Sf3.' },
]

export const EXPLANATIONS_SMITH_MORRA: Explanation[] = buildExplanationsFor('smith-morra', SPECS)
export const SMITH_MORRA_IDS = { G, ACC, NF6, D5 }
