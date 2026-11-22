import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { frequencyText } from '../src/lehrgang/frequency.ts'
import { einstufen, walkLehrgang, KERN_COUNT, ERWEITERUNG_CUM } from '../tools/lib/lehrgang.ts'
import type { ExplorerMove } from '../tools/lib/explorer.ts'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { erzeugeDaten } from '../tools/lib/lehrgang-daten.ts'

const fenAfter = (sans: string[]) => { const c = new Chess(); sans.forEach((s) => c.move(s)); return c.fen() }
const uci = (sans: string[], next: string) => { const c = new Chess(); sans.forEach((s) => c.move(s)); const m = c.move(next); return m.from + m.to + (m.promotion ?? '') }

/** Fake explorer: games per reply, keyed by the position before the reply. */
function fake(table: [string[], Record<string, number>][]) {
  const byFen = new Map(table.map(([sans, replies]) => [fenAfter(sans), Object.entries(replies).map(([san, games]): ExplorerMove => ({ uci: uci(sans, san), games }))]))
  const asked: string[] = []
  return { asked, replies: async (fen: string) => { asked.push(fen); return byFen.get(fen) ?? [] } }
}

test('frequencyText says "etwa x von 10" and stays honest for rare lines', () => {
  assert.equal(frequencyText(0.42), 'etwa 4 von 10')
  assert.equal(frequencyText(0.97), 'in fast jeder Partie')
  assert.equal(frequencyText(0.04), 'etwa 1 von 30')
  assert.equal(frequencyText(0.004), 'weniger als 1 von 100')
})

test('einstufen: Kern = the KERN_COUNT most frequent varieties; then Erweiterung until the cumulative share reaches 95 %, the rest is Nachschlagen', () => {
  assert.equal(KERN_COUNT, 6)
  assert.equal(ERWEITERUNG_CUM, 0.95)
  const items = [['a', 0.2], ['b', 0.18], ['c', 0.15], ['d', 0.12], ['e', 0.1], ['f', 0.08], ['g', 0.06], ['h', 0.04], ['i', 0.03], ['j', 0.02]].map(([id, anteil]) => ({ id: id as string, anteil: anteil as number }))
  const r = einstufen([...items].reverse())
  // sorted by share; cumulative before: .83 after f; g .83 (<.95) E; h .89 E; i .93 E; j .96 N
  assert.deepEqual(r.map((x) => [x.id, x.stufe]), [['a', 'kern'], ['b', 'kern'], ['c', 'kern'], ['d', 'kern'], ['e', 'kern'], ['f', 'kern'], ['g', 'erweiterung'], ['h', 'erweiterung'], ['i', 'erweiterung'], ['j', 'nachschlagen']])
  assert.deepEqual(einstufen([{ id: 'x', anteil: 0.5 }]).map((x) => x.stufe), ['kern'])
})

test('walkLehrgang follows the entry, plays own moves from the repertoire, asks the explorer only on opponent turns and multiplies the shares along the path', async () => {
  const ex = fake([
    [['e4', 'e5', 'Nf3', 'Nc6', 'd4'], { exd4: 80, Nf6: 20 }],
    [['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4'], { Nf6: 60, Bc5: 40 }],
  ])
  const r = await walkLehrgang({
    entry: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'], side: 'white', maxPly: 8, minPath: 0.02, minGames: 10,
    ownMove: (fen) => {
      const known = new Map([[fenAfter(['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4']), uci(['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4'], 'Nxd4')]])
      return known.get(fen) ?? null
    },
    replies: ex.replies,
  })
  const byLine = Object.fromEntries(r.varianten.map((v) => [v.line.slice(5).join(' '), v]))
  assert.equal(r.varianten.length, 3)
  assert.ok(Math.abs(byLine['exd4 Nxd4 Nf6']!.anteil - 0.48) < 1e-9)
  assert.ok(Math.abs(byLine['exd4 Nxd4 Bc5']!.anteil - 0.32) < 1e-9)
  assert.equal(byLine['exd4 Nxd4 Nf6']!.grund, 'tiefe')
  // Nf6 at move 5 is a rare reply without an own move in the repertoire: a gap, reported - not invented
  assert.equal(byLine['Nf6']!.grund, 'luecke')
  assert.ok(Math.abs(byLine['Nf6']!.anteil - 0.2) < 1e-9)
  // the explorer is asked on opponent turns only, never on own turns
  assert.ok(ex.asked.every((f) => f.split(' ')[1] === 'b' || f.split(' ')[1] === 'w'))
  assert.equal(ex.asked.length, 2)
})

