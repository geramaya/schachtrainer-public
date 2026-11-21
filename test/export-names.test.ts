import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pgnFileNames, zipFileName } from '../src/games/export-names.ts'

const g = (o: Partial<{ date: string; white: string; black: string; eco: string | null }> = {}) => ({ date: '2026-11-21T10:00:00.000Z', white: 'Ich', black: 'Stockfish', eco: 'B01' as string | null, ...o })

test('name is date_White-Black_ECO.pgn; umlauts are transliterated, path characters become separators', () => {
  assert.deepEqual(pgnFileNames([g({ white: 'Anna Müller', black: 'Bob/../x' })]), ['2026-11-21_Anna-Mueller-Bob-x_B01.pgn'])
})

test('missing date and eco fall back; empty names become Unbekannt; forbidden characters never survive', () => {
  const [n] = pgnFileNames([g({ date: '', eco: null, white: '', black: 'a:b*c?"<>|\\' })])
  assert.equal(n, 'ohne-Datum_Unbekannt-a-b-c_ohne-ECO.pgn')
  assert.doesNotMatch(n!, /[\\/:*?"<>|]/)
})

test('duplicate names are numbered with the first one plain; long names are shortened', () => {
  const names = pgnFileNames([g(), g(), g(), g({ white: 'x'.repeat(200) })])
  assert.deepEqual(names.slice(0, 3), ['2026-11-21_Ich-Stockfish_B01.pgn', '2026-11-21_Ich-Stockfish_B01-2.pgn', '2026-11-21_Ich-Stockfish_B01-3.pgn'])
  assert.ok(names[3]!.length <= 100)
  assert.equal(new Set(names).size, 4)
})

test('zip name carries the local day', () => {
  assert.equal(zipFileName(new Date(2026, 10, 21, 23, 59)), 'partien-2026-11-21.zip')
})
