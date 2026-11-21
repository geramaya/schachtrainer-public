<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { Arrow, ContentBundle, Deviation, Puzzle, Side, Variation } from '../../content/types.ts'
import { nodeOfVariation } from '../../content/tree.ts'
import { applyUci } from '../../chess/game.ts'
import { isValidFen } from '../../chess/status.ts'
import { toGermanSan } from '../../chess/notation.ts'
import { isShown } from '../../train/lesson.ts'
import { puzzleStart, puzzleStep, sortPuzzles } from '../../train/puzzle.ts'
import { applyDeviationId, applyPuzzleId, puzzlesOf } from '../../train/pipeline.ts'
import { hrefVariation } from '../../router.ts'
import { IN_DESKTOP_APP } from '../../ui/desktop.ts'
import { markApplied } from '../../store/state.ts'
import Board from '../../ui/Board.vue'
import { playVerdict } from '../../ui/sound.ts'

import EvalBar from '../../ui/EvalBar.vue'
import EnginePanel from '../../ui/EnginePanel.vue'
import { EMPTY_VIEW } from '../../coach/ceval.ts'
import type { EngineView } from '../../coach/ceval.ts'
import CoachPanel from '../../ui/CoachPanel.vue'
import type { CoachShape } from '../../coach/explain.ts'
import Sparring from '../Sparring.vue'
import BoardLayout from '../../ui/BoardLayout.vue'
import ModeTabs from '../../ui/ModeTabs.vue'

const props = defineProps<{ bundle: ContentBundle; variation: Variation; side: Side; anchorFen?: string }>()

const MODES: { id: string; label: string }[] = [{ id: 'abweichungen', label: 'Abweichungen' }, { id: 'raetsel', label: 'Rätsel' }, { id: 'sparring', label: 'Sparring' }]
const REPLY_DELAY_MS = 450

const anchorOk = computed(() => !!props.anchorFen && isValidFen(props.anchorFen))
const mode = ref<string>('abweichungen')
const hasDeviations = () => props.bundle.deviations.some((d) => d.variationId === props.variation.id && nodeOfVariation(props.bundle, d.variationId, d.key))
const hasPuzzles = () => puzzlesOf(props.bundle, props.variation.id).length > 0
watch(() => [props.variation.id, props.anchorFen], () => { mode.value = props.anchorFen ? 'sparring' : hasDeviations() ? 'abweichungen' : hasPuzzles() ? 'raetsel' : 'sparring' }, { immediate: true })
/** Another variation of the same opening that has puzzles: the way on when this one has none. */
const siblingWithPuzzles = computed(() => {
  const o = props.bundle.openings.find((x) => x.variations.some((v) => v.id === props.variation.id))
  return o?.variations.find((v) => v.id !== props.variation.id && puzzlesOf(props.bundle, v.id).length > 0)
})

// (a) deviations: the opponent leaves the line, the user finds the punishment
const deviations = computed(() => props.bundle.deviations.filter((d) => d.variationId === props.variation.id && nodeOfVariation(props.bundle, d.variationId, d.key)))
const di = ref(0)
const dWrong = ref(0)
const dDone = ref(false)
const dMsg = ref('')
const dArrows = ref<Arrow[]>([])
const coachShapes = ref<CoachShape[]>([])
const dev = computed<Deviation | undefined>(() => deviations.value[di.value])
const devBefore = computed(() => nodeOfVariation(props.bundle, props.variation.id, dev.value!.key)!.fen)
const devAfter = computed(() => (dev.value ? applyUci(devBefore.value, dev.value.replyUci) : null))
const devFen = computed(() => (dDone.value && dev.value ? (applyUci(devAfter.value!.fen, dev.value.punishUci)?.fen ?? devAfter.value!.fen) : (devAfter.value?.fen ?? devBefore.value)))
const devExplanation = computed(() => {
  const e = dev.value && props.bundle.explanations.find((x) => x.id === dev.value!.explanationId)
  return e && isShown(e) ? e : undefined
})
function resetDeviation(i: number) { di.value = i; dWrong.value = 0; dDone.value = false; dMsg.value = ''; dArrows.value = [] }
watch(() => props.variation.id, () => resetDeviation(0), { immediate: true })

