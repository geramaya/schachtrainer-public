import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_NAME, displayName, eloText, identityOf, parseAccounts, resultClass, resultFor, sideOfPlayer } from '../src/games/identity.ts'
import { emptyProgress, exportProgress, importProgress } from '../src/store/progress.ts'
import type { StoredGame } from '../src/games/model.ts'

const g = (o: Partial<StoredGame>): StoredGame => ({ white: 'anna', black: 'bob', ownSide: null, result: '1-0', reason: null, elo: null, ...o } as StoredGame)
const me = { name: 'Anna', accounts: ['anna_schach', 'AnnaOnChess'] }

test('parseAccounts: comma, semicolon or line separated, trimmed, without empties and duplicates (case-insensitive)', () => {
  assert.deepEqual(parseAccounts(' anna_schach, AnnaOnChess ;\nanna_schach,, '), ['anna_schach', 'AnnaOnChess'])
  assert.deepEqual(parseAccounts(''), [])
})

test('identityOf: the name defaults to "Ich", accounts to none', () => {
  assert.deepEqual(identityOf({}), { name: DEFAULT_NAME, accounts: [] })
  assert.deepEqual(identityOf({ player: { name: '  Anna ', accounts: ['x'] } }), { name: 'Anna', accounts: ['x'] })
  assert.deepEqual(identityOf({ player: { name: '   ' } }), { name: DEFAULT_NAME, accounts: [] })
})

test('sideOfPlayer: an own game knows its side; an import is recognised by the own name or an account (case-insensitive)', () => {
  assert.equal(sideOfPlayer(g({ ownSide: 'black' }), me), 'black')
  assert.equal(sideOfPlayer(g({ white: 'ANNA' }), me), 'white')
  assert.equal(sideOfPlayer(g({ white: 'x', black: 'annaonchess' }), me), 'black')
  assert.equal(sideOfPlayer(g({ white: 'x', black: 'y' }), me), null)
  assert.equal(sideOfPlayer(g({ white: 'Anna', black: 'anna_schach' }), me), null, 'both sides match: not decidable')
})

test('sideOfPlayer: the default name "Ich" never matches a foreign game', () => {
  assert.equal(sideOfPlayer(g({ white: 'Ich', black: 'bob' }), { name: DEFAULT_NAME, accounts: [] }), null)
})

test('resultFor: win/loss/draw from the view of the player, the raw result when the side is unknown, "abgebrochen" for a left game', () => {
  assert.equal(resultFor(g({ result: '1-0' }), 'white'), 'Sieg')
  assert.equal(resultFor(g({ result: '1-0' }), 'black'), 'Niederlage')
  assert.equal(resultFor(g({ result: '1/2-1/2' }), 'black'), 'Remis')
  assert.equal(resultFor(g({ result: '0-1' }), null), '0-1')
  assert.equal(resultFor(g({ result: '*', reason: 'abbruch' }), 'white'), 'abgebrochen')
  assert.equal(resultFor(g({ result: '*', reason: null }), null), 'offen')
})

test('displayName: the engine side shows its strength, the other names stay', () => {
  assert.equal(displayName(g({ white: 'Anna', black: 'Stockfish', ownSide: 'white', elo: 1500 }), 'black'), 'Stockfish (Elo 1500)')
  assert.equal(displayName(g({ white: 'Anna', black: 'Stockfish', ownSide: 'white', elo: 1500 }), 'white'), 'Anna')
  assert.equal(displayName(g({ white: 'alice', black: 'bob' }), 'black'), 'bob')
  const imported = g({ white: 'alice', black: 'bob', meta: { whiteElo: 1800, blackElo: null } as StoredGame['meta'] })
  assert.equal(displayName(imported, 'white'), 'alice (1800)', 'the rating of an imported player')
  assert.equal(displayName(imported, 'black'), 'bob')
})

test('the name and the accounts are part of the stored progress (export, import, garbage dropped)', () => {
  const p = emptyProgress()
  p.settings = { ...p.settings, player: { name: 'Anna', accounts: ['anna_schach'] } }
  assert.deepEqual(importProgress(exportProgress(p)).settings.player, { name: 'Anna', accounts: ['anna_schach'] })
  p.settings = { ...p.settings, player: { name: 5 as unknown as string, accounts: [1, 'ok'] as unknown as string[] } }
  assert.deepEqual(importProgress(exportProgress(p)).settings.player, { accounts: ['ok'] })
})

test('eloText: own game = strength of the engine; import = both ratings of the file; none = empty', () => {
  assert.equal(eloText(g({ ownSide: 'white', elo: 1500 })), '1500')
  assert.equal(eloText(g({ meta: { whiteElo: 1800, blackElo: 1750 } as StoredGame['meta'] })), '1800 · 1750')
  assert.equal(eloText(g({ meta: { whiteElo: 1800, blackElo: null } as StoredGame['meta'] })), '1800 · –')
  assert.equal(eloText(g({ meta: { whiteElo: null, blackElo: null } as StoredGame['meta'] })), '')
  assert.equal(eloText(g({})), '')
})

test('resultClass: win, loss, draw, left game, unknown - the colour comes on top of the text', () => {
  assert.deepEqual(['Sieg', 'Niederlage', 'Remis', 'abgebrochen', 'offen', '1-0'].map(resultClass), ['res-win', 'res-loss', 'res-draw', 'res-abort', 'res-abort', ''])
})
