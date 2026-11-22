import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FIGUREN } from '../src/teacher/avatar.ts'
import { lehrgangGefuehl } from '../src/lehrgang/mood.ts'

const base = { miss: false, solved: false, mistakes: 0, lob: false }

test('lehrgang mood: explaining is neutral, a right move is praised, a perfect run is celebrated', () => {
  for (const f of FIGUREN) {
    assert.equal(lehrgangGefuehl(f.id, base), 'neutral')
    assert.equal(lehrgangGefuehl(f.id, { ...base, lob: true }), 'freude')
    assert.equal(lehrgangGefuehl(f.id, { ...base, solved: true }), 'begeistert')
    assert.equal(lehrgangGefuehl(f.id, { ...base, solved: true, mistakes: 2 }), 'freude')
  }
})

test('lehrgang mood: a wrong move shows pity or anger by character and wins over praise', () => {
  const miss = (id: (typeof FIGUREN)[number]['id']) => lehrgangGefuehl(id, { ...base, miss: true, lob: true, solved: true })
  assert.deepEqual(FIGUREN.map((f) => [f.id, miss(f.id)]), [['mann', 'mitleid'], ['frau', 'aergerlich'], ['meister', 'mitleid'], ['fuchs', 'aergerlich']])
})