test('walkLehrgang drops paths below minPath and leaves thin positions (fewer games than minGames) as leaves', async () => {
  const ex2 = fake([[['e4', 'c6'], { d4: 98, c4: 1 }]])
  const r = await walkLehrgang({
    entry: ['e4', 'c6'], side: 'black', maxPly: 6, minPath: 0.02, minGames: 10,
    ownMove: () => null, replies: async (fen) => (fen === fenAfter(['e4', 'c6']) ? ex2.replies(fen) : []),
  })
  // c4 (1 %) is below minPath: not listed; d4 is a leaf because the next position has no data / own move
  assert.deepEqual(r.varianten.map((v) => v.line.join(' ')), ['e4 c6 d4'])
  // thin data: the explorer knows fewer games than minGames, the position becomes a leaf marked as such
  const thin = await walkLehrgang({ entry: ['e4'], side: 'white', maxPly: 6, minPath: 0.02, minGames: 10, ownMove: () => null, replies: async () => [{ uci: 'e7e5', games: 3 }] })
  assert.deepEqual(thin.varianten.map((v) => [v.line.join(' '), v.grund]), [['e4', 'wenig-partien']])
})

test('walkLehrgang fails loudly when the explorer cannot answer (no half data)', async () => {
  await assert.rejects(
    walkLehrgang({ entry: ['e4'], side: 'white', maxPly: 4, minPath: 0.02, minGames: 1, ownMove: () => null, replies: async () => null }),
    /Explorer/,
  )
})

test('erzeugeDaten writes daten.json (tree, shares, tiers, date, thresholds) and merges tier and share into varianten.json; a second run gives the same files', async () => {
  const root = mkdtempSync(join(tmpdir(), 'lgd-'))
  try {
    const dir = join(root, 'x')
    mkdirSync(dir)
    writeFileSync(join(dir, 'lehrgang.json'), JSON.stringify({ id: 'x', name: 'X', side: 'white', entry: ['e4'], band: '1200–1600' }))
    writeFileSync(join(dir, 'varianten.json'), JSON.stringify([{ id: 'seed', name: 'TODO texter', stufe: 'kern', anteil: null, vorlaeufig: true, zuege: [{ san: 'e4', satz: 'TODO texter' }] }]))
    const ex = fake([[['e4'], { e5: 90, c5: 10 }]])
    const args = { dir, abruf: '2026-11-23', ownMove: () => null, replies: ex.replies }
    await erzeugeDaten(args)
    const daten = JSON.parse(readFileSync(join(dir, 'daten.json'), 'utf8'))
    assert.equal(daten.abruf, '2026-11-23')
    assert.equal(daten.band.ratings, '1200,1400,1600')
    assert.deepEqual(daten.schwellen, { kernAnzahl: 6, erweiterung: 0.95, minPfad: 0.02, maxPly: 20, minPartien: 30 })
    assert.deepEqual(daten.varianten.map((v: { line: string[]; stufe: string }) => [v.line.join(' '), v.stufe]), [['e4 e5', 'kern'], ['e4 c5', 'kern']])
    assert.ok(Math.abs(daten.abdeckung - 1) < 1e-9)
    assert.equal(daten.baum.length, 2)
    const vj = JSON.parse(readFileSync(join(dir, 'varianten.json'), 'utf8'))
    assert.equal(vj.length, 2)
    assert.ok(vj.every((v: { vorlaeufig?: boolean }) => !v.vorlaeufig))
    const first = [readFileSync(join(dir, 'daten.json'), 'utf8'), readFileSync(join(dir, 'varianten.json'), 'utf8')]
    await erzeugeDaten(args)
    assert.deepEqual([readFileSync(join(dir, 'daten.json'), 'utf8'), readFileSync(join(dir, 'varianten.json'), 'utf8')], first)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

import { cacheReplies } from '../tools/lib/lehrgang-daten.ts'

test('cacheReplies serves the explorer cache without token or network: castling normalised, a missing position is null (the walk then stops loudly)', async () => {
  const root = mkdtempSync(join(tmpdir(), 'lgc-'))
  try {
    const fen = 'r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1'
    writeFileSync(join(root, 'c.json'), JSON.stringify({ [fen]: [{ uci: 'e8h8', games: 5 }, { uci: 'a8a1', games: 2 }] }))
    const r = cacheReplies(join(root, 'c.json'))
    assert.deepEqual(await r(fen), [{ uci: 'e8g8', games: 5 }, { uci: 'a8a1', games: 2 }])
    assert.equal(await r('8/8/8/8/8/8/8/8 w - - 0 1'), null)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
