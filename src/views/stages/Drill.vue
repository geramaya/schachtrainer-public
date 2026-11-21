<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Arrow, ContentBundle, Side } from '../../content/types.ts'
import { expectedMove, nodeOfVariation, openingOfVariation } from '../../content/tree.ts'
import { applyUci } from '../../chess/game.ts'
import { positionKey } from '../../chess/position.ts'
import { toGermanSan } from '../../chess/notation.ts'
import { cardId, dueCards, newCards, schedule } from '../../train/srs.ts'
import { cardKey } from '../../train/card-id.ts'
import { isLineIncomplete, opponentMove } from '../../train/drill.ts'
import { answerCard, answerHelped, canSkip, newRun, nextSkipped, noteHint, noteSolution, runResult, skipCard } from '../../train/run.ts'
import { drillEngineLock, hintKeyApplies } from '../../train/help.ts'
import type { Run } from '../../train/run.ts'
import { cardScope, lineKeys } from '../../train/scope.ts'
import { setOwnMove } from '../../store/overlays.ts'
import { progress, recordAnswer, syncBundleCards, update } from '../../store/state.ts'
import { hrefVariation } from '../../router.ts'
import Board from '../../ui/Board.vue'
import EvalBar from '../../ui/EvalBar.vue'
import EnginePanel from '../../ui/EnginePanel.vue'
import { EMPTY_VIEW } from '../../coach/ceval.ts'
import type { EngineView } from '../../coach/ceval.ts'
import CoachPanel from '../../ui/CoachPanel.vue'
import MoveList from '../../ui/MoveList.vue'
import BoardLayout from '../../ui/BoardLayout.vue'
import { playVerdict } from '../../ui/sound.ts'

import type { CoachShape } from '../../coach/explain.ts'

const props = defineProps<{ bundle: ContentBundle; variationId: string; side: Side }>()
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const fen = ref(START)
const lastMove = ref<[string, string] | undefined>()
/** SAN of the moves played in this run (both sides), shown as the move table. */
const playedSans = ref<string[]>([])
const hint = ref<Arrow[]>([])
const message = ref('')
const finished = ref(false)
const incomplete = ref(false)
/** Position the coach explains: set by the user's answer, so the drill never gets told the move beforehand. */
const coach = ref<{ fen: string; prevFen?: string; lastUci?: string } | null>(null)
const coachShapes = ref<CoachShape[]>([])
const run = ref<Run>(newRun())
const verdict = ref<{ kind: 'ok' | 'err'; word: string; san: string; text: string } | null>(null)
const flash = ref<{ square: string; kind: 'ok' | 'err' } | null>(null)
const wobble = ref(false)
const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const treeNode = (k: string) => nodeOfVariation(props.bundle, props.variationId, k)
const OPPONENT_PAUSE_MS = reduceMotion ? 0 : 350
const timers: ReturnType<typeof setTimeout>[] = []
const later = (fn: () => void, ms: number) => { timers.push(setTimeout(fn, ms)) }
const clearTimers = () => { while (timers.length) clearTimeout(timers.pop()) }
onBeforeUnmount(clearTimers)
const missedHere = ref(false) // this position was already answered wrongly: the retry is not graded again
const hintedHere = ref(false) // hint used on this position: a correct answer counts only as "schwer"
const solutionHere = ref(false) // solution shown: card counted as missed, engine lock lifted for this card
const hintSquares = ref<string[]>([])
/** Catch-up round for skipped cards after the line's end; the line end is remembered because the board then sits on a skipped position. */
const catchUp = ref(false)
let endFen = START
let endIncomplete = false

const ev = ref<EngineView>(EMPTY_VIEW)
const boardArrows = computed(() => [...hint.value, ...ev.value.arrows])
const engineLock = computed(() => drillEngineLock({ myTurn: myTurn.value, solutionShown: solutionHere.value }))
const key = computed(() => positionKey(fen.value))
const side = computed(() => openingOfVariation(props.bundle, props.variationId)?.side ?? 'white')
const openingId = computed(() => openingOfVariation(props.bundle, props.variationId)?.id ?? '')
const node = computed(() => nodeOfVariation(props.bundle, props.variationId, key.value))
const myTurn = computed(() => !!node.value?.ownMove && !finished.value)
const expected = computed(() => expectedMove(props.bundle, openingId.value, key.value, progress.value.overlays))
const scope = computed(() => cardScope(props.bundle, props.variationId, progress.value.overlays))
const cards = computed(() => Object.values(progress.value.cards))
const dueTotal = computed(() => dueCards(cards.value, Date.now(), scope.value).length)
const newTotal = computed(() => newCards(cards.value, scope.value).length)

