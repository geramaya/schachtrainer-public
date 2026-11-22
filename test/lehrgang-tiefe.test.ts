import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verlaengereLinie } from '../tools/lib/lehrgang-tiefe.ts'
import type { TiefeOptions } from '../tools/lib/lehrgang-tiefe.ts'

const queue = <T>(items: T[]) => () => items.shift() ?? null
const base = (over: Partial<TiefeOptions>): TiefeOptions => ({
  line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'], side: 'white', zielPly: 9,
  minPartien: 10, ownMove: () => null, explorer: () => null, engineBest: async () => null, ...over,
})
const show = (r: { san: string; herkunft: string }[]) => r.map((x) => `${x.san}:${x.herkunft}`)

test('tiefe: own moves come from the repertoire, the opponent move is the most frequent explorer move with enough games', async () => {
  const r = await verlaengereLinie(base({
    ownMove: queue(['d2d3', 'c2c3']),
    explorer: queue([[{ uci: 'a7a6', games: 3 }, { uci: 'g8f6', games: 40 }], [{ uci: 'f6g4', games: 12 }]]),
    engineBest: async () => { throw new Error('engine must not be asked') },
  }))
  assert.deepEqual(show(r), ['Nf6:daten', 'd3:repertoire', 'Ng4:daten', 'c3:repertoire'])
  assert.equal(r[0]!.uci, 'g8f6')
})

test('tiefe: fewer games than the limit in the cache (or none cached) means the engine best move', async () => {
  const r = await verlaengereLinie(base({
    zielPly: 7,
    ownMove: queue(['d2d3']),
    explorer: queue([[{ uci: 'g8f6', games: 9 }], null]),
    engineBest: async () => 'f8c5',
  }))
  assert.deepEqual(show(r), ['Bc5:engine', 'd3:repertoire'])
})

test('tiefe: the line ends where the repertoire has no own move, and not beyond the target ply', async () => {
  const gap = await verlaengereLinie(base({ ownMove: () => null, explorer: () => [{ uci: 'g8f6', games: 50 }] }))
  assert.deepEqual(show(gap), ['Nf6:daten'])
  const done = await verlaengereLinie(base({ line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3'], zielPly: 9, ownMove: () => 'a2a3' }))
  assert.deepEqual(done, [])
})

test('tiefe: an engine that has no move (or an illegal explorer move) ends the line instead of inventing one', async () => {
  const none = await verlaengereLinie(base({ engineBest: async () => null }))
  assert.deepEqual(none, [])
  const illegal = await verlaengereLinie(base({ explorer: () => [{ uci: 'a1a8', games: 99 }] }))
  assert.deepEqual(illegal, [])
})

import { erweitereVariante } from '../tools/lib/lehrgang-tiefe.ts'
import type { VarianteSrc } from '../tools/lib/lehrgang-build.ts'

const TODO = 'TODO texter'
const kern: VarianteSrc = { id: 'v1', name: 'x', stufe: 'kern', anteil: 0.3, zuege: [{ san: 'e4', satz: 'a' }, { san: 'e5', satz: 'b' }, { san: 'Nf3', satz: 'c' }] }

test('erweitereVariante: marks the origin of the old moves (own = repertoire, opponent = daten), appends the new ones with neu and a placeholder sentence', () => {
  const v = erweitereVariante(kern, [{ san: 'Nc6', uci: 'b8c6', herkunft: 'engine' }], 'white')
  assert.deepEqual(v.zuege.map((z) => [z.san, z.herkunft, z.neu ?? false, z.satz]), [['e4', 'repertoire', false, 'a'], ['e5', 'daten', false, 'b'], ['Nf3', 'repertoire', false, 'c'], ['Nc6', 'engine', true, TODO]])
})

test('erweitereVariante: a second run keeps everything as it is (no duplicate moves, existing origin stays) and only Kern gets the 3 goal placeholders', () => {
  const once = erweitereVariante(kern, [{ san: 'Nc6', uci: 'b8c6', herkunft: 'engine' }], 'white')
  const twice = erweitereVariante(once, [], 'white')
  assert.deepEqual(twice, once)
  assert.deepEqual(once.ziel, [{ satz: TODO }, { satz: TODO }, { satz: TODO }])
  assert.equal(erweitereVariante({ ...kern, stufe: 'erweiterung' }, [], 'white').ziel, undefined)
  assert.deepEqual(erweitereVariante({ ...kern, ziel: [{ satz: 'Mein Ziel.' }, { satz: 'Noch eins.' }] }, [], 'white').ziel, [{ satz: 'Mein Ziel.' }, { satz: 'Noch eins.' }])
})
