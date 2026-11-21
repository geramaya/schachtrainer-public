import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { positionKey } from '../src/chess/position.ts'
import { parseOpeningsTsv } from '../tools/lib/sources.ts'
import { buildTree } from '../tools/lib/build-tree.ts'
import type { OpeningSpec } from '../content-src/openings.ts'
import { fakeEngine, fenAfter } from './fake-engine.ts'

const opts = { ownPlies: 24, branchExtraOwnMoves: 4, vetoCp: 100 }
const spec: OpeningSpec = {
  id: 'scotch', name: 'Schottisch', side: 'white',
  entry: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'], role: 'Main', docRef: 'doc',
  ownChoices: { 'e4 e5 Nf3 Nc6 d4 exd4': [{ san: 'Nxd4' }, { san: 'Bc4', label: 'Schottisches Gambit' }] },
  variationNames: ['Scotch Game'],
}
const P = 'e4 e5 Nf3 Nc6 d4 exd4'
const tsv = [
  'eco\tname\tpgn',
  `C45\tScotch Game: Classical Variation\t1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Bc5`,
  `C45\tScotch Game: Schmidt Variation\t1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Nf6`,
  `C44\tScotch Game: Scotch Gambit\t1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Bc4`,
  `C44\tScotch Game: Goering Gambit\t1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. c3`,
  `C45\tScotch Game: Order A\t1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Nf6 5. Nc3 Bc5`,
  `C45\tScotch Game: Order B\t1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Bc5 5. Nc3 Nf6`,
  `B01\tScandinavian Defense\t1. e4 d5`,
].join('\n')
const lines = parseOpeningsTsv(tsv)

test('parseOpeningsTsv converts PGN to UCI and skips the header', () => {
  assert.equal(lines.length, 7)
  assert.equal(lines[0]!.name, 'Scotch Game: Classical Variation')
  assert.deepEqual(lines[0]!.uci.slice(-2), ['f3d4', 'f8c5'])
})

const keys = (sans: string[]) => positionKey(fenAfter(sans))
const START = 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4'.split(' ')

test('transposed move orders end in one node', async () => {
  const eng = fakeEngine()
  const { nodes } = await buildTree(spec, lines, eng, opts)
  const a = ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Nf6', 'Nc3', 'Bc5']
  const b = ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Bc5', 'Nc3', 'Nf6']
  assert.equal(keys(a), keys(b))
  const n = nodes[keys(a)]
  assert.ok(n, 'transposed end position has a node')
  assert.equal(n.ownMove, true)
  // both orders reach distinct intermediate nodes, the end node exists once
  assert.ok(nodes[keys(a.slice(0, 9))] && nodes[keys(b.slice(0, 9))])
  assert.notEqual(keys(a.slice(0, 9)), keys(b.slice(0, 9)))
})

test('document choice beats theory move, second choice carries label', async () => {
  const { nodes } = await buildTree(spec, lines, fakeEngine(), opts)
  const n = nodes[keys(P.split(' '))]!
  assert.deepEqual(n.candidates.slice(0, 2).map((c) => c.san), ['Nxd4', 'Bc4'])
  assert.equal(n.active, 0)
  assert.equal(n.candidates[0]!.source.kind, 'dokument')
  assert.equal(n.candidates[1]!.label, 'Schottisches Gambit')
  // 4.c3 is neither document choice nor allowed: its branch is not built
  assert.equal(nodes[keys([...P.split(' '), 'c3'])], undefined)
})

test('opponent replies of all matching lines are collected, other openings ignored', async () => {
  const { nodes } = await buildTree(spec, lines, fakeEngine(), opts)
  const n = nodes[keys(START)]!
  assert.equal(n.ownMove, false)
  assert.deepEqual(n.replies.map((r) => r.san).sort(), ['Bc5', 'Nf6'])
  assert.ok(n.replies.every((r) => r.source.kind === 'chess-openings'))
  assert.equal(nodes[keys(['e4', 'd5'])], undefined)
})