function play(uci: string) {
  const r = applyUci(fen.value, uci)
  if (!r) return false
  lastMove.value = [uci.slice(0, 2), uci.slice(2, 4)]
  fen.value = r.fen
  if (!catchUp.value) playedSans.value = [...playedSans.value, r.san]
  return true
}

/** Plays opponent moves until the user is to move or the variation is done. */
function advance() {
  hint.value = []
  resetCardHelp()
  for (let guard = 0; guard < 80; guard++) {
    const n = nodeOfVariation(props.bundle, props.variationId, key.value)
    if (!n || (n.ownMove && !expectedMove(props.bundle, openingId.value, key.value, progress.value.overlays))) return finish()
    if (n.ownMove) { message.value = ''; return }
    const practise = new Set([...dueCards(cards.value, Date.now(), scope.value), ...newCards(cards.value, scope.value)].map((c) => c.key))
    const reply = opponentMove(props.bundle, props.variationId, key.value, practise, progress.value.overlays, Math.random)
    if (!reply || !play(reply.uci)) return finish()
  }
  finish()
}

function resetCardHelp() { hintedHere.value = false; solutionHere.value = false; hintSquares.value = []; missedHere.value = false }

/** Line end reached: first the skipped cards come back, one by one; then the run is over. */
function finish() {
  if (!catchUp.value) { endFen = fen.value; endIncomplete = isLineIncomplete(props.bundle, props.variationId, key.value) }
  const next = nextSkipped(run.value)
  const n = next.key ? treeNode(next.key) : undefined
  run.value = next.run
  if (next.key && !n) return finish() // key no longer in the tree: drop it
  if (n) {
    catchUp.value = true; resetCardHelp(); hint.value = []; verdict.value = null; coach.value = null; lastMove.value = undefined
    fen.value = n.fen; message.value = 'Übersprungene Karte: jetzt bist du dran.'
    return
  }
  if (catchUp.value) { fen.value = endFen; lastMove.value = undefined }
  catchUp.value = false
  finished.value = true
  incomplete.value = endIncomplete
  message.value = incomplete.value
    ? 'Linie unvollständig: Hier fehlt im Inhalt die Fortsetzung. Das ist nicht deine Schuld.'
    : 'Variante geschafft.'
}

function restart() {
  clearTimers(); run.value = newRun(); catchUp.value = false; resetCardHelp(); verdict.value = null; flash.value = null; wobble.value = false
  coach.value = null; fen.value = START; lastMove.value = undefined; playedSans.value = []; finished.value = false; incomplete.value = false; missedHere.value = false; message.value = ''
  syncBundleCards(props.bundle)
  advance()
}
watch(() => [props.variationId, props.bundle], restart, { immediate: true })

function grade(g: 'gut' | 'schwer' | 'nochmal') {
  const card = progress.value.cards[cardKey(openingId.value, key.value)]
  if (!card) return
  update((p) => ({ ...p, cards: { ...p.cards, [cardId(card)]: schedule(card, g, Date.now()) } }))
}

function showFlash(square: string, kind: 'ok' | 'err') {
  flash.value = { square, kind }
  later(() => { flash.value = null }, 600)
}

function onMove(uci: string) {
  const exp = expected.value
  if (!myTurn.value) return
  if (!exp) { message.value = 'Für diese Stellung gibt es keinen Repertoirezug.'; return }
  if (uci === exp.uci) {
    playVerdict(true)
    recordAnswer()
    if (!missedHere.value) { // schedule() ignores cards that are not due yet
      if (hintedHere.value) { grade('schwer'); run.value = answerHelped(run.value) } else { grade('gut'); run.value = answerCard(run.value, true) }
    }
    const shown = solutionHere.value
    resetCardHelp()
    const before = fen.value
    play(uci)
    coach.value = { fen: fen.value, prevFen: before, lastUci: uci }
    showFlash(uci.slice(2, 4), 'ok')
    message.value = ''
    verdict.value = { kind: 'ok', word: shown ? 'Gespielt:' : 'Richtig:', san: toGermanSan(exp.san), text: shown ? 'Zählt als nicht gewusst, kommt bald wieder.' : 'Repertoirezug gespielt.' }
    hint.value = []
    later(catchUp.value ? finish : advance, OPPONENT_PAUSE_MS)
  } else {
    playVerdict(false)
    if (!missedHere.value) { grade('nochmal'); run.value = answerCard(run.value, false) }
    missedHere.value = true
    hintSquares.value = []
    coach.value = { fen: fen.value }
    hint.value = [{ orig: exp.uci.slice(0, 2), dest: exp.uci.slice(2, 4), brush: 'green' }]
    showFlash(uci.slice(2, 4), 'err')
    wobble.value = true
    later(() => { wobble.value = false }, 260)
    message.value = ''
    verdict.value = { kind: 'err', word: 'Nicht ganz – im Repertoire:', san: toGermanSan(exp.san), text: 'Pfeil auf dem Brett. Spiel ihn jetzt.' }
  }
}

