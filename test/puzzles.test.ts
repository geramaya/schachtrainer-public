import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assignPuzzles, parsePuzzleLine, puzzleFilter, selectPuzzles, tagPrefixesOf } from '../tools/lib/puzzles.ts'

const FEN = 'r1bqkbnr/pppp1ppp/2n5/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 4'
const LATE = 'r1bqkbnr/pppp1ppp/2n5/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 25'
const row = (id: string, rating: number, tags: string, fen = FEN, pop = 90) =>
  `${id},${fen},d1d2 a8a7 b1b2,${rating},75,${pop},1000,advantage short,https://lichess.org/${id}#9,${tags}`
const csv = [
  'PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags',
  row('aaaaa', 1500, 'Scotch_Game Scotch_Game_Classical_Variation'),
  row('bbbbb', 2300, 'Scotch_Game'),
  row('ccccc', 1400, 'Sicilian_Defense'),
  row('ddddd', 1500, 'Scotch_Game', 'not a fen'),
  row('eeeee', 1600, 'Scotch_Game Scotch_Game_Classical_Variation'),
  row('fffff', 1600, 'Scotch_Game', LATE),
]

test('parsePuzzleLine reads the Lichess columns and drops header and invalid FEN', () => {
  assert.equal(parsePuzzleLine(csv[0]!), null)
  assert.equal(parsePuzzleLine(csv[4]!), null)
  assert.deepEqual(parsePuzzleLine(csv[1]!), {
    id: 'aaaaa', fen: FEN, moves: ['d1d2', 'a8a7', 'b1b2'], rating: 1500, popularity: 90, nbPlays: 1000, themes: ['advantage', 'short'],
    openingTags: ['Scotch_Game', 'Scotch_Game_Classical_Variation'], url: 'https://lichess.org/aaaaa#9',
  })
})

test('filter keeps rating 1200-1900, opening tag prefix and starts before move 20', () => {
  const out = selectPuzzles(csv, puzzleFilter(['Scotch_Game']), 100)
  assert.deepEqual(out.map((p) => p.id), ['aaaaa', 'eeeee'])
})

test('limitPerTag skips a puzzle once every one of its tags is full', () => {
  const out = selectPuzzles(csv, puzzleFilter(['Scotch_Game']), 1)
  assert.deepEqual(out.map((p) => p.id), ['aaaaa'])
})

test('assignPuzzles uses the longest matching tag prefix, else the opening', () => {
  const ps = selectPuzzles([...csv, row('ggggg', 1500, 'Scotch_Game_Mieses_Variation'), row('hhhhh', 1500, 'Scotch_Game')], puzzleFilter(['Scotch_Game']), 100)
  const vars = [{ id: 'v-main', nameEn: 'Scotch Game' }, { id: 'v-classical', nameEn: 'Scotch Game: Classical Variation' }]
  const by = assignPuzzles(ps, 'scotch', vars)
  assert.deepEqual(by['v-classical']!.map((p) => p.id), ['aaaaa', 'eeeee'])
  // the root variation only takes puzzles tagged exactly with it; unknown sub-lines go to the opening pool
  assert.deepEqual(by['v-main']!.map((p) => p.id), ['hhhhh'])
  assert.deepEqual(by['scotch/allgemein']!.map((p) => p.id), ['ggggg'])
})

test('limitPerTag keeps the most popular puzzles of a tag, not the first ones', () => {
  const rows = [row('low', 1500, 'Scotch_Game', FEN, 10), row('high', 1500, 'Scotch_Game', FEN, 95), row('mid', 1500, 'Scotch_Game', FEN, 50)]
  assert.deepEqual(selectPuzzles(rows, puzzleFilter(['Scotch_Game']), 2).map((p) => p.id).sort(), ['high', 'mid'])
})

test('assignPuzzles caps per variation and per opening, most popular first', () => {
  const rows = [10, 20, 30, 40, 50].map((n) => row(`c${n}`, 1500, 'Scotch_Game_Classical_Variation', FEN, n))
    .concat([60, 70].map((n) => row(`m${n}`, 1500, 'Scotch_Game_Mieses_Variation', FEN, n)))
  const ps = selectPuzzles(rows, puzzleFilter(['Scotch_Game']), 100)
  const vars = [{ id: 'v-classical', nameEn: 'Scotch Game: Classical Variation' }]
  const capped = assignPuzzles(ps, 'scotch', vars, { perVariation: 3, perOpening: 100 })
  assert.deepEqual(capped['v-classical']!.map((p) => p.id), ['c50', 'c40', 'c30'])
  const total = assignPuzzles(ps, 'scotch', vars, { perVariation: 3, perOpening: 4 })
  assert.deepEqual(Object.values(total).flat().map((p) => p.id).sort(), ['c40', 'c50', 'm60', 'm70'])
})

test('tagPrefixesOf: explicit puzzleTags win over names derived from variationNames', () => {
  assert.deepEqual(tagPrefixesOf({ variationNames: ['Indian Defense: Budapest Gambit'], puzzleTags: ['Indian_Defense_Budapest_Defense'] }), ['Indian_Defense_Budapest_Defense'])
  assert.deepEqual(tagPrefixesOf({ variationNames: ["Queen's Gambit Declined: Tarrasch Defense"] }), ['Queens_Gambit_Declined_Tarrasch_Defense'])
  assert.deepEqual(tagPrefixesOf({ variationNames: [] }), [])
})
