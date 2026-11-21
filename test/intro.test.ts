import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import type { ContentBundle } from '../src/content/types.ts'
import { branchLabel, checkIntro, fileList, generateIntro, shortenSpokenText, splitSentences } from '../src/content/intro.ts'

const NIMZO = ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'Bd2', 'c5']

test('checkIntro accepts move fragments that are on the line and rejects others', () => {
  assert.deepEqual(checkIntro('Nach 1. d4 Sf6 2. c4 e6 3. Sc3 Lb4 spielt Weiß 4. Ld2.', NIMZO), [])
  assert.equal(checkIntro('Nach 1. d4 Sf6 2. c4 e6 3. Sc3 Lb4 spielt Weiß 4. Lg5.', NIMZO).length, 1)
  assert.deepEqual(checkIntro('Schwarz antwortet mit 4… c5.', NIMZO), [])
  assert.equal(checkIntro('Schwarz antwortet mit 4… d5.', NIMZO).length, 1)
})

test('checkIntro wants every named piece to stand on the named square somewhere on the line', () => {
  assert.deepEqual(checkIntro('Der Läufer d2 deckt den Springer c3 und den Bauern c5.', NIMZO), [])
  assert.equal(checkIntro('Der Läufer h6 greift an.', NIMZO).length, 1)
  assert.equal(checkIntro('Dein Bauer c6 steht gut.', NIMZO).length, 1)
  assert.deepEqual(checkIntro('Auf der offenen d-Linie stehen Türme.', NIMZO), [], 'bare files and squares are not moves')
})

test('splitSentences does not cut at move numbers', () => {
  assert.deepEqual(splitSentences('Nach 1. d4 Sf6 spielt Weiß 2. c4. Dann geht es weiter.'), ['Nach 1. d4 Sf6 spielt Weiß 2. c4.', 'Dann geht es weiter.'])
})

test('shortenSpokenText keeps the first sentences that name only moves of the line, at most three', () => {
  const line = ['d4', 'Nf6', 'c4']
  assert.equal(
    shortenSpokenText('Weiß spielt Bauer d4. Schwarz antwortet mit Springer f6. Danach kommt Bauer c4. Zum Schluss Bauer d4.', line),
    'Weiß spielt Bauer d4. Schwarz antwortet mit Springer f6. Danach kommt Bauer c4.',
  )
  assert.equal(shortenSpokenText('Weiß spielt Bauer d4. Schwarz antwortet mit Springer f6. Der Läufer h6 greift an. Danach Bauer c4.', line), 'Weiß spielt Bauer d4. Schwarz antwortet mit Springer f6.')
  assert.equal(shortenSpokenText('Der Läufer h6 greift an. Weiß spielt Bauer d4.', line), null, 'a text that starts wrong is not shortened but replaced')
})

const NIMZO_OPENING = { side: 'black' as const, entry: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'] }

test('generateIntro names the branch after the shared entry and describes the move', () => {
  const t = generateIntro(NIMZO_OPENING, NIMZO)
  assert.match(t, /^Nach 1\. d4 Sf6 2\. c4 e6 3\. Sc3 Lb4 spielt Weiß 4\. Ld2: Der Läufer geht nach d2 und entwickelt sich damit\./)
  assert.deepEqual(checkIntro(t, NIMZO), [])
})

test('generateIntro says "wählst du" when the branching move is the own one', () => {
  const t = generateIntro({ side: 'white', entry: ['e4', 'e5'] }, ['e4', 'e5', 'Nf3'])
  assert.match(t, /^Nach 1\. e4 e5 wählst du 2\. Sf3: /)
})

test('generateIntro describes a capture, with the piece it takes', () => {
  const t = generateIntro({ side: 'white', entry: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'] }, ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4'])
  assert.match(t, /spielt Schwarz 3… exd4: Der Bauer schlägt auf d4 und nimmt einen Bauern\./)
})

test('generateIntro states the end of the line from observable facts only', () => {
  const t = generateIntro({ side: 'white', entry: ['e4'] }, ['e4', 'd5', 'exd5'])
  assert.match(t, /Am Ende der Linie \(nach 2\. exd5\) hast du einen Bauern mehr/)
})

test('generateIntro of a line that never leaves the entry still reads as an intro', () => {
  const t = generateIntro({ side: 'white', entry: ['e4', 'e5'] }, ['e4', 'e5'])
  assert.match(t, /^Das ist die Grundstellung/)
  assert.deepEqual(checkIntro(t, ['e4', 'e5']), [])
})

test('file lists read as German: d-Linie, c- und f-Linie, d-, e- und f-Linie', () => {
  assert.equal(fileList(['d']), 'd-Linie')
  assert.equal(fileList(['c', 'f']), 'c- und f-Linie')
  assert.equal(fileList(['d', 'e', 'f']), 'd-, e- und f-Linie')
})

test('generateIntro names an open file as an observed fact', () => {
  const t = generateIntro({ side: 'white', entry: ['d4', 'e6', 'e4', 'd5'] }, ['d4', 'e6', 'e4', 'd5', 'exd5', 'exd5'])
  assert.match(t, /Am Ende der Linie \(nach 3… exd5\) ist die e-Linie offen\.$/, 'the hint does not repeat a fact the sentence before already stated')
})

const bundle = JSON.parse(readFileSync(new URL('../public/content/bundle.json', import.meta.url), 'utf8')) as ContentBundle

test('every variation of the shipped bundle has an intro of one to three sentences that names only what is on its line', () => {
  const all = bundle.openings.flatMap((o) => o.variations)
  assert.ok(all.length >= 200)
  for (const v of all) {
    assert.ok(v.intro, `${v.id}: no intro`)
    assert.deepEqual(checkIntro(v.intro!.text, v.line), [], `${v.id}: ${v.intro!.text}`)
    const n = splitSentences(v.intro!.text).length
    assert.ok(n >= 1 && n <= 3, `${v.id}: ${n} sentences`)
    assert.ok(v.intro!.text.length <= 700, `${v.id}: text too long`)
  }
})

test('texts that were generated are marked as drafts, spoken ones are not', () => {
  const all = bundle.openings.flatMap((o) => o.variations)
  for (const v of all) assert.equal(v.intro!.draft, v.intro!.source.ref.startsWith('Aus Zugfolge'), v.id)
})

test('branchLabel gives the first move after the shared entry, in German, with its move number', () => {
  assert.equal(branchLabel(NIMZO_OPENING.entry, NIMZO), 'ab 4. Ld2')
  assert.equal(branchLabel(['e4', 'e5', 'Nf3', 'Nc6', 'd4'], ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4']), 'ab 3… exd4')
  assert.equal(branchLabel([], ['c4', 'Nf6']), 'ab 1. c4')
  assert.equal(branchLabel(['e4', 'e5'], ['e4', 'e5']), null, 'a line that stays on the entry has no branch')
})