test('veto replaces a theory move that loses more than vetoCp, keeps one within it', async () => {
  const before = START.concat(['Nf6'])
  const afterNc3 = fenAfter([...before, 'Nc3'])
  const eng = fakeEngine({
    [keys(before)]: { lines: [{ uci: 'd4c6', cp: 50 }] },
    // black to move after 5.Nc3 and is +300: theory move costs white 350 cp
    [positionKey(afterNc3)]: { lines: [{ uci: 'f6e4', cp: 300 }] },
  })
  const { nodes, vetoes } = await buildTree(spec, lines, eng, opts)
  const n = nodes[keys(before)]!
  assert.equal(n.candidates[n.active]!.uci, 'd4c6')
  assert.equal(n.candidates[n.active]!.source.kind, 'stockfish')
  assert.equal(vetoes.length, 1)
  assert.equal(vetoes[0]!.theoryUci, 'b1c3')
  assert.ok(eng.calls.every((c) => c.depth === 18))
  // the other theory own move (4.Nxd4 is a document move; 5.Nc3 after ...Bc5) stays
  const m = nodes[keys(START.concat(['Bc5']))]!
  assert.equal(m.candidates[m.active]!.san, 'Nc3')
  assert.equal(m.candidates[m.active]!.source.kind, 'chess-openings')
})

test('leaf after opponent move gets the engine best move, own ply limit stops the walk', async () => {
  const leaf = keys(['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Bc5', 'Nc3', 'Nf6'])
  const eng = fakeEngine({ [leaf]: { lines: [{ uci: 'c1e3', cp: 20 }] } })
  const { nodes } = await buildTree(spec, lines, eng, opts)
  assert.equal(nodes[leaf]!.candidates[0]!.uci, 'c1e3')
  assert.equal(nodes[leaf]!.candidates[0]!.source.kind, 'stockfish')
  const short = await buildTree(spec, lines, fakeEngine(), { ...opts, ownPlies: 7 })
  assert.equal(short.nodes[keys(START)], undefined)
  assert.ok(short.nodes[keys(START.slice(0, 6))])
})

test('engine principal variation extends a leaf by at most branchExtraOwnMoves own moves', async () => {
  const leaf = keys(['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Bc5', 'Nc3', 'Nf6'])
  const pv = ['c1e3', 'd7d6', 'f1e2', 'e8g8', 'e1g1', 'a7a6', 'h2h3']
  const run = (n: number) =>
    buildTree(spec, lines, fakeEngine({ [leaf]: { lines: [{ uci: 'c1e3', cp: 20, pv }] } }), { ...opts, branchExtraOwnMoves: n })
  const base = (await run(0)).nodes
  const two = (await run(2)).nodes
  // each extra own move adds an opponent node (with the PV reply) and an own node
  assert.equal(Object.keys(two).length - Object.keys(base).length, 4)
  const n1 = two[positionKey(fenAfter([...'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5 Nc3 Nf6'.split(' '), 'Be3']))]!
  assert.deepEqual(n1.replies.map((r) => r.uci), ['d7d6'])
  const last = two[positionKey(fenAfter([...'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5 Nc3 Nf6 Be3 d6 Be2 O-O'.split(' ')]))]!
  assert.equal(last.candidates[0]!.uci, 'e1g1')
})

test('variations are the distinct named lines that survive the tree', async () => {
  const { variations } = await buildTree(spec, lines, fakeEngine(), opts)
  const names = variations.map((v) => v.nameEn)
  assert.ok(names.includes('Scotch Game: Classical Variation'))
  assert.ok(names.includes('Scotch Game: Scotch Gambit'))
  assert.ok(!names.includes('Scotch Game: Goering Gambit'))
  const classical = variations.find((v) => v.nameEn === 'Scotch Game: Classical Variation')!
  assert.deepEqual(classical.line.slice(-2), ['Nxd4', 'Bc5'])
  assert.equal(classical.id, 'scotch-game-classical-variation')
  assert.equal(classical.keyPositions.at(-1), keys(START.concat(['Bc5'])))
  assert.equal(variations.find((v) => v.nameEn === 'Scotch Game: Scotch Gambit')!.fromDocument, true)
  assert.equal(classical.fromDocument, false)
})

