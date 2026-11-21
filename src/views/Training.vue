<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Arrow, ContentBundle, Deviation, Puzzle, Side } from '../content/types.ts'
import { nodeOfVariation, treeFor } from '../content/tree.ts'
import { applyUci } from '../chess/game.ts'
import { toGermanSan } from '../chess/notation.ts'
import { positionKey } from '../chess/position.ts'
import { hrefHome } from '../router.ts'
import { applyDeviationId, applyPuzzleId } from '../train/pipeline.ts'
import { puzzleStart, puzzleStep } from '../train/puzzle.ts'
import { schedule } from '../train/srs.ts'
import { answerCard, answerHelped, newRun, noteHint, noteSolution } from '../train/run.ts'
import type { Run } from '../train/run.ts'
import { hintKeyApplies } from '../train/help.ts'
import { trainingPlanFor } from '../train/plan-adapter.ts'
import { formatDuration, restSeconds, trainingBubble, trainingSummary } from '../train/training-result.ts'
import { heroImage } from '../train/hero.ts'
import { BASE } from '../ui/assetBase.ts'
import { markApplied, progress, recordAnswer, update } from '../store/state.ts'
import Board from '../ui/Board.vue'
import { playVerdict } from '../ui/sound.ts'

import EvalBar from '../ui/EvalBar.vue'
import EnginePanel from '../ui/EnginePanel.vue'
import BoardLayout from '../ui/BoardLayout.vue'
import { EMPTY_VIEW } from '../coach/ceval.ts'
import type { EngineView } from '../coach/ceval.ts'
import { cardId } from '../train/srs.ts'

const props = defineProps<{ bundle: ContentBundle }>()
const REPLY_DELAY_MS = 450
const AUTO_NEXT_MS = 600

// The plan is fixed when the page opens, so grading a card does not reshuffle the run under the user.
const started = ref(Date.now())
const tasks = ref(trainingPlanFor(props.bundle, progress.value, started.value).tasks)
const index = ref(0)
const finished = ref(tasks.value.length === 0)
const endedAt = ref(started.value)

const run = ref<Run>(newRun())
const stats = ref({ puzzlesSolved: 0, deviationsPunished: 0 })

// state of the current task
const fen = ref('')
const side = ref<Side>('white')
const lastMove = ref<[string, string] | undefined>()
const played = ref<string[]>([]) // puzzle: moves played so far including the first one
const missed = ref(false)
const hinted = ref(false)
const solutionShown = ref(false)
const done = ref(false)
const busy = ref(false)
const wrongTries = ref(0)
const message = ref('')
const arrows = ref<Arrow[]>([])
const hintSquares = ref<string[]>([])
const ev = ref<EngineView>(EMPTY_VIEW)
const boardArrows = computed(() => [...arrows.value, ...ev.value.arrows])

const timers: ReturnType<typeof setTimeout>[] = []
const later = (fn: () => void, ms: number) => { timers.push(setTimeout(fn, ms)) }
onBeforeUnmount(() => { while (timers.length) clearTimeout(timers.pop()) })

const task = computed(() => tasks.value[index.value])
const card = computed(() => (task.value?.kind === 'card' ? progress.value.cards[task.value.id] : undefined))
const puzzle = computed<Puzzle | undefined>(() => {
  const t = task.value
  return t?.kind === 'puzzle' ? Object.values(props.bundle.puzzles).flat().find((z) => z.id === t.id) : undefined
})
const deviation = computed<Deviation | undefined>(() => {
  const t = task.value
  return t?.kind === 'deviation' ? props.bundle.deviations.find((d) => applyDeviationId(d.variationId, d.key, d.replyUci) === t.id) : undefined
})
const devBefore = computed(() => (deviation.value ? nodeOfVariation(props.bundle, deviation.value.variationId, deviation.value.key)?.fen : undefined))

/** The move the user has to find next in this task. */
const expectedUci = computed(() => {
  if (card.value) return card.value.expectedUci
  if (puzzle.value) return puzzle.value.moves[played.value.length]
  return deviation.value?.punishUci
})

const turnOf = (f: string): Side => (f.split(' ')[1] === 'b' ? 'black' : 'white')