/** Hint: marks the piece of the repertoire move (origin square only). */
function showHint() {
  const exp = expected.value
  if (!myTurn.value || !exp || solutionHere.value) return
  if (!hintedHere.value && !missedHere.value) run.value = noteHint(run.value)
  hintedHere.value = true
  hintSquares.value = [exp.uci.slice(0, 2)]
  message.value = 'Hinweis: Mit dieser Figur geht der Repertoirezug. Die Karte zählt dann höchstens als „schwer“.'
}

/** Solution: shows move and arrow; the card counts as not known (like a miss). */
function showSolution() {
  const exp = expected.value
  if (!myTurn.value || !exp || solutionHere.value) return
  if (!missedHere.value) { grade('nochmal'); run.value = answerCard(run.value, false) }
  missedHere.value = true
  run.value = noteSolution(run.value)
  solutionHere.value = true
  hintSquares.value = []
  coach.value = { fen: fen.value }
  hint.value = [{ orig: exp.uci.slice(0, 2), dest: exp.uci.slice(2, 4), brush: 'green' }]
  message.value = ''
  verdict.value = { kind: 'err', word: 'Lösung:', san: toGermanSan(exp.san), text: 'Pfeil auf dem Brett. Spiel ihn zum Einprägen oder drück „Weiter“.' }
}

/** After the solution: plays the shown move for the user. */
function proceed() { const exp = expected.value; if (exp && solutionHere.value) onMove(exp.uci) }

/** Skip: no grade, the plan stays; the card comes back at the end of the run (once per card). */
function skip() {
  const exp = expected.value
  if (!myTurn.value || !exp || missedHere.value || !canSkip(run.value, key.value)) return
  run.value = skipCard(run.value, key.value)
  hint.value = []; hintSquares.value = []; verdict.value = null; coach.value = null
  play(exp.uci)
  resetCardHelp()
  later(() => { advance(); if (!finished.value) message.value = 'Übersprungen: kommt am Ende des Laufs noch einmal.' }, OPPONENT_PAUSE_MS)
}

const onKey = (e: KeyboardEvent) => { if (hintKeyApplies(e)) { e.preventDefault(); showHint() } }
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))

function changeAnswer(uci: string) {
  update((p) => ({ ...p, overlays: setOwnMove(p.overlays, openingId.value, key.value, uci) }))
  syncBundleCards(props.bundle)
  hint.value = []; message.value = 'Deine Antwort in dieser Stellung wurde geändert.'
}
const ownTotal = computed(() => lineKeys(props.bundle, props.variationId).filter((k) => expectedMove(props.bundle, openingId.value, k, progress.value.overlays)).length)
const cellCount = computed(() => Math.max(ownTotal.value, run.value.cells.length + (finished.value ? 0 : 1)))
const result = computed(() => runResult(run.value))
const evalText = (cp: number | null) => (cp === null ? '' : `${cp >= 0 ? '+' : ''}${(cp / 100).toFixed(2)}`)
const sparringHref = computed(() => hrefVariation(props.variationId, 'anwenden', fen.value))
</script>

