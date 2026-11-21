import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseRoute, hrefAnalyse, hrefSpielen, hrefMeinePartien, hrefKurse } from '../src/router.ts'

test('parseRoute maps the documented routes', () => {
  assert.deepEqual(parseRoute('#/'), { name: 'home' })
  assert.deepEqual(parseRoute(''), { name: 'home' })
  assert.deepEqual(parseRoute('#/o/scotch'), { name: 'opening', openingId: 'scotch' })
  assert.deepEqual(parseRoute('#/v/scotch-game/festigen'), { name: 'variation', variationId: 'scotch-game', stage: 'festigen' })
  assert.deepEqual(parseRoute('#/v/scotch-game'), { name: 'variation', variationId: 'scotch-game', stage: 'lernen' })
  assert.deepEqual(parseRoute('#/ueber'), { name: 'about' })
})

test('parseRoute gives notfound for a malformed percent escape instead of throwing', () => {
  assert.deepEqual(parseRoute('#/o/%E0%A4%A'), { name: 'notfound' })
  assert.deepEqual(parseRoute('#/v/x/bogus'), { name: 'notfound' })
})

test('parseRoute reads an optional sparring anchor fen from the query', () => {
  const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
  assert.deepEqual(parseRoute(`#/v/scotch-game/anwenden?fen=${encodeURIComponent(fen)}`), { name: 'variation', variationId: 'scotch-game', stage: 'anwenden', fen })
  assert.deepEqual(parseRoute('#/v/scotch-game/anwenden'), { name: 'variation', variationId: 'scotch-game', stage: 'anwenden' })
})

test('parseRoute knows the partien route', () => {
  assert.deepEqual(parseRoute('#/partien'), { name: 'partien' })
})

test('parseRoute knows the analysis board with and without a position', () => {
  assert.deepEqual(parseRoute('#/analyse'), { name: 'analyse' })
  const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
  assert.deepEqual(parseRoute(hrefAnalyse(fen)), { name: 'analyse', fen })
  assert.deepEqual(parseRoute('#/analyse/x'), { name: 'notfound' })
})

test('parseRoute knows the free game with and without a start position', () => {
  assert.deepEqual(parseRoute('#/spielen'), { name: 'spielen' })
  const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
  assert.deepEqual(parseRoute(hrefSpielen(fen)), { name: 'spielen', fen })
  assert.equal(hrefSpielen(), '#/spielen')
  assert.deepEqual(parseRoute('#/spielen/x'), { name: 'notfound' })
})

test('parseRoute knows the saved games list and a single saved game', () => {
  assert.deepEqual(parseRoute('#/meine-partien'), { name: 'meinepartien' })
  assert.deepEqual(parseRoute(hrefMeinePartien('g-1a b')), { name: 'meinepartien', id: 'g-1a b' })
  assert.equal(hrefMeinePartien(), '#/meine-partien')
  assert.deepEqual(parseRoute('#/meine-partien/a/b'), { name: 'notfound' })
})

test('parseRoute knows the courses page', () => {
  assert.deepEqual(parseRoute('#/kurse'), { name: 'courses' })
  assert.equal(hrefKurse(), '#/kurse')
  assert.deepEqual(parseRoute('#/kurse/scotch'), { name: 'notfound' })
})

import { navItemOf } from '../src/router.ts'

test('every route belongs to one navigation item; openings and variations count as courses', () => {
  assert.equal(navItemOf(parseRoute('#/')), 'start')
  assert.equal(navItemOf(parseRoute('#/kurse')), 'kurse')
  assert.equal(navItemOf(parseRoute('#/o/scotch')), 'kurse')
  assert.equal(navItemOf(parseRoute('#/v/x/festigen')), 'kurse')
  assert.equal(navItemOf(parseRoute('#/spielen')), 'spielen')
  assert.equal(navItemOf(parseRoute('#/meine-partien/abc')), 'partien')
  assert.equal(navItemOf(parseRoute('#/analyse')), 'analyse')
  assert.equal(navItemOf(parseRoute('#/ueber')), 'ueber')
  assert.equal(navItemOf(parseRoute('#/nirgends')), null)
  assert.equal(navItemOf(parseRoute('#/partien')), null) // "aus Partien üben" is reached from the start page, no item of its own
})

test('parseRoute knows the ten-minute training and marks no navigation item (the breadcrumb carries it)', () => {
  assert.deepEqual(parseRoute('#/training'), { name: 'training' })
  assert.equal(navItemOf(parseRoute('#/training')), null)
  assert.deepEqual(parseRoute('#/training/x'), { name: 'notfound' })
})