function load(i: number) {
  while (timers.length) clearTimeout(timers.pop())
  index.value = i
  missed.value = false; hinted.value = false; solutionShown.value = false; done.value = false; busy.value = false; wrongTries.value = 0
  message.value = ''; arrows.value = []; hintSquares.value = []; lastMove.value = undefined; played.value = []
  const t = tasks.value[i]
  if (!t) return
  if (t.kind === 'card') {
    const c = progress.value.cards[t.id]
    const node = c ? treeFor(props.bundle, c.openingId)[c.key] : undefined
    fen.value = node?.fen ?? (c ? `${c.key} 0 1` : '')
  } else if (t.kind === 'puzzle' && puzzle.value) {
    const s = puzzleStart(puzzle.value)
    fen.value = s.fen; lastMove.value = s.lastMove; played.value = [puzzle.value.moves[0]!]
  } else if (deviation.value && devBefore.value) {
    const after = applyUci(devBefore.value, deviation.value.replyUci)
    fen.value = after?.fen ?? devBefore.value
    lastMove.value = [deviation.value.replyUci.slice(0, 2), deviation.value.replyUci.slice(2, 4)]
  }
  side.value = turnOf(fen.value)
}
load(0)

/** A new ten-minute plan from the current state (cards graded in this run are no longer due). */
function restart() {
  started.value = Date.now()
  tasks.value = trainingPlanFor(props.bundle, progress.value, started.value).tasks
  run.value = newRun(); stats.value = { puzzlesSolved: 0, deviationsPunished: 0 }
  finished.value = tasks.value.length === 0; endedAt.value = started.value
  load(0)
}

function finishRun() { finished.value = true; endedAt.value = Date.now() }
function next() { index.value + 1 >= tasks.value.length ? finishRun() : load(index.value + 1) }

function grade(g: 'gut' | 'schwer' | 'nochmal') {
  const c = card.value
  if (c) update((p) => ({ ...p, cards: { ...p.cards, [cardId(c)]: schedule(c, g, Date.now()) } }))
}

function showMove(uci: string) {
  const r = applyUci(fen.value, uci)
  if (!r) return false
  fen.value = r.fen; lastMove.value = [uci.slice(0, 2), uci.slice(2, 4)]
  return true
}

function onCardMove(uci: string) {
  const c = card.value
  if (!c) return
  if (uci === c.expectedUci) {
    recordAnswer()
    if (!missed.value) {
      if (hinted.value) { grade('schwer'); run.value = answerHelped(run.value) } else { grade('gut'); run.value = answerCard(run.value, true) }
    }
    const clean = !missed.value && !hinted.value
    showMove(uci); done.value = true; arrows.value = []; hintSquares.value = []
    message.value = clean ? 'Richtig.' : 'Richtig, das ist dein Zug im Repertoire.'
    if (clean) later(next, AUTO_NEXT_MS)
  } else {
    if (!missed.value) { grade('nochmal'); run.value = answerCard(run.value, false) }
    missed.value = true; hintSquares.value = []
    arrows.value = [{ orig: c.expectedUci.slice(0, 2), dest: c.expectedUci.slice(2, 4), brush: 'green' }]
    const san = applyUci(fen.value, c.expectedUci)?.san
    message.value = `Nicht ganz, im Repertoire steht ${san ? toGermanSan(san) : c.expectedUci} (Pfeil). Spiel ihn jetzt.`
  }
}

function onPuzzleMove(uci: string) {
  const p = puzzle.value
  if (!p || done.value || busy.value) return
  const verdict = puzzleStep(p, played.value, uci)
  if (verdict === 'falsch') { playVerdict(false); missed.value = true; message.value = 'Das ist es nicht. Versuch etwas anderes.'; arrows.value = []; hintSquares.value = []; return }
  showMove(uci); played.value = [...played.value, uci]; arrows.value = []; hintSquares.value = []; playVerdict(true)
  if (verdict === 'gelöst') {
    done.value = true; message.value = 'Gelöst.'
    if (!solutionShown.value) { stats.value = { ...stats.value, puzzlesSolved: stats.value.puzzlesSolved + 1 }; markApplied(applyPuzzleId(p.id)) }
    return
  }
  message.value = 'Richtig, weiter.'; busy.value = true
  later(() => { busy.value = false; const reply = p.moves[played.value.length]; if (reply) { showMove(reply); played.value = [...played.value, reply] } message.value = '' }, REPLY_DELAY_MS)
}