<template>
  <BoardLayout>
    <template #left>
      <div class="pane">
        <div class="runhead"><span>Lauf</span><span><b>{{ Math.min(run.cells.length + (finished ? 0 : 1), cellCount) }}</b> / {{ cellCount }} Karten</span></div>
        <div class="runbar" :class="{ finale: finished && result.total > 0 }" role="img" :aria-label="`${result.firstTry} von ${result.total} auf Anhieb`">
          <i v-for="n in cellCount" :key="n" :style="{ '--i': n }" :class="{ ok: run.cells[n - 1] === 'ok', miss: run.cells[n - 1] === 'miss', help: run.cells[n - 1] === 'help', cur: n === run.cells.length + 1 && !finished }">{{ run.cells[n - 1] === 'ok' ? '✓' : run.cells[n - 1] === 'miss' ? '✗' : run.cells[n - 1] === 'help' ? 'H' : n === run.cells.length + 1 && !finished ? '?' : '' }}</i>
        </div>
        <p class="muted">In dieser Variante: {{ dueTotal }} fällig · {{ newTotal }} neu</p>
        <p v-if="myTurn && !verdict" class="task"><span class="side-dot" :class="side" aria-hidden="true"></span>{{ side === 'white' ? 'Weiß' : 'Schwarz' }} am Zug: Spiel deinen Repertoirezug.</p>
        <div v-if="verdict" :key="run.cells.length + verdict.kind + missedHere" class="judge" :class="verdict.kind" role="status">
          <span class="sign" aria-hidden="true">{{ verdict.kind === 'ok' ? '✓' : '✗' }}</span>
          <span><b class="word">{{ verdict.word }}</b> <span class="san">{{ verdict.san }}</span><br /><span class="muted">{{ verdict.text }}</span></span>
          <span v-if="run.streak > 0" class="count"><b>{{ run.streak }}</b>in Folge</span>
        </div>
        <p v-if="message && !finished" class="verdict" role="status">{{ message }}</p>
        <div v-if="finished && incomplete" class="result" role="status">
          <h3>Buch endet hier</h3>
          <p class="muted">Im Inhalt fehlt die Fortsetzung. Das ist nicht deine Schuld.</p>
        </div>
        <div v-else-if="finished" class="result" role="status">
          <h3>Lauf abgeschlossen<span v-if="result.total"> · {{ result.firstTry }} von {{ result.total }} auf Anhieb</span></h3>
          <span v-if="result.passed" class="stamp">✓ Build passed</span>
          <p v-else-if="result.retry" class="muted">{{ result.retry }} {{ result.retry === 1 ? 'Karte kommt' : 'Karten kommen' }} bald wieder.</p>
          <p v-if="result.hints || result.solutions || result.skipped" class="muted help-sum">Hilfen: {{ result.hints }} {{ result.hints === 1 ? 'Hinweis' : 'Hinweise' }} · {{ result.solutions }} {{ result.solutions === 1 ? 'Lösung' : 'Lösungen' }} · {{ result.skipped }} übersprungen</p>
          <p class="verdict">{{ message }}</p>
        </div>
      </div>
      <CoachPanel
        :fen="coach?.fen ?? fen" :own-side="side" mode-key="festigen" :answered="!!coach" :prev-fen="coach?.prevFen" :last-uci="coach?.lastUci"
        :book-status="coach?.lastUci ? 'theorie' : undefined" @shapes="coachShapes = $event"
      />
      <div v-if="myTurn && node && node.candidates.length > 1" class="pane">
        <h3>Meine Antwort hier ändern</h3>
        <div class="choices">
          <button v-for="c in node.candidates" :key="c.uci" :class="{ on: expected?.uci === c.uci }" @click="changeAnswer(c.uci)">
            {{ toGermanSan(c.san) }} <span class="muted">{{ evalText(c.evalCp) }}</span><span v-if="expected?.uci === c.uci"> (aktiv)</span>
          </button>
        </div>
      </div>
    </template>
    <template #board>
      <EvalBar :view="ev" :orientation="side" />
      <Board :fen="fen" :orientation="side" :movable="myTurn" :layer-lock="myTurn" :arrows="boardArrows" :highlight="hintSquares" :shapes="coach?.fen === fen && !hint.length ? coachShapes : []" :last-move="lastMove" :flash="flash" :wobble="wobble" @move="onMove" />
    </template>
    <template #controls>
      <template v-if="finished">
        <button class="pri" @click="restart">Nochmal</button>
        <a class="pbtn" :href="sparringHref">Sparring ab hier</a>
      </template>
      <template v-else-if="myTurn">
        <button type="button" title="Hinweis: markiert die Figur (Taste H)" :disabled="solutionHere" @click="showHint">Hinweis <kbd>H</kbd></button>
        <button v-if="!solutionHere" type="button" title="Zeigt den Repertoirezug; die Karte zählt als nicht gewusst" @click="showSolution">Lösung zeigen</button>
        <button v-else type="button" class="pri" title="Spielt den gezeigten Zug" @click="proceed">Weiter</button>
        <span class="grow"></span>
        <button type="button" title="Karte ans Ende des Laufs, ohne Wertung (einmal je Karte)" :disabled="missedHere || !canSkip(run, key)" @click="skip">Überspringen</button>
      </template>
      <span v-else class="muted">Gegner zieht …</span>
      <span class="pos">{{ Math.min(run.cells.length + (finished ? 0 : 1), cellCount) }}/{{ cellCount }}</span>
    </template>
    <template #right>
      <EnginePanel :fen="fen" :orientation="side" :lock="engineLock" @view="ev = $event" />
      <MoveList :sans="playedSans" :current="playedSans.length" :selectable="false" />
    </template>
  </BoardLayout>
</template>

<style scoped>
.runbar i.help { background: repeating-linear-gradient(135deg, var(--panel-2) 0 5px, var(--acc) 5px 10px); color: var(--ink); }
.ctl kbd { font: 600 var(--fs-label)/1 var(--mono); padding: 2px 5px; border: 1px solid var(--line); border-radius: 4px; color: var(--muted); }
</style>