function onDeviationMove(uci: string) {
  const d = dev.value
  if (!d || dDone.value) return
  if (uci === d.punishUci) { dDone.value = true; dMsg.value = 'Richtig, das ist deine Antwort im Repertoire.'; markApplied(applyDeviationId(props.variation.id, d.key, d.replyUci)); return }
  dWrong.value++
  if (dWrong.value === 1) { dMsg.value = 'Das war es nicht. Versuch es noch einmal.'; return }
  dArrows.value = [{ orig: d.punishUci.slice(0, 2), dest: d.punishUci.slice(2, 4), brush: 'green' }]
  dDone.value = true; dMsg.value = `Nicht ganz. Deine Antwort im Repertoire ist ${toGermanSan(applyUci(devAfter.value!.fen, d.punishUci)?.san ?? d.punishUci)} (Pfeil).`
}
const ev = ref<EngineView>(EMPTY_VIEW)
const devArrows = computed(() => [...(dDone.value ? [...dArrows.value, ...(devExplanation.value?.arrows ?? [])] : []), ...ev.value.arrows])
const puzzleArrows = computed(() => [...pHint.value, ...ev.value.arrows])

// (b) puzzles of the variation, easiest first
const puzzles = computed<Puzzle[]>(() => sortPuzzles(puzzlesOf(props.bundle, props.variation.id)))
const pi = ref(0)
const played = ref<string[]>([])
const pFen = ref('')
const pLast = ref<[string, string] | undefined>()
const pSide = ref<Side>('white')
const pMsg = ref('')
const pSolved = ref(false)
const pHint = ref<Arrow[]>([])
const pBusy = ref(false) // the opponent reply is about to be shown
let timer: ReturnType<typeof setTimeout> | undefined
const puzzle = computed<Puzzle | undefined>(() => puzzles.value[pi.value])

function loadPuzzle(i: number) {
  clearTimeout(timer); pBusy.value = false
  pi.value = Math.max(0, Math.min(puzzles.value.length - 1, i))
  pMsg.value = ''; pSolved.value = false; pHint.value = []
  const p = puzzle.value
  if (!p) return
  const s = puzzleStart(p)
  pFen.value = s.fen; pLast.value = s.lastMove; pSide.value = s.userSide; played.value = [p.moves[0]!]
}
watch(() => props.variation.id, () => loadPuzzle(0), { immediate: true })
onBeforeUnmount(() => clearTimeout(timer))

function showMove(uci: string) {
  const r = applyUci(pFen.value, uci)
  if (!r) return false
  pFen.value = r.fen; pLast.value = [uci.slice(0, 2), uci.slice(2, 4)]; played.value = [...played.value, uci]
  return true
}

function onPuzzleMove(uci: string) {
  const p = puzzle.value
  if (!p || pSolved.value || pBusy.value) return
  const verdict = puzzleStep(p, played.value, uci)
  if (verdict === 'falsch') { playVerdict(false); pMsg.value = 'Das ist es nicht. Versuch etwas anderes.'; pHint.value = []; return }
  showMove(uci); pHint.value = []; playVerdict(true)
  if (verdict === 'gelöst') { pSolved.value = true; pMsg.value = 'Gelöst.'; markApplied(applyPuzzleId(p.id)); return }
  pMsg.value = 'Richtig, weiter.'; pBusy.value = true
  timer = setTimeout(() => { pBusy.value = false; const reply = p.moves[played.value.length]; if (reply) showMove(reply); pMsg.value = '' }, REPLY_DELAY_MS)
}

function showSolution() {
  const p = puzzle.value
  const m = p?.moves[played.value.length]
  if (m) pHint.value = [{ orig: m.slice(0, 2), dest: m.slice(2, 4), brush: 'green' }]
}
const puzzleSideLabel = computed(() => (pSide.value === 'white' ? 'Weiß' : 'Schwarz'))
</script>

