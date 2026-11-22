import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { ecoEntriesFromTsv, parseEcoTable } from '../src/openings/eco.ts'
import { leiteNamen, wurzelName } from '../tools/lib/lehrgang-namen.ts'

const TSV = "eco\tname\tpgn\nC45\tScotch Game\t1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4\nC44\tKing's Knight Opening\t1. e4 e5 2. Nf3\nC50\tItalian Game\t1. e4 e5 2. Nf3 Nc6 3. Bc4\nC50\tScotch Game: Benima Defense\t1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5\n"
const eco = parseEcoTable({ entries: ecoEntriesFromTsv(TSV) })!
const DE = { 'Scotch Game': 'Schottisch' }
const line = (...sans: string[]) => { const c = new Chess(); return { zuege: sans.map((san) => { const m = c.move(san); return { san, uci: m.from + m.to } }) } }
const base = ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4']

test('namen: longest matching opening, German name, the deviating moves after it tell varieties apart', () => {
  const n = leiteNamen([{ id: 'a', ...line(...base, 'Bc5', 'Nxc6') }, { id: 'b', ...line(...base, 'Nf6', 'Nxc6') }], eco, DE)
  assert.equal(n.get('a'), 'Schottisch: 4…Lc5 5.Sxc6')
  assert.equal(n.get('b'), 'Schottisch: 4…Sf6 5.Sxc6')
})

test('namen: lines that differ only later get more of the deviation; a line that ends on the opening is just its name', () => {
  const n = leiteNamen([{ id: 'a', ...line(...base, 'Bc5', 'Nxc6', 'Qf6') }, { id: 'b', ...line(...base, 'Bc5', 'Nxc6', 'Nf6') }, { id: 'c', ...line(...base) }], eco, DE)
  assert.equal(n.get('a'), 'Schottisch: 4…Lc5 5.Sxc6 Df6')
  assert.equal(n.get('b'), 'Schottisch: 4…Lc5 5.Sxc6 Sf6')
  assert.equal(n.get('c'), 'Schottisch')
})

test('namen: without a German name the English one is used, and a line the table does not know gets no name', () => {
  const n = leiteNamen([{ id: 'a', ...line(...base, 'Bc5', 'Nxc6') }, { id: 'x', ...line('d4', 'd5') }], eco, {})
  assert.equal(n.get('a'), 'Scotch Game: 4…Lc5 5.Sxc6')
  assert.equal(n.has('x'), false)
})

test('namen: a name from another opening (transposition) is replaced by the opening of the Lehrgang plus the moves after it', () => {
  const entry = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']
  assert.equal(wurzelName(eco, entry), 'Italian Game')
  const n = leiteNamen([{ id: 'a', ...line(...entry, 'Bc5', 'c3') }], eco, { 'Italian Game': 'Italienisch', 'Scotch Game': 'Schottisch' }, 'Italian Game')
  assert.equal(n.get('a'), 'Italienisch: 3…Lc5 4.c3')
  // without the Lehrgang opening the table name stays (old behaviour)
  assert.equal(leiteNamen([{ id: 'a', ...line(...entry, 'Bc5', 'c3') }], eco, {}).get('a'), 'Scotch Game: Benima Defense: 4.c3')
})
