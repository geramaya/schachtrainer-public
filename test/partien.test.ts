import { test } from 'node:test'
import assert from 'node:assert/strict'
import { partieQueue } from '../src/train/partien.ts'
import type { Card } from '../src/train/srs.ts'

const card = (key: string, over: Partial<Card> = {}): Card => ({ openingId: 'scotch', key, expectedUci: 'e2e4', variationId: 'v1', due: 0, intervalDays: 0, ease: 2.5, reps: 0, lapses: 0, contentVersion: 'c1', origin: 'partie', ...over })
const NOW = 1_000_000

test('partieQueue: only partie cards, new ones and due ones, not ones scheduled later', () => {
  const cards = [
    card('new'),
    card('due', { reps: 1, due: NOW - 10 }),
    card('later', { reps: 1, due: NOW + 10 }),
    card('baum-due', { origin: 'baum', reps: 1, due: NOW - 10 }),
  ]
  assert.deepEqual(partieQueue(cards, NOW).map((c) => c.key), ['due', 'new'])
})

test('partieQueue: practised due cards come before new ones, oldest due first', () => {
  const cards = [card('new'), card('b', { reps: 1, due: NOW - 5 }), card('a', { reps: 1, due: NOW - 50 })]
  assert.deepEqual(partieQueue(cards, NOW).map((c) => c.key), ['a', 'b', 'new'])
})
