import { test } from 'node:test'
import assert from 'node:assert/strict'
import { quipAudioFile, quipAudioId, quipAudioTexts, hasQuipAudio } from '../src/audio/quip-audio.ts'
import type { QuipBook } from '../src/teacher/quips.ts'

const NO_TAGS = { mann: '', frau: '', meister: '', fuchs: '' }
const book: QuipBook = {
  mann: { patzer: ['Autsch.', 'Das {zug} war nichts.'], gut: ['Autsch.', 'Passt.'] },
  frau: { patzer: ['Au weia.'] },
  fuchs: { patzer: ['Fiep.'] },
}

test('audio id depends on teacher and text, is stable and lower-case ascii', () => {
  assert.equal(quipAudioId('mann', 'Autsch.'), quipAudioId('mann', 'Autsch.'))
  assert.notEqual(quipAudioId('mann', 'Autsch.'), quipAudioId('frau', 'Autsch.'))
  assert.notEqual(quipAudioId('mann', 'Autsch.'), quipAudioId('mann', 'Autsch!'))
  assert.match(quipAudioId('mann', 'Autsch.'), /^quip-mann-[a-z0-9]+$/)
})

test('audio texts: voice per teacher, no placeholder quips, no teacher without voice, no duplicate ids', () => {
  const t = quipAudioTexts(book, { mann: null, frau: 'nadine', meister: null, fuchs: null }, NO_TAGS)
  assert.deepEqual(t.map((x) => x.text), ['Au weia.'])
  assert.equal(t[0]!.voice, 'nadine')
  assert.equal(t[0]!.id, quipAudioId('frau', 'Au weia.'))
  const both = quipAudioTexts(book, { mann: 'v1', frau: 'v2', meister: 'v3', fuchs: 'v4' }, NO_TAGS)
  assert.deepEqual(both.map((x) => x.text).sort(), ['Au weia.', 'Autsch.', 'Fiep.', 'Passt.'])
  assert.equal(new Set(both.map((x) => x.id)).size, both.length)
})

test('quipAudioFile: the file from the manifest, null when the entry is missing', () => {
  const man = { [quipAudioId('mann', 'Autsch.')]: { file: 'x.mp3', title: '', text: 'Autsch.', sources: [], durationSec: 1 } }
  assert.equal(quipAudioFile(man, 'mann', 'Autsch.'), 'x.mp3')
  assert.equal(quipAudioFile(man, 'mann', 'Passt.'), null)
  assert.equal(quipAudioFile({}, 'mann', 'Autsch.'), null)
})

test('hasQuipAudio: only entries with the quip prefix count', () => {
  assert.equal(hasQuipAudio({}), false)
  assert.equal(hasQuipAudio({ scotch: { file: 'a', title: '', text: '', sources: [], durationSec: 1 } }), false)
  assert.equal(hasQuipAudio({ 'quip-mann-abc': { file: 'a', title: '', text: '', sources: [], durationSec: 1 } }), true)
})

test('expression tag is only in the spoken text, never in the shown text', () => {
  const t = quipAudioTexts(book, { mann: null, frau: 'nadine', meister: null, fuchs: null }, { mann: '[cheerful]', frau: '[sarcastic]', meister: '', fuchs: '' })
  assert.equal(t[0]!.text, 'Au weia.')
  assert.equal(t[0]!.speakText, '[sarcastic] Au weia.')
  const plain = quipAudioTexts(book, { mann: null, frau: 'nadine', meister: null, fuchs: null }, { mann: '', frau: '', meister: '', fuchs: '' })
  assert.equal(plain[0]!.speakText, 'Au weia.')
})
