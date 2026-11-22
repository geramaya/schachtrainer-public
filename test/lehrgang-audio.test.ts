import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lehrgangAudioFile, lehrgangAudioId, lehrgangAudioTexts, speakLehrgang } from '../src/audio/lehrgang-audio.ts'
import type { Lehrgang } from '../src/lehrgang/types.ts'

const zug = (san: string, satz: string) => ({ san, uci: 'e2e4', satz })
const lg = (satz: string[], plan: { titel: string; text: string }[]): Lehrgang => ({
  id: 'scotch', name: 'Schottisch', side: 'white', entry: [], band: '1', abruf: null, fallen: [], musterpartien: [], offen: 0, spielplan: plan,
  varianten: [{ id: 'v1', name: 'V1', stufe: 'kern', anteil: null, haeufigkeit: null, vorlaeufig: false, veraltet: false, ziel: [], zuege: satz.map((s) => zug('e4', s)) }],
})

test('speech form: German SAN becomes piece name and square', () => {
  assert.equal(speakLehrgang('Mit Sf3 entwickelst du, Lb5 pinnt.'), 'Mit Springer f3 entwickelst du, Läufer b5 pinnt.')
  assert.equal(speakLehrgang('Dh4+ und Ke8'), 'Dame h4 Schach und König e8')
  assert.equal(speakLehrgang('Nach Sxd5 oder exd5.'), 'Nach Springer schlägt d5 oder e schlägt d5.')
})

test('speech form: evaluations, move numbers and dashes', () => {
  assert.equal(speakLehrgang('ausgeglichen (+0,35).'), 'ausgeglichen (plus null Komma drei fünf).')
  assert.equal(speakLehrgang('Schwarz steht besser (−0,27).'), 'Schwarz steht besser (minus null Komma zwei sieben).')
  assert.equal(speakLehrgang('Nach 3. Sf3 Sc6 geht es weiter.'), 'Nach Springer f3 Springer c6 geht es weiter.')
  assert.equal(speakLehrgang('Mit 5…Sa5 weicht er aus.'), 'Mit Springer a5 weicht er aus.')
  assert.equal(speakLehrgang('d4–e5'), 'd4 bis e5')
})

test('speech form leaves plain squares and words alone', () => {
  assert.equal(speakLehrgang('Der Bauer auf e5 und die Stellung Schach.'), 'Der Bauer auf e5 und die Stellung Schach.')
})

test('id is a stable function of the text', () => {
  assert.equal(lehrgangAudioId('Hallo.'), lehrgangAudioId('Hallo.'))
  assert.notEqual(lehrgangAudioId('Hallo.'), lehrgangAudioId('Hallo!'))
  assert.match(lehrgangAudioId('Hallo.'), /^lehrgang-[a-z0-9]+$/)
})

test('texts: one per distinct sentence and per plan section, speakText only where it differs, TODO skipped', () => {
  const plan = [{ titel: 'Idee', text: 'Spiele Sf3.' }, { titel: 'Pläne', text: 'TODO texter: später' }]
  const out = lehrgangAudioTexts([lg(['Mit Sf3 los.', 'Mit Sf3 los.', 'Ruhig bleiben.'], plan)])
  assert.equal(out.length, 3)
  const s = out.find((t) => t.text === 'Mit Sf3 los.')!
  assert.equal(s.id, lehrgangAudioId('Mit Sf3 los.'))
  assert.equal(s.speakText, 'Mit Springer f3 los.')
  assert.equal(s.kind, 'lehrgang')
  assert.equal(s.refId, 'scotch')
  assert.equal(out.find((t) => t.text === 'Ruhig bleiben.')!.speakText, 'Ruhig bleiben.')
  assert.ok(out.find((t) => t.title === 'Schottisch: Idee'))
  assert.ok(!out.some((t) => t.text.startsWith('TODO')))
})

test('file lookup: entry gives file, missing entry gives null', () => {
  const m = { [lehrgangAudioId('A.')]: { file: 'x.mp3', title: '', text: '', sources: [], durationSec: 1 } }
  assert.equal(lehrgangAudioFile(m, 'A.'), 'x.mp3')
  assert.equal(lehrgangAudioFile(m, 'B.'), null)
})