<template>
  <BoardLayout v-if="mode === 'abweichungen'">
    <template #left>
      <div class="pane">
        <ModeTabs v-model="mode" :modes="MODES" />
        <h2 class="gap">Abweichungen</h2>
        <div v-if="!dev" class="empty-card">
          <p>Für diese Variante gibt es noch keine vorbereiteten Abweichungen.</p>
          <p>
            <button v-if="puzzles.length" class="primary" @click="mode = 'raetsel'">Rätsel lösen</button>
            <a v-else-if="siblingWithPuzzles" class="primary linkbtn" :href="hrefVariation(siblingWithPuzzles.id, 'anwenden')">Rätsel der Eröffnung</a>
            <button class="primary" @click="mode = 'sparring'">Sparring ab Ende dieser Variante</button>
          </p>
        </div>
        <template v-else>
          <p class="muted">Abweichung {{ di + 1 }} von {{ deviations.length }}: Dein Gegner spielt {{ toGermanSan(devAfter?.san ?? dev.replyUci) }} statt der Linie. Finde deine Antwort im Repertoire.</p>
          <p v-if="dMsg" class="verdict" role="status">{{ dMsg }}</p>
          <div v-if="dDone && devExplanation" class="expl">
            <h3>{{ devExplanation.title }}</h3>
            <p>{{ devExplanation.text }}</p>
          </div>
          <p v-else-if="dDone" class="muted">Zu dieser Abweichung gibt es noch keine Erklärung.</p>
        </template>
      </div>
      <CoachPanel v-if="dev && devAfter" :fen="devFen" :own-side="side" mode-key="raetsel" :answered="dDone" :prev-fen="devAfter.fen" :last-uci="dev.punishUci" book-status="theorie" @shapes="coachShapes = $event" />
    </template>
    <template #board>
      <template v-if="dev && devAfter">
        <EvalBar :view="ev" :orientation="side" />
        <Board :fen="devFen" :orientation="side" :movable="!dDone" :layer-lock="!dDone" :arrows="devArrows" :shapes="coachShapes" :last-move="dDone ? undefined : [dev.replyUci.slice(0, 2), dev.replyUci.slice(2, 4)]" @move="onDeviationMove" />
      </template>
    </template>
    <template v-if="dev" #controls>
      <template v-if="dev">
        <button :disabled="di === 0" aria-label="Vorherige Abweichung" @click="resetDeviation(di - 1)">◀</button>
        <button :disabled="di >= deviations.length - 1" aria-label="Nächste Abweichung" @click="resetDeviation(di + 1)">▶</button>
        <span class="pos">{{ di + 1 }}/{{ deviations.length }}</span>
      </template>
    </template>
    <template #right>
      <EnginePanel v-if="dev && devAfter" :fen="devFen" :orientation="side" :lock="dDone ? null : 'task'" @view="ev = $event" />
    </template>
  </BoardLayout>

  <BoardLayout v-else-if="mode === 'raetsel'">
    <template #left>
      <div class="pane">
        <ModeTabs v-model="mode" :modes="MODES" />
        <h2 class="gap">Rätsel</h2>
        <div v-if="!puzzle" class="empty-card">
          <p>Für diese Variante gibt es keine Rätsel.</p>
          <p>
            <a v-if="siblingWithPuzzles" class="primary linkbtn" :href="hrefVariation(siblingWithPuzzles.id, 'anwenden')">Rätsel der Eröffnung</a>
            <button class="primary" @click="mode = 'sparring'">Sparring ab Ende dieser Variante</button>
          </p>
        </div>
        <template v-else>
          <p class="muted">Rätsel {{ pi + 1 }} von {{ puzzles.length }} · Wertung {{ puzzle.rating }} · {{ puzzleSideLabel }} am Zug</p>
          <p v-if="pMsg" class="verdict" role="status">{{ pMsg }}</p>
          <p class="muted">Quelle: <template v-if="IN_DESKTOP_APP">Lichess-Datenbank ({{ puzzle.url }})</template><a v-else :href="puzzle.url" target="_blank" rel="noopener noreferrer">Lichess-Datenbank</a>, Themen: {{ puzzle.themes.join(', ') }}</p>
        </template>
      </div>
      <CoachPanel v-if="puzzle" :fen="pFen" :own-side="pSide" mode-key="raetsel" :answered="pSolved" @shapes="coachShapes = $event" />
    </template>
    <template #board>
      <template v-if="puzzle">
        <EvalBar :view="ev" :orientation="pSide" />
        <Board :fen="pFen" :orientation="pSide" :movable="!pSolved && !pBusy" :layer-lock="!pSolved" :arrows="puzzleArrows" :shapes="coachShapes" :last-move="pLast" @move="onPuzzleMove" />
      </template>
    </template>
    <template v-if="puzzle" #controls>
      <template v-if="puzzle">
        <button :disabled="pi === 0" aria-label="Vorheriges Rätsel" @click="loadPuzzle(pi - 1)">◀</button>
        <button v-if="!pSolved" @click="showSolution">Lösung zeigen</button>
        <button :disabled="pi >= puzzles.length - 1" :class="{ pri: pSolved }" @click="loadPuzzle(pi + 1)">Nächstes Rätsel ▶</button>
        <span class="pos">{{ pi + 1 }}/{{ puzzles.length }}</span>
      </template>
    </template>
    <template #right>
      <EnginePanel v-if="puzzle" :fen="pFen" :orientation="pSide" :lock="pSolved ? null : 'task'" @view="ev = $event" />
    </template>
  </BoardLayout>

  <!-- KeepAlive: a running game survives a switch to Abweichungen or Rätsel (M3); it ends only when the variation changes -->
  <KeepAlive v-else>
    <Sparring :key="variation.id" :bundle="bundle" :variation="variation" :side="side" :start-fen="anchorOk ? anchorFen : undefined">
      <template #tabs>
        <ModeTabs v-model="mode" :modes="MODES" />
        <p v-if="anchorFen && !anchorOk" class="err" role="alert">Die Stellung in der Adresse ist ungültig. Wähle einen anderen Start.</p>
      </template>
    </Sparring>
  </KeepAlive>
</template>

<style scoped>
.gap { margin-top: 0.6rem; }
</style>