function onDeviationMove(uci: string) {
  const d = deviation.value
  if (!d || done.value) return
  if (uci === d.punishUci) {
    playVerdict(true); showMove(uci); done.value = true; arrows.value = []; hintSquares.value = []; message.value = 'Richtig, das ist deine Antwort im Repertoire.'
    if (!solutionShown.value) { stats.value = { ...stats.value, deviationsPunished: stats.value.deviationsPunished + 1 }; markApplied(applyDeviationId(d.variationId, d.key, d.replyUci)) }
    return
  }
  playVerdict(false); wrongTries.value++; missed.value = true
  if (wrongTries.value === 1) { message.value = 'Das war es nicht. Versuch es noch einmal.'; return }
  showSolution(); done.value = true
}

function onMove(uci: string) {
  if (done.value || finished.value) return
  if (card.value) onCardMove(uci)
  else if (puzzle.value) onPuzzleMove(uci)
  else onDeviationMove(uci)
}

/** Hint: the origin square of the next move; a card then counts at most as "schwer". */
function showHint() {
  const m = expectedUci.value
  if (!m || done.value || solutionShown.value || busy.value) return
  if (!hinted.value && !missed.value && card.value) run.value = noteHint(run.value)
  hinted.value = true
  hintSquares.value = [m.slice(0, 2)]
}

/** Solution: arrow for the next move. A card counts as not known, a puzzle or deviation as not solved. */
function showSolution() {
  const m = expectedUci.value
  if (!m || busy.value || solutionShown.value) return
  if (card.value && !missed.value) { grade('nochmal'); run.value = answerCard(run.value, false) }
  if (!solutionShown.value && card.value) run.value = noteSolution(run.value)
  missed.value = true; solutionShown.value = true; hintSquares.value = []
  arrows.value = [{ orig: m.slice(0, 2), dest: m.slice(2, 4), brush: 'green' }]
  message.value = 'Lösung als Pfeil. Spiel den Zug oder geh weiter.'
}

const onKey = (e: KeyboardEvent) => { if (hintKeyApplies(e) && !finished.value) { e.preventDefault(); showHint() } }
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))

const seconds = computed(() => Math.round((endedAt.value - started.value) / 1000))
const summary = computed(() => trainingSummary({ cards: run.value.cells.length, ...stats.value, puzzlesOffered: tasks.value.filter((t) => t.kind === 'puzzle').length, deviationsOffered: tasks.value.filter((t) => t.kind === 'deviation').length }))
const bubble = computed(() => trainingBubble({ cards: run.value.cells.length, firstTry: run.value.cells.filter((c) => c === 'ok').length, ...stats.value }))
const rest = computed(() => restSeconds(tasks.value, index.value + (done.value ? 1 : 0)))
const canAdvance = computed(() => done.value || solutionShown.value)
const label = computed(() => (card.value ? 'Karte: spiel deinen Repertoirezug' : puzzle.value ? 'Rätsel: finde den besten Zug' : 'Abweichung: bestrafe den Gegner'))
const sideWord = computed(() => (side.value === 'white' ? 'Weiß' : 'Schwarz'))
const movable = computed(() => !done.value && !busy.value && !finished.value)
</script>

