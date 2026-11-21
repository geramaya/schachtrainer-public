import { test } from 'node:test'
import assert from 'node:assert/strict'
import { heroPose, heroBubble, successSince, streakMark, gamesWonSince, heroImage } from '../src/train/hero.ts'
import type { StoredGame } from '../src/games/model.ts'

const visit = { at: 1_000, stagesDone: 3, streak: 2 }
const now = { stagesDone: 3, streak: 2, wins: 0 }

test('success since the last visit: finished stage, new streak mark or won game; nothing without a previous visit', () => {
  assert.equal(successSince(undefined, { stagesDone: 9, streak: 30, wins: 4 }), null)
  assert.equal(successSince(visit, now), null)
  assert.equal(successSince(visit, { ...now, stagesDone: 4 }), 'stage')
  assert.equal(successSince(visit, { ...now, streak: 3 }), 'streak')
  assert.equal(successSince(visit, { ...now, streak: 2, wins: 1 }), 'win')
  assert.equal(successSince(visit, { ...now, stagesDone: 2 }), null) // fewer finished stages (content rebuilt) is no success
})

test('a streak counts as a mark only when it passes 3, 7, 14, 30, 60 or 100 days since the last visit', () => {
  assert.deepEqual([0, 2, 3, 6, 7, 29, 30, 120].map(streakMark), [0, 0, 3, 3, 7, 14, 30, 100])
  assert.equal(successSince({ ...visit, streak: 3 }, { ...now, streak: 5 }), null) // grew, but within the same mark
  assert.equal(successSince({ ...visit, streak: 6 }, { ...now, streak: 7 }), 'streak')
})

test('pose: success wins over due cards, due cards over nothing due', () => {
  assert.equal(heroPose({ due: 5, success: 'win', firstVisit: false }), 'h3')
  assert.equal(heroPose({ due: 0, success: 'stage', firstVisit: false }), 'h3')
  assert.equal(heroPose({ due: 3, success: null, firstVisit: false }), 'h1')
  assert.equal(heroPose({ due: 0, success: null, firstVisit: false }), 'h2')
  assert.equal(heroPose({ due: 0, success: null, firstVisit: true }), 'h1') // first visit: the waving default
})

test('every pose has its image path and alt text', () => {
  assert.deepEqual(heroImage('h1'), { src: 'hero/ferro-h1.webp', alt: 'Ferro, der Fuchs-Professor, winkt dir mit einem Springer zu' })
  assert.match(heroImage('h2').alt, /Brett/)
  assert.match(heroImage('h3').alt, /Pokal/)
})

test('bubble text fits the situation and fills the number of due cards', () => {
  assert.equal(heroBubble({ due: 12, success: null, streak: 0, firstVisit: false }), '12 Karten sind fällig. Schnapp sie dir, bevor sie weglaufen.')
  assert.equal(heroBubble({ due: 1, success: null, streak: 0, firstVisit: false }), 'Eine Karte ist fällig. Nur eine. Der Fuchs kann warten, aber nicht ewig.')
  assert.equal(heroBubble({ due: 0, success: null, streak: 0, firstVisit: false }), 'Heute ist nichts fällig. Spiel trotzdem, ich hab Hunger auf Beute.')
  assert.equal(heroBubble({ due: 0, success: null, streak: 0, firstVisit: true }), 'Na, wieder da? Dann los, die Hühner warten nicht ewig.')
  assert.match(heroBubble({ due: 4, success: 'streak', streak: 7, firstVisit: false }), /7 Tage/)
  for (const s of ['stage', 'streak', 'win'] as const) {
    const t = heroBubble({ due: 2, success: s, streak: 3, firstVisit: false })
    assert.ok(t.length <= 90, t)
    assert.ok(!t.includes('{'), t)
  }
})

const game = (over: Partial<StoredGame>): StoredGame => ({ id: 'x', key: 'x', source: 'free', ownSide: 'white', result: '1-0', reason: null, date: new Date(5_000).toISOString(), white: 'Ich', black: 'Engine', ...over } as StoredGame)
const me = { name: 'Ich', accounts: [] }

test('won games since a time: own result Sieg, newer than the visit, imports and unfinished games excluded', () => {
  const games = [
    game({ id: 'a' }), game({ id: 'b', result: '0-1' }), game({ id: 'c', result: '1/2-1/2' }), game({ id: 'd', date: new Date(500).toISOString() }),
    game({ id: 'e', ownSide: 'black', result: '0-1' }), game({ id: 'f', source: 'import', date: new Date(9_000).toISOString() }), game({ id: 'g', result: '*', reason: 'abbruch' }),
  ]
  assert.equal(gamesWonSince(games, me, 1_000), 2)
  assert.equal(gamesWonSince(games, me, 6_000), 0)
  assert.equal(gamesWonSince([game({ date: 'kaputt' })], me, 1_000), 0)
})

test('success bubbles are the final lines and stay within 90 characters, also with a three-digit streak', () => {
  const b = (success: 'stage' | 'streak' | 'win', streak = 3) => heroBubble({ due: 2, success, streak, firstVisit: false })
  assert.equal(b('stage'), 'Eine Stufe fertig. Der Fuchs ist beeindruckt, und das will was heißen.')
  assert.equal(b('streak', 14), '14 Tage in Folge. Du bist hartnäckiger als ich am Hühnerstall.')
  assert.equal(b('win'), "Gewonnen, seit ich dich zuletzt sah. Ich tu so, als wär's mein Verdienst.")
  for (const t of [b('stage'), b('streak', 100), b('streak', 365), b('win'), heroBubble({ due: 1, success: null, streak: 0, firstVisit: false }), heroBubble({ due: 99, success: null, streak: 0, firstVisit: false })]) assert.ok(t.length <= 90, `${t.length}: ${t}`)
})
