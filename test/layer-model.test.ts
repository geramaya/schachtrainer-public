import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LAYERS, TASK_LOCKED, activeLayers, isLocked, parseLayerSettings } from '../src/ui/layerSettings.ts'
import { layerModel, threatShapes } from '../src/chess/layerModel.ts'

const off = parseLayerSettings(null)
const on = (...ids: string[]) => ({ ...off, ...Object.fromEntries(ids.map((i) => [i, true])) })

test('all layers are off by default and unknown or damaged storage falls back to that', () => {
  assert.equal(LAYERS.length, 5)
  assert.deepEqual([...activeLayers(off, false)], [])
  assert.deepEqual(parseLayerSettings('not json'), off)
  assert.deepEqual(parseLayerSettings('{"hanging":true,"control":"yes","bogus":true}'), { ...off, hanging: true })
})

test('in an open task the layers that would reveal a win are locked, threats and reach stay', () => {
  assert.deepEqual([...TASK_LOCKED].sort(), ['control', 'counts', 'hanging'])
  const all = on('hanging', 'counts', 'control', 'threats', 'reach')
  assert.deepEqual([...activeLayers(all, true)].sort(), ['reach', 'threats'])
  assert.deepEqual([...activeLayers(all, false)].sort(), ['control', 'counts', 'hanging', 'reach', 'threats'])
  assert.equal(isLocked('hanging', true), true)
  assert.equal(isLocked('threats', true), false)
  assert.equal(isLocked('hanging', false), false)
})

const HANG = '4k3/8/2p5/3Q4/4P3/8/8/4K3 w - - 0 1' // Qd5 white (attacked by pawn c6), pawn c6 black (undefended, attacked by Q)

test('hanging pieces become rings, marked own or opponent from the point of view of the board orientation', () => {
  const white = layerModel(HANG, 'white', new Set(['hanging']))
  assert.deepEqual(white.rings.map((r) => `${r.square}:${r.own ? 'own' : 'opp'}`).sort(), ['c6:opp', 'd5:own'])
  const black = layerModel(HANG, 'black', new Set(['hanging']))
  assert.deepEqual(black.rings.map((r) => `${r.square}:${r.own ? 'own' : 'opp'}`).sort(), ['c6:own', 'd5:opp'])
  assert.deepEqual(layerModel(HANG, 'white', new Set()).rings, [])
})

test('count badges list attackers and defenders of pieces that have any', () => {
  const m = layerModel(HANG, 'white', new Set(['counts']))
  assert.deepEqual(m.badges.find((b) => b.square === 'd5'), { square: 'd5', attackers: 1, defenders: 1 })
  assert.equal(m.badges.find((b) => b.square === 'e1'), undefined, 'the quiet king has nothing to count')
})

test('control tints show who controls more, relative to the orientation, and nothing where it is even', () => {
  const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
  const w = layerModel(start, 'white', new Set(['control']))
  const f3 = w.tints.find((t) => t.square === 'f3')!
  assert.deepEqual([f3.own, f3.level], [true, 3])
  assert.equal(w.tints.find((t) => t.square === 'e4'), undefined)
  const b = layerModel(start, 'black', new Set(['control']))
  assert.equal(b.tints.find((t) => t.square === 'f3')!.own, false)
  assert.equal(w.tints.every((t) => t.level >= 1 && t.level <= 3), true)
})

test('reach shows the squares of the hovered piece only, marking those with a piece on them', () => {
  const fen = '4k3/8/8/3p4/4N3/8/8/4K3 w - - 0 1'
  assert.deepEqual(layerModel(fen, 'white', new Set(['reach'])).reach, [])
  const m = layerModel(fen, 'white', new Set(['reach']), 'e4')
  assert.deepEqual(m.reach.map((r) => r.square).sort(), ['c3', 'c5', 'd2', 'd6', 'f2', 'f6', 'g3', 'g5'])
  assert.equal(m.reach.every((r) => r.occupied === false), true)
  const n = layerModel('4k3/8/8/3p4/4N3/8/8/4K3 w - - 0 1', 'white', new Set(['reach']), 'd5')
  assert.deepEqual(n.reach.map((r) => r.square).sort(), ['c4', 'e4'])
  assert.equal(n.reach.find((r) => r.square === 'e4')!.occupied, true)
})

test('threat shapes: the side that would move after a pass threatens; opponent = red arrow, own side = blue arrow', () => {
  const white = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
  const t = [{ uci: 'd8h4', gainCp: 300 }, { uci: 'a7a5', gainCp: 200, mateIn: 2 }]
  assert.deepEqual(threatShapes(white, 'white', t), [
    { orig: 'd8', dest: 'h4', brush: 'opp' },
    { orig: 'a7', dest: 'a5', brush: 'opp', label: { text: '#2' } },
  ])
  assert.equal(threatShapes(white, 'black', t)[0]!.brush, 'own')
  assert.deepEqual(threatShapes(white, 'white', []), [])
})
