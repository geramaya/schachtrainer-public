// Generates lesson-bundle.json (one opening, one variation, 2 explanations, 2 questions) with chess.js.
// Used only by the DEV switch ?fixture=1 and for tests. Run: node test/fixtures/make-lesson-bundle.ts
import { Chess } from 'chess.js'
import { writeFileSync } from 'node:fs'
import { positionKey } from '../../src/chess/position.ts'
import type { ContentBundle } from '../../src/content/types.ts'

const source = { kind: 'autor' as const, ref: 'fixture' }
const line = ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4']
const keys: string[] = []
const c = new Chess()
keys.push(positionKey(c.fen()))
for (const san of line) { c.move(san); keys.push(positionKey(c.fen())) }

const bundle: ContentBundle = {
  schemaVersion: 3,
  contentVersion: 'fixture-1',
  openings: [{
    id: 'scotch', name: 'Schottische Partie', side: 'white', entry: line.slice(0, 5), role: 'Fixture', docRef: 'fixture',
    variations: [{ id: 'scotch-fixture', name: 'Schottisch: Fixture-Linie', nameEn: 'Scotch: fixture line', line, keyPositions: [keys[5]!], fromDocument: true }],
  }],
  trees: { scotch: {} },
  explanations: [
    { id: 'ex-d4', key: keys[5]!, title: 'Das Zentrum öffnen', text: 'Weiß öffnet mit 3. d4 sofort die Mitte und gewinnt Raum für die Figuren.',
      arrows: [{ orig: 'd2', dest: 'd4', brush: 'green' }], claims: [{ kind: 'best', uci: 'd2d4', verified: { evalCp: 30, depth: 20 } }],
      status: 'engine-geprüft', source },
    { id: 'ex-nf3', key: keys[3]!, title: 'Entwicklung mit Tempo', text: 'Der Springer entwickelt sich und greift e5 an.',
      arrows: [{ orig: 'g1', dest: 'f3', brush: 'blue' }], claims: [], status: 'entwurf', source },
  ],
  questions: [
    { id: 'q-move', key: keys[4]!, variationId: 'scotch-fixture', prompt: 'Weiß am Zug: Welcher Zug öffnet das Zentrum?', kind: 'move', answerUci: 'd2d4', explanationId: 'ex-d4' },
    { id: 'q-choice', key: keys[3]!, variationId: 'scotch-fixture', prompt: 'Was ist die Idee von 2. Sf3?', kind: 'choice',
      choices: [{ text: 'Den Bauern e5 angreifen und entwickeln', correct: true }, { text: 'Die Dame frühzeitig ins Spiel bringen', correct: false }, { text: 'Den Läufer f1 einsperren', correct: false }],
      explanationId: 'ex-nf3' },
  ],
  deviations: [],
  puzzles: {},
}
writeFileSync(new URL('./lesson-bundle.json', import.meta.url), JSON.stringify(bundle, null, 1) + '\n')