test('terminal positions are never sent to the engine and score as mate', async () => {
  const scholar = parseOpeningsTsv([
    'eco\tname\tpgn',
    'C20\tScholars Mate\t1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#',
  ].join('\n'))
  const sp: OpeningSpec = { ...spec, id: 'scotch', entry: ['e4'], ownChoices: {}, variationNames: ['Scholars'] }
  const eng = fakeEngine()
  const { nodes, variations } = await buildTree(sp, scholar, eng, opts)
  const before = nodes[keys(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6'])]!
  assert.equal(before.candidates[0]!.san, 'Qxf7#')
  assert.equal(before.candidates[0]!.evalCp, 10000)
  assert.equal(variations.length, 1)
  assert.ok(nodes[variations[0]!.keyPositions[0]!], 'the mated end position has a node')
  assert.equal(eng.calls.length > 0, true)
})

test('theory alternatives stay as inactive candidates without a subtree and are reported', async () => {
  const { nodes, dropped } = await buildTree(spec, lines, fakeEngine(), opts)
  const n = nodes[keys(P.split(' '))]!
  assert.deepEqual(n.candidates.map((c) => c.san), ['Nxd4', 'Bc4', 'c3'])
  assert.equal(n.candidates[2]!.source.kind, 'chess-openings')
  assert.equal(n.candidates[2]!.label, undefined)
  assert.equal(n.active, 0)
  assert.equal(nodes[keys([...P.split(' '), 'c3'])], undefined)
  assert.ok(dropped.some((d) => d.name === 'Scotch Game: Goering Gambit'), JSON.stringify(dropped))
  assert.ok(!dropped.some((d) => d.name === 'Scotch Game: Classical Variation'))
})

test('document choices are matched by position, so a transposed order still hits them', async () => {
  const tr = parseOpeningsTsv(['eco\tname\tpgn', 'C60\tTest Line\t1. Nf3 Nc6 2. e4 e5 3. Bc4'].join('\n'))
  const sp: OpeningSpec = {
    ...spec, entry: [], variationNames: ['Test'],
    ownChoices: { 'e4 e5 Nf3 Nc6': [{ san: 'Bb5' }] },
  }
  const { nodes } = await buildTree(sp, tr, fakeEngine(), opts)
  const n = nodes[keys(['Nf3', 'Nc6', 'e4', 'e5'])]!
  assert.equal(n.candidates[0]!.san, 'Bb5')
  assert.equal(n.candidates[0]!.source.kind, 'dokument')
  assert.deepEqual(n.candidates.map((c) => c.san), ['Bb5', 'Bc4'])
})

test('a veto marks the replaced theory move with a note, not with a label', async () => {
  const before = START.concat(['Nf6'])
  const eng = fakeEngine({
    [keys(before)]: { lines: [{ uci: 'd4c6', cp: 50 }] },
    [positionKey(fenAfter([...before, 'Nc3']))]: { lines: [{ uci: 'f6e4', cp: 300 }] },
  })
  const { nodes } = await buildTree(spec, lines, eng, opts)
  const vetoed = nodes[keys(before)]!.candidates.find((c) => c.uci === 'b1c3')!
  assert.equal(vetoed.label, undefined)
  assert.match(vetoed.note!, /Veto/)
})

test('extra document entries add deviation lines with the document move, without new variations', async () => {
  const sp: OpeningSpec = { ...spec, extraEntries: [['e4', 'e5', 'Nf3', 'd6', 'd4']] }
  const { nodes, variations } = await buildTree(sp, lines, fakeEngine(), opts)
  const afterNf3 = nodes[keys(['e4', 'e5', 'Nf3'])]!
  assert.deepEqual(afterNf3.replies.map((r) => r.san).sort(), ['Nc6', 'd6'])
  const own = nodes[keys(['e4', 'e5', 'Nf3', 'd6'])]!
  assert.equal(own.candidates[0]!.san, 'd4')
  assert.equal(own.candidates[0]!.source.kind, 'dokument')
  assert.equal(variations.length, (await buildTree(spec, lines, fakeEngine(), opts)).variations.length)
})

test('extraVariations become variations with the document line, even without a chess-openings name', async () => {
  const withExtra: OpeningSpec = {
    ...spec,
    extraVariations: [{ name: 'Falle', nameEn: 'Trap', line: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Bc5', 'Nxc6'] }],
  }
  const { variations, nodes } = await buildTree(withExtra, lines, fakeEngine(), opts)
  const v = variations.find((x) => x.id === 'trap')
  assert.ok(v, 'variation trap exists')
  assert.equal(v.name, 'Falle')
  assert.deepEqual(v.line.slice(-2), ['Bc5', 'Nxc6'])
  assert.equal(v.fromDocument, true)
  assert.ok(nodes[keys(['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Bc5'])], 'nodes along the line exist')
})

test('deepening: every variation line reaches minPlies and every own node on the way has a candidate', async () => {
  const eng = fakeEngine()
  const { variations, nodes } = await buildTree(spec, lines, eng, { ...opts, minPlies: 28, maxPlies: 36, nodeBudget: 600 })
  assert.ok(variations.length > 0)
  for (const v of variations) assert.ok(v.line.length >= 28, `${v.id} has ${v.line.length} plies`)
  for (const n of Object.values(nodes)) {
    if (n.ownMove && new Chess(n.fen).moves().length > 0) assert.ok(n.candidates.length > 0, `own node without candidate: ${n.key}`)
  }
  const classical = variations.find((v) => v.nameEn === 'Scotch Game: Classical Variation')!
  assert.deepEqual(classical.line.slice(0, 8), ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Bc5'])
  assert.equal(classical.keyPositions[0], positionKey(replay(classical.line)))
})

test('deepening: behind the named line the first opponent moves get up to two more answers within the tolerance', async () => {
  const flat = fakeEngine()
  const eng = {
    ...flat,
    async analyse(fen: string, o: { depth: number; multipv?: number }) {
      const moves = new Chess(fen).moves({ verbose: true }).slice(0, o.multipv ?? 1)
      const ls = moves.map((m, i) => ({ uci: m.from + m.to + (m.promotion ?? ''), cp: -i * 10, mate: null, pv: [] as string[] }))
      return { bestUci: ls[0]!.uci, lines: ls, depth: o.depth }
    },
  }
  const { nodes } = await buildTree(spec, lines, eng, { ...opts, minPlies: 28, branchMoves: 2, branchWithinCp: 60, branchPlies: 24 })
  const branching = Object.values(nodes).filter((n) => !n.ownMove && n.replies.length === 3)
  assert.ok(branching.length >= 1, 'an opponent node with the best answer plus two more')
  const tight = await buildTree(spec, lines, eng, { ...opts, minPlies: 28, branchMoves: 2, branchWithinCp: 5, branchPlies: 24 })
  assert.equal(Object.values(tight.nodes).filter((n) => !n.ownMove && n.replies.length === 3).length, 0, 'tolerance 5 cp admits no -10 cp answer')
})

test('deepening is off without minPlies: lines stay as named', async () => {
  const { variations } = await buildTree(spec, lines, fakeEngine(), opts)
  assert.equal(variations.find((v) => v.nameEn === 'Scotch Game: Classical Variation')!.line.length, 8)
})

function replay(sans: string[]): string {
  const g = new Chess()
  for (const m of sans) g.move(m)
  return g.fen()
}

test('deepening: the opponent move is the most frequent explorer move (>= 20 games), else the engine answer', async () => {
  const asked: string[] = []
  const explorer = async (fen: string) => {
    asked.push(fen)
    const moves = new Chess(fen).moves({ verbose: true })
    const last = moves[moves.length - 1]!
    return [{ uci: last.from + last.to + (last.promotion ?? ''), games: 100 }, { uci: 'zzzz', games: 5 }]
  }
  const withEx = await buildTree(spec, lines, fakeEngine(), { ...opts, minPlies: 28, explorer })
  assert.ok(asked.length > 0)
  const c = withEx.variations.find((v) => v.nameEn === 'Scotch Game: Classical Variation')!
  const plain = await buildTree(spec, lines, fakeEngine(), { ...opts, minPlies: 28 })
  const p = plain.variations.find((v) => v.nameEn === 'Scotch Game: Classical Variation')!
  assert.notDeepEqual(c.line.slice(8), p.line.slice(8), 'explorer move differs from the engine fallback')
  const rare = await buildTree(spec, lines, fakeEngine(), { ...opts, minPlies: 28, explorer: async () => [{ uci: 'a7a6', games: 19 }] })
  assert.deepEqual(rare.variations.find((v) => v.nameEn === 'Scotch Game: Classical Variation')!.line, p.line)
})

// --- repertoire side black: the opponent moves first, own nodes are the positions with black to move
const kid: OpeningSpec = {
  id: 'kings-indian', name: 'KID', side: 'black', entry: ['c4', 'g6', 'Nf3', 'Bg7'], role: 'Fallback', docRef: 'doc',
  ownChoices: { 'Nf3 g6 c4': [{ san: 'Bg7' }] }, variationNames: ['Kings Indian'],
}
const kidLines = parseOpeningsTsv([
  'eco\tname\tpgn',
  'A07\tKings Indian Attack: A\t1. c4 g6 2. Nf3 Bg7 3. g3 Nf6',
  'A07\tKings Indian Attack: B\t1. Nf3 g6 2. c4 Bg7 3. d4 d6',
].join('\n'))

test('black: the start position is an answer node, black-to-move positions are own nodes', async () => {
  const { nodes } = await buildTree(kid, kidLines, fakeEngine(), opts)
  const start = nodes[keys([])]!
  assert.equal(start.ownMove, false)
  assert.deepEqual(start.replies.map((r) => r.san).sort(), ['Nf3', 'c4'])
  const afterC4 = nodes[keys(['c4'])]!
  assert.equal(afterC4.ownMove, true)
  assert.equal(afterC4.candidates[0]!.san, 'g6')
  assert.ok(Object.values(nodes).every((n) => n.ownMove === (n.fen.split(' ')[1] === 'b')))
})

test('black: 1.c4 g6 2.Nf3 and 1.Nf3 g6 2.c4 reach one node with the document choice Bg7', async () => {
  const { nodes } = await buildTree(kid, kidLines, fakeEngine(), opts)
  const a = keys(['c4', 'g6', 'Nf3'])
  assert.equal(a, keys(['Nf3', 'g6', 'c4']))
  const n = nodes[a]!
  assert.equal(n.ownMove, true)
  assert.equal(n.candidates[n.active]!.san, 'Bg7')
  assert.equal(n.candidates[n.active]!.source.kind, 'dokument')
})

test('black: lines are extended past the line end with own and opponent moves', async () => {
  const { nodes, variations } = await buildTree(kid, kidLines, fakeEngine(), { ...opts, minPlies: 14, maxPlies: 20 })
  assert.ok(variations.length > 0)
  const own = Object.values(nodes).filter((n) => n.ownMove && n.candidates.length > 0).length
  assert.ok(own >= 6, `own nodes: ${own}`)
  assert.ok(Object.values(nodes).every((n) => !n.ownMove || n.candidates.length > 0 || new Chess(n.fen).moves().length === 0))
})

test('extraVariations: the node of the last position exists; a mate end is a node without engine call', async () => {
  const mateLine = ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#']
  const withMate: OpeningSpec = { ...spec, entry: ['e4', 'e5'], extraVariations: [{ name: 'Matt', nameEn: 'Mate', line: mateLine }] }
  const eng = fakeEngine()
  const { variations, nodes } = await buildTree(withMate, lines, eng, { ...opts, minPlies: 28, maxPlies: 36, nodeBudget: 600 })
  const v = variations.find((x) => x.id === 'mate')!
  assert.deepEqual(v.line, mateLine, 'game over: not extended')
  const endKey = keys(mateLine)
  assert.deepEqual(v.keyPositions, [endKey])
  assert.ok(nodes[endKey], 'end node exists')
  assert.equal(nodes[endKey]!.candidates.length, 0)
})

test('extraVariations: a hand line without game end is deepened to minPlies and keeps its end node', async () => {
  const hand = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']
  const withHand: OpeningSpec = { ...spec, entry: ['e4', 'e5'], extraVariations: [{ name: 'Hand', nameEn: 'Hand', line: hand }] }
  const { variations, nodes } = await buildTree(withHand, lines, fakeEngine(), { ...opts, minPlies: 28, maxPlies: 36, nodeBudget: 600 })
  const v = variations.find((x) => x.id === 'hand')!
  assert.deepEqual(v.line.slice(0, 6), hand)
  assert.ok(v.line.length >= 28, `has ${v.line.length} plies`)
  assert.ok(nodes[v.keyPositions[0]!], 'end node exists')
})

const altEngine = () => {
  const flat = fakeEngine()
  return {
    ...flat,
    async analyse(fen: string, o: { depth: number; multipv?: number }) {
      const moves = new Chess(fen).moves({ verbose: true }).slice(0, o.multipv ?? 1)
      const ls = moves.map((m, i) => ({ uci: m.from + m.to + (m.promotion ?? ''), cp: -i * 10, mate: null, pv: [] as string[] }))
      return { bestUci: ls[0]!.uci, lines: ls, depth: o.depth }
    },
  }
}

test('node budget: main lines of all variations reach minPlies even with a tiny budget', async () => {
  const { variations } = await buildTree(spec, lines, fakeEngine(), { ...opts, minPlies: 28, maxPlies: 36, nodeBudget: 5 })
  assert.ok(variations.length > 0)
  for (const v of variations) assert.ok(v.line.length >= 28, `${v.id} has ${v.line.length} plies`)
})

test('node budget: it limits only the alternatives, which come after all main lines', async () => {
  const base = { ...opts, minPlies: 28, maxPlies: 36, branchWithinCp: 60, branchPlies: 24 }
  const mainOnly = await buildTree(spec, lines, altEngine(), { ...base, branchMoves: 0, nodeBudget: 600 })
  const mainCount = Object.keys(mainOnly.nodes).length
  const capped = await buildTree(spec, lines, altEngine(), { ...base, branchMoves: 2, nodeBudget: mainCount })
  assert.equal(Object.keys(capped.nodes).length, mainCount, 'no alternative fits into a budget the main lines already use up')
  const open = await buildTree(spec, lines, altEngine(), { ...base, branchMoves: 2, nodeBudget: 600 })
  assert.ok(Object.keys(open.nodes).length > mainCount, 'with room the alternatives are added')
})

import { endReason } from '../tools/lib/build-tree.ts'

const legalMoves = (fen: string) => new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ''))
const REP = ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1']
const repSpec: OpeningSpec = { ...spec, entry: ['Nf3'], ownChoices: {}, variationNames: [], extraVariations: [{ name: 'Rep', nameEn: 'Rep', line: REP }] }
const repExplorer = (onlyRepeat: boolean) => async (fen: string) => {
  const all = legalMoves(fen).map((u) => ({ uci: u, games: u === 'f6g8' ? 100 : 50 }))
  return onlyRepeat ? all.filter((m) => m.uci === 'f6g8') : all.sort((a, b) => b.games - a.games)
}

test('endReason names mate, stalemate and the draws; a running game has none', () => {
  assert.equal(endReason(new Chess()), null)
  const rep = new Chess()
  for (const m of [...REP, 'Ng8']) rep.move(m)
  assert.equal(endReason(rep), 'Remis durch Wiederholung')
  const mate = new Chess()
  for (const m of ['f3', 'e5', 'g4', 'Qh4#']) mate.move(m)
  assert.equal(endReason(mate), 'Matt')
})

test('line end: the opponent move that completes a threefold repetition is skipped for a sound alternative', async () => {
  const { variations } = await buildTree(repSpec, lines, fakeEngine(), { ...opts, minPlies: 28, maxPlies: 36, explorer: repExplorer(false) })
  const v = variations.find((x) => x.id === 'rep')!
  assert.notEqual(v.line[7], 'Ng8', 'no repetition although the explorer favours it')
  assert.ok(v.line.length >= 28, `has ${v.line.length} plies`)
})

test('line end: without an alternative the line ends at the repetition and the end reason says so', async () => {
  const stuck = fakeEngine({ [keys(REP)]: { lines: [{ uci: 'f6g8', cp: 0 }] } })
  const r = await buildTree(repSpec, lines, stuck, { ...opts, minPlies: 28, maxPlies: 36, explorer: repExplorer(true) })
  const v = r.variations.find((x) => x.id === 'rep')!
  assert.equal(v.line.length, 8)
  assert.equal(r.ends.find((e) => e.id === 'rep')!.reason, 'Remis durch Wiederholung')
})

const nestedTsv = (extra: string[]) => parseOpeningsTsv(['eco\tname\tpgn', ...extra].join('\n'))
const ALPHA = '1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Bc5'
const detour = async (fen: string) => {
  const all = legalMoves(fen).map((u) => ({ uci: u, games: u === 'd8f6' ? 100 : 50 }))
  return all.sort((a, b) => b.games - a.games)
}

const twoMoves = (alt: number) => async (fen: string) => {
  const top = legalMoves(fen).includes('d8f6') ? 'd8f6' : null
  const second = legalMoves(fen).includes('b7c6') ? 'b7c6' : null
  return top && second ? [{ uci: top, games: 1000 }, { uci: second, games: alt }] : legalMoves(fen).slice(0, 1).map((u) => ({ uci: u, games: 1000 }))
}
const nested = () => nestedTsv([`C45\tScotch Game: Alpha\t${ALPHA}`, `C45\tScotch Game: Alpha, Beta\t${ALPHA} 5. Nxc6 Qf6`])
const nestedRun = (explorer: ((fen: string) => Promise<{ uci: string; games: number }[] | null>) | undefined, engine = fakeEngine()) =>
  buildTree(spec, nested(), engine, { ...opts, minPlies: 28, maxPlies: 36, ...(explorer ? { explorer } : {}) })
const pair = (variations: Awaited<ReturnType<typeof nestedRun>>['variations']) => ({
  a: variations.find((v) => v.nameEn === 'Scotch Game: Alpha')!, b: variations.find((v) => v.nameEn === 'Scotch Game: Alpha, Beta')!,
})

test('redirect: a move with >= 10 % share and >= 50 games steers the shorter variation away from the longer one', async () => {
  const r = await nestedRun(twoMoves(200))
  const { a, b } = pair(r.variations)
  assert.equal(b.line[9], 'Qf6')
  assert.equal(a.line[9], 'bxc6')
  assert.equal(a.partOf, undefined)
  assert.equal(r.redirects.length, 1)
  assert.deepEqual({ uci: r.redirects[0]!.uci, games: r.redirects[0]!.games }, { uci: 'b7c6', games: 200 })
  assert.ok(Math.abs(r.redirects[0]!.share! - 200 / 1200) < 1e-9)
})

test('redirect: a rare alternative (< 10 % share or < 50 games) is not worth it, the variation becomes a stage of the longer one', async () => {
  for (const alt of [60, 40]) {
    const { a, b } = pair((await nestedRun(twoMoves(alt))).variations)
    assert.equal(a.partOf, b.id, `alt ${alt}`)
    assert.equal(a.line[9], 'Qf6')
  }
})

test('redirect: without explorer data the second best engine move is taken only when at most 50 cp behind', async () => {
  const at = keys(['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Bc5', 'Nxc6'])
  const engineWith = (gap: number) => fakeEngine({ [at]: { lines: [{ uci: 'd8f6', cp: 0 }, { uci: 'b7c6', cp: -gap }] } })
  const near = pair((await nestedRun(undefined, engineWith(10))).variations)
  assert.equal(near.a.partOf, undefined)
  assert.equal(near.a.line[9], 'bxc6')
  const far = pair((await nestedRun(undefined, engineWith(100))).variations)
  assert.equal(far.a.partOf, far.b.id)
})

test('identical lines: the less specific variation becomes a stage of the other instead of a twin', async () => {
  const twins = nestedTsv([`C45\tScotch Game: Gamma\t1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Nf6`, `C45\tScotch Game: Gamma, Delta\t1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Nf6`])
  const { variations } = await buildTree(spec, twins, fakeEngine(), { ...opts, minPlies: 28, maxPlies: 36 })
  const a = variations.find((v) => v.nameEn === 'Scotch Game: Gamma')!
  const b = variations.find((v) => v.nameEn === 'Scotch Game: Gamma, Delta')!
  assert.equal(a.partOf, b.id)
  assert.equal(b.partOf, undefined)
})

test('identical lines with equally long names: exactly one becomes a stage of the other', async () => {
  const twins = nestedTsv([`C45\tScotch Game: Eps\t1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Nf6`, `C45\tScotch Game: Zet\t1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Nf6`])
  const { variations } = await buildTree(spec, twins, fakeEngine(), { ...opts, minPlies: 28, maxPlies: 36 })
  const twin = variations.filter((v) => v.nameEn === 'Scotch Game: Eps' || v.nameEn === 'Scotch Game: Zet')
  assert.equal(twin.length, 2)
  assert.equal(twin.filter((v) => v.partOf).length, 1)
})