<template>
  <div class="pagebar"><p class="crumbs"><a :href="hrefHome()">Start</a> › Training für 10 Minuten</p></div>
  <div v-if="tasks.length === 0" class="pad">
    <h1>Training für 10 Minuten</h1>
    <p class="muted">Gerade gibt es nichts zu trainieren. Lerne zuerst eine Variante.</p>
    <p><a class="linkbtn" :href="hrefHome()">Zur Startseite</a></p>
  </div>
  <div v-else-if="finished" class="pad trainend">
    <div class="hstage" :data-pose="bubble.pose">
      <div class="hframe">
        <img :src="BASE + heroImage(bubble.pose).src" :alt="heroImage(bubble.pose).alt" width="960" height="640" />
        <p class="hbubble" role="status"><b>Ferro</b>{{ bubble.text }}</p>
      </div>
    </div>
    <h1>Training geschafft</h1>
    <p class="sumline" role="status">{{ summary }}</p>
    <p class="time"><b>{{ formatDuration(seconds) }}</b> min Trainingszeit</p>
    <p v-if="run.hints || run.solutions" class="muted">Hilfen: {{ run.hints }} {{ run.hints === 1 ? 'Hinweis' : 'Hinweise' }} · {{ run.solutions }} {{ run.solutions === 1 ? 'Lösung' : 'Lösungen' }}</p>
    <p class="ctas"><a class="hbtn pri" :href="hrefHome()">Zur Startseite</a><button type="button" class="hbtn sec" @click="restart">Noch einmal 10 Minuten</button></p>
  </div>
  <BoardLayout v-else>
    <template #left>
      <div class="pane">
        <div class="runhead"><span>Training</span><span><b>{{ index + 1 }}</b> / {{ tasks.length }} Aufgaben</span></div>
        <div class="runbar" role="progressbar" :aria-valuenow="index" :aria-valuemin="0" :aria-valuemax="tasks.length" aria-label="Fortschritt im Training">
          <i v-for="(t, n) in tasks" :key="n" :style="{ '--i': n }" :class="{ ok: n < index, cur: n === index, kindp: t.kind !== 'card' }">{{ n < index ? '✓' : n === index ? '?' : '' }}</i>
        </div>
        <p class="muted">Rest ca. {{ formatDuration(rest) }} min</p>
        <p class="task"><span class="side-dot" :class="side" aria-hidden="true"></span>{{ sideWord }} am Zug · {{ label }}</p>
        <p v-if="deviation && !done" class="muted">Dein Gegner weicht ab. Finde deine Antwort.</p>
        <p v-if="puzzle" class="muted">Wertung {{ puzzle.rating }}</p>
        <p v-if="message" class="verdict" role="status">{{ message }}</p>
      </div>
    </template>
    <template #board>
      <EvalBar :view="ev" :orientation="side" />
      <Board :fen="fen" :orientation="side" :movable="movable" :layer-lock="!done" :arrows="boardArrows" :highlight="hintSquares" :last-move="lastMove" @move="onMove" />
    </template>
    <template #controls>
      <button type="button" title="Hinweis: markiert die Figur (Taste H)" :disabled="done || solutionShown" @click="showHint">Hinweis <kbd>H</kbd></button>
      <button type="button" title="Zeigt den Zug als Pfeil" :disabled="done || solutionShown" @click="showSolution">Lösung zeigen</button>
      <span class="grow"></span>
      <button type="button" :class="{ pri: canAdvance }" :disabled="!canAdvance" @click="next">Weiter ▸</button>
      <span class="pos">{{ index + 1 }}/{{ tasks.length }}</span>
    </template>
    <template #right>
      <EnginePanel :fen="fen" :orientation="side" :lock="canAdvance ? null : 'task'" @view="ev = $event" />
    </template>
  </BoardLayout>
</template>

<style scoped>
.trainend { display: grid; justify-items: center; gap: .6rem; text-align: center; max-width: 640px; margin: 0 auto; padding-top: 1.5rem; }
.trainend .hstage { width: 100%; }
.trainend .hbubble { text-align: left; }
.time { margin: 0; color: var(--muted); }
.time b { color: var(--text); font-size: var(--fs-h1); }
.sumline { font-size: var(--fs-h2); font-weight: 650; margin: 0; }
.ctas { justify-content: center; margin-top: .6rem; }
.ctl kbd { font: 600 var(--fs-label)/1 var(--mono); padding: 2px 5px; border: 1px solid var(--line); border-radius: 4px; color: var(--muted); }
.runbar i { min-width: 0; font-size: 9px; overflow: hidden; }
.runbar i.kindp { border-radius: 50%; }
</style>
