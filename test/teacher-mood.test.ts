import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { FIGUREN } from '../src/teacher/avatar.ts'
import type { FigurId, Gefuehl } from '../src/teacher/avatar.ts'
import { GEFUEHLE, avatarMood, moodFor, positionMood } from '../src/teacher/mood.ts'
import type { QuipCategory } from '../src/teacher/quips.ts'

type Row = [QuipCategory, Gefuehl, Partial<Record<FigurId, Gefuehl>>]
/** One row per event: the default feeling and the exceptions per teacher (mann = Jonas, frau = Mira, meister = Aldo, fuchs = Ferro). */
const ROWS: Row[] = [
  ['bester_zug', 'begeistert', {}],
  ['gut', 'freude', {}],
  ['repertoire_treffer', 'freude', {}],
  ['ungenau', 'nachdenklich', { frau: 'sarkastisch', fuchs: 'sarkastisch' }],
  ['fehler', 'besorgt', { frau: 'sarkastisch', fuchs: 'lachen', meister: 'mitleid' }],
  ['patzer', 'entsetzt', { frau: 'aergerlich', fuchs: 'lachen' }],
  ['repertoire_abweichung', 'nachdenklich', { frau: 'aergerlich' }],
  ['gegner_verlaesst_theorie', 'lachen', {}],
  ['gegner_fehler', 'lachen', {}],
  ['schach_gegeben', 'freude', {}],
  ['matt_gesetzt', 'begeistert', {}],
  ['matt_bekommen', 'mitleid', { fuchs: 'sarkastisch' }],
  ['patt_remis', 'nachdenklich', {}],
  ['zuruecknehmen', 'sarkastisch', { mann: 'mitleid', meister: 'mitleid' }],
  ['aufgeben', 'mitleid', {}],
  ['partie_start', 'freude', { meister: 'neutral' }],
  ['lange_bedenkzeit', 'nachdenklich', {}],
]

for (const [event, base, special] of ROWS) {
  test(`mood: ${event}`, () => {
    for (const { id } of FIGUREN) assert.equal(moodFor(id, event), special[id] ?? base, `${id} / ${event}`)
  })
}

test('the table has a row for every quip event (nothing falls through)', () => {
  const events = ['bester_zug', 'gut', 'ungenau', 'fehler', 'patzer', 'repertoire_treffer', 'repertoire_abweichung', 'gegner_verlaesst_theorie', 'gegner_fehler', 'schach_gegeben', 'matt_gesetzt', 'matt_bekommen', 'patt_remis', 'zuruecknehmen', 'aufgeben', 'partie_start', 'lange_bedenkzeit']
  assert.deepEqual(ROWS.map((r) => r[0]).sort(), [...events].sort())
})

test('an unknown event gives neutral (fallback)', () => {
  assert.equal(moodFor('mann', 'gibt-es-nicht' as QuipCategory), 'neutral')
})

test('position mood: clearly better = joy, clearly worse = worry, otherwise (or without evaluation) neutral', () => {
  assert.equal(positionMood(150), 'freude')
  assert.equal(positionMood(400), 'freude')
  assert.equal(positionMood(149), 'neutral')
  assert.equal(positionMood(-149), 'neutral')
  assert.equal(positionMood(-150), 'besorgt')
  assert.equal(positionMood(-10000), 'besorgt')
  assert.equal(positionMood(null), 'neutral')
})

test('an event feeling wins over the position; without an event the position decides', () => {
  assert.equal(avatarMood('frau', 'patzer', 500), 'aergerlich')
  assert.equal(avatarMood('mann', 'gut', -500), 'freude')
  assert.equal(avatarMood('mann', null, 500), 'freude')
  assert.equal(avatarMood('mann', null, -500), 'besorgt')
  assert.equal(avatarMood('mann', null, 20), 'neutral')
  assert.equal(avatarMood('mann', null, null), 'neutral')
})

test('every feeling of the table has a picture for every teacher in public/lehrer', () => {
  const used = new Set<string>(['neutral'])
  for (const [, base, special] of ROWS) { used.add(base); for (const g of Object.values(special)) used.add(g) }
  for (const g of ['freude', 'besorgt']) used.add(g)
  for (const g of used) assert.ok(GEFUEHLE.includes(g as Gefuehl), g)
  for (const { id } of FIGUREN) for (const g of GEFUEHLE) assert.ok(existsSync(new URL(`../public/lehrer/${id}-${g}.webp`, import.meta.url)), `${id}-${g}.webp`)
})
