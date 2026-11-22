import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { baueAufgabe, evalKey } from '../tools/lib/lehrgang-aufgaben.ts'
import type { AnalysisStore } from '../tools/lib/lehrgang-aufgaben.ts'
import { eindeutigeStellungen } from '../tools/lib/lehrgang-stellungen.ts'
import { pruefeBewertungsworte, pruefeSpielplan, pruefeStellungen } from '../tools/lib/lehrgang-check.ts'
import type { StellungenFile } from '../tools/lib/lehrgang-build.ts'

const fenOf = (sans: string[]) => { const c = new Chess(); sans.forEach((s) => c.move(s)); return c.fen() }
const analysis: AnalysisStore = Object.fromEntries([[[], 30], [['e4'], -25], [['e4', 'e5'], 35], [['e4', 'e5', 'Nf3'], -30]].map(([sans, cp]) => [evalKey(fenOf(sans as string[])), { bestUci: 'e2e4', depth: 18, lines: [{ uci: 'e2e4', cp: cp as number, mate: null, pv: [] }] }]))
const opening = { id: 'scotch' as const, side: 'white' as const, entry: ['e4', 'e5'], docRef: 'docs/repertoire-v1.8.md' }
const st = eindeutigeStellungen([{ id: 'a', anteil: 0.4, zuege: ['e4', 'e5', 'Nf3'].map((san) => ({ san })) }], 'white')
const aufgaben = st.map((s) => baueAufgabe(s, { opening, analysis, explorer: {}, dokument: [], luecken: new Set() }))
const key = (san: string) => st.find((s) => s.san === san)!.schluessel
const file = (san: string, satz: string, belege: string[] = []): StellungenFile => ({ [key(san)]: { satz, status: 'entwurf', belege } })

test('check: a sentence that fits its fact sheet passes', () => {
  assert.deepEqual(pruefeStellungen(file('e4', 'Du besetzt mit e4 das Zentrum.'), aufgaben), [])
  assert.deepEqual(pruefeStellungen(file('Nf3', 'Der Springer greift den Bauern auf e5 an.'), aufgaben), [])
})

test('check: wrong move, wrong evaluation direction, a move fact that did not happen and an unknown position are reported with the position', () => {
  const bad = pruefeStellungen(file('e4', 'Du spielst 1. d4 und stehst klar besser.'), aufgaben).join('\n')
  assert.match(bad, /d4/)
  assert.match(bad, /passt nicht|Bewertung/)
  assert.match(pruefeStellungen(file('e4', 'Du rochierst und bringst den König in Sicherheit.'), aufgaben).join('\n'), /rochier/i)
  assert.match(pruefeStellungen(file('Nf3', 'Du schlägst die Dame.'), aufgaben).join('\n'), /schlägt|Schlagzug/)
  assert.match(pruefeStellungen({ 'x|y': { satz: 'Egal.', status: 'entwurf' } }, aufgaben).join('\n'), /nicht in aufgaben/)
  assert.match(pruefeStellungen(file('e4', 'Idee: Zentrum.'), aufgaben).join('\n'), /Beleg/)
})

test('check: more than 3 sentences, a status other than entwurf/geprueft and an empty text are reported', () => {
  assert.match(pruefeStellungen(file('e4', 'Eins. Zwei. Drei. Vier.'), aufgaben).join('\n'), /Sätze/)
  assert.match(pruefeStellungen({ [key('e4')]: { satz: 'Zentrum.', status: 'fertig' as never } }, aufgaben).join('\n'), /Status/)
  assert.match(pruefeStellungen(file('e4', '  '), aufgaben).join('\n'), /leer/)
})

test('spielplan: moves named with a move number must be legal in the entry line; text without moves and placeholders pass', () => {
  const entry = ['e4', 'e5', 'Nf3', 'Nc6', 'd4']
  const ok = [{ titel: 'Deine Züge', text: 'Du beginnst mit 1. e4 e5 2. Sf3 Sc6 3. d4 und öffnest das Zentrum.' }, { titel: 'Idee', text: 'TODO texter' }]
  assert.deepEqual(pruefeSpielplan(ok, entry), [])
  const bad = pruefeSpielplan([{ titel: 'Deine Züge', text: 'Danach kommt 2. Sf6 oder 1. e5.' }], entry).join('\n')
  assert.match(bad, /Sf6/)
  assert.match(bad, /1\. e5/)
})

const W = (satz: string, cp: number | null = null, seite: 'white' | 'black' = 'white') => pruefeBewertungsworte(satz, cp, seite)

test('bewertungsworte: below 0,5 there is no "besser/vorn/im Vorteil", only "ausgeglichen"', () => {
  assert.match(W('Die Engine sieht Weiß danach klar vorn (+0,25).').join('\n'), /\+0,25/)
  assert.match(W('Die Engine sieht Weiß danach leicht im Vorteil (+0,35).').join('\n'), /Bewertungswort/)
  assert.match(W('Die Engine sieht Schwarz leicht besser (−0,13).').join('\n'), /Bewertungswort/)
  assert.deepEqual(W('Die Engine sieht die Stellung ausgeglichen (+0,07).'), [])
})

test('bewertungsworte: 0,5 to 1,0 allows plain and "leicht", "klar" starts at 1,0, "entscheidend" at 3', () => {
  assert.deepEqual(W('Danach steht Weiß besser (+0,62).'), [])
  assert.deepEqual(W('Die Engine sieht dich leicht besser (+0,72).', null, 'white'), [])
  assert.match(W('Die Engine sieht dich klar vorn (+0,95).').join('\n'), /klar/)
  assert.match(W('Laut Engine steht Weiß danach klar besser (+0,88).').join('\n'), /klar/)
  assert.match(W('Dazu steht Weiß deutlich besser (+0,99).').join('\n'), /deutlich/)
  assert.deepEqual(W('Die Engine sieht dich klar vorn (+1,07).'), [])
  assert.match(W('Weiß steht klar besser und hat einen entscheidenden Vorteil (+1,50).').join('\n'), /entscheidend/)
  assert.deepEqual(W('Weiß hat einen entscheidenden Vorteil (+3,19).'), [])
})

test('bewertungsworte: the side counts - "du" is the Lehrgang side, the number is from White', () => {
  assert.deepEqual(W('Die Engine sieht dich klar vorn (−1,22).', null, 'black'), [])
  assert.match(W('Die Engine sieht dich klar vorn (+1,22).', null, 'black').join('\n'), /Schwarz|deine Seite/)
  assert.deepEqual(W('Die Engine sieht Schwarz klar besser (−1,22).'), [])
  assert.match(W('Die Engine sieht Schwarz im Vorteil (+0,8).').join('\n'), /Bewertungswort/)
})

test('bewertungsworte: without a number in the text the fact sheet value is used, without both nothing is claimed', () => {
  assert.match(W('Du stehst danach klar besser.', 40).join('\n'), /\+0,40/)
  assert.deepEqual(W('Du stehst danach klar besser.', 130), [])
  assert.deepEqual(W('Du stehst danach klar besser.', null), [])
})

test('check: pruefeStellungen reports an evaluation word that the fact sheet does not carry', () => {
  assert.match(pruefeStellungen(file('e4', 'Du besetzt das Zentrum; die Engine sieht dich klar vorn.'), aufgaben).join('\n'), /Bewertungswort/)
})
