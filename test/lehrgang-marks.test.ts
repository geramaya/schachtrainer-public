import { test } from 'node:test'
import assert from 'node:assert/strict'
import { listOf, markenOf, parseMarke, quellenLinks } from '../src/lehrgang/marks.ts'

test('parseMarke: letter = Lichess colour, two squares = arrow, one square = circle; anything else is rejected', () => {
  assert.deepEqual(parseMarke('Gd4c6'), { brush: 'green', orig: 'd4', dest: 'c6' })
  assert.deepEqual(parseMarke('Rc6'), { brush: 'red', orig: 'c6' })
  assert.equal(parseMarke('Be4e5')?.brush, 'blue')
  assert.equal(parseMarke('Ya1')?.brush, 'yellow')
  for (const bad of ['Xd4c6', 'd4c6', 'Gd9c6', 'Gd4c', 'G', 'Gd4c6e7', 'Gd4d4', '']) assert.equal(parseMarke(bad), null, bad)
})

test('listOf: a string or a list gives a list; strings are split at the separator and trimmed, empties dropped', () => {
  assert.deepEqual(listOf('Rc6, Rc7 ,Ra7', ','), ['Rc6', 'Rc7', 'Ra7'])
  assert.deepEqual(listOf(['Rf7'], ','), ['Rf7'])
  assert.deepEqual(listOf('https://a.org/x ; Stockfish', ';'), ['https://a.org/x', 'Stockfish'])
  assert.deepEqual(listOf(undefined, ','), [])
  assert.deepEqual(listOf('', ','), [])
})

test('quellenLinks: the URL of every source with a readable site name; pieces without a URL are dropped', () => {
  const l = quellenLinks(['https://en.wikipedia.org/wiki/Scotch_Game (Abruf 2026-11-22)', 'Stockfish-Verlust laut aufgaben.json', 'https://www.chess.com/openings/Scotch-Game', 'https://lichess.org/opening/x', 'https://en.wikibooks.org/wiki/X', 'https://www.example.org/a'])
  assert.deepEqual(l, [
    { url: 'https://en.wikipedia.org/wiki/Scotch_Game', label: 'Wikipedia' },
    { url: 'https://www.chess.com/openings/Scotch-Game', label: 'Chess.com' },
    { url: 'https://lichess.org/opening/x', label: 'Lichess' },
    { url: 'https://en.wikibooks.org/wiki/X', label: 'Wikibooks' },
    { url: 'https://www.example.org/a', label: 'example.org' },
  ])
})

test('markenOf: arrows then circles of a move as drawable marks; unreadable codes are skipped, nothing gives an empty list', () => {
  assert.deepEqual(markenOf({ pfeile: ['Gd4c6', 'Xx'], felder: ['Rc6'] }), [{ brush: 'green', orig: 'd4', dest: 'c6' }, { brush: 'red', orig: 'c6' }])
  assert.deepEqual(markenOf({}), [])
  assert.deepEqual(markenOf(undefined), [])
})
