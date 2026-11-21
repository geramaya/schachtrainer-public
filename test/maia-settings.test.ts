import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseOpponent } from '../src/maia/settings.ts'
import { emptyProgress, exportProgress, importProgress } from '../src/store/progress.ts'

test('parseOpponent: keeps valid values, drops garbage, snaps the level to 100 steps inside 1100-1900', () => {
  assert.deepEqual(parseOpponent({ opponent: 'maia', maiaElo: 1500, maiaGreedy: true }), { opponent: 'maia', maiaElo: 1500, maiaGreedy: true })
  assert.deepEqual(parseOpponent({ opponent: 'gpt', maiaElo: 'x', maiaGreedy: 1 }), {})
  assert.deepEqual(parseOpponent(null), {})
  assert.equal(parseOpponent({ maiaElo: 1540 }).maiaElo, 1500)
  assert.equal(parseOpponent({ maiaElo: 1560 }).maiaElo, 1600)
  assert.equal(parseOpponent({ maiaElo: 400 }).maiaElo, 1100)
  assert.equal(parseOpponent({ maiaElo: 9000 }).maiaElo, 1900)
})

test('the opponent settings survive export and import of the progress', () => {
  const p = emptyProgress()
  p.settings = { ...p.settings, opponent: 'maia', maiaElo: 1700, maiaGreedy: true }
  const back = importProgress(exportProgress(p))
  assert.deepEqual([back.settings.opponent, back.settings.maiaElo, back.settings.maiaGreedy], ['maia', 1700, true])
})
