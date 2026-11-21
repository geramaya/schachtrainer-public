<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Chess } from 'chess.js'
import { positionKey } from '../chess/position.ts'
import type { Arrow, ContentBundle } from '../content/types.ts'
import { hrefHome, hrefOpening, hrefVariation } from '../router.ts'
import type { Stage } from '../router.ts'
import { navTarget, shouldHandleKey } from '../ui/keys.ts'
import { startPlyFor } from '../train/startPly.ts'
import { explanationAtKey } from '../train/lesson.ts'
import { playStep } from '../train/playback.ts'
import StageStepper from '../ui/StageStepper.vue'
import { accentFor, CATALOG } from '../content/catalog.ts'
import { variationStages } from '../train/pipeline.ts'
import { progress, setLastCourse } from '../store/state.ts'
import Board from '../ui/Board.vue'
import EvalBar from '../ui/EvalBar.vue'
import EnginePanel from '../ui/EnginePanel.vue'
import { EMPTY_VIEW } from '../coach/ceval.ts'
import type { EngineView } from '../coach/ceval.ts'
import CoachPanel from '../ui/CoachPanel.vue'
import type { CoachShape } from '../coach/explain.ts'
import MoveList from '../ui/MoveList.vue'
import AudioButton from '../ui/AudioButton.vue'
import BoardLayout from '../ui/BoardLayout.vue'
import Learn from './stages/Learn.vue'
import Understand from './stages/Understand.vue'
import Drill from './stages/Drill.vue'
import Apply from './stages/Apply.vue'

const props = defineProps<{ bundle: ContentBundle; variationId: string; stage: Stage; anchorFen?: string }>()
const NO_ARROWS: Arrow[] = []

const found = computed(() => {
  for (const o of props.bundle.openings) {
    const v = o.variations.find((x) => x.id === props.variationId)
    if (v) return { opening: o, variation: v }
  }
  return null
})

/** Positions after 0..n plies of the variation line, with their position keys. */
const steps = computed(() => {
  const chess = new Chess()
  const out: { fen: string; key: string; last?: [string, string] }[] = [{ fen: chess.fen(), key: positionKey(chess.fen()) }]
  for (const san of found.value?.variation.line ?? []) {
    const m = chess.move(san)
    out.push({ fen: chess.fen(), key: positionKey(chess.fen()), last: [m.from, m.to] })
  }
  return out
})

watch(() => [props.variationId, props.stage, !!found.value], () => { if (found.value) setLastCourse(props.variationId, props.stage) }, { immediate: true })
const ply = ref(0)
// a lesson opens before move 1; only a position named in the URL ("Analysebrett ab hier" style links) overrides that
watch(() => [props.variationId, props.anchorFen], () => { ply.value = startPlyFor(steps.value.map((x) => x.key), props.anchorFen) }, { immediate: true })
const go = (n: number) => { ply.value = Math.max(0, Math.min(steps.value.length - 1, n)) }

function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  const mods = { alt: e.altKey, ctrl: e.ctrlKey, meta: e.metaKey, shift: e.shiftKey }
  if (!shouldHandleKey(e.key, t?.tagName ?? '', !!t?.isContentEditable, mods)) return
  if (props.stage === 'verstehen' || props.stage === 'festigen' || props.stage === 'anwenden') return // answered on the board, not browsed
  const to = navTarget(e.key, ply.value, steps.value.length - 1)
  if (to === null) return
  stopPlay(); go(to)
  e.preventDefault()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const states = computed(() => variationStages(props.bundle, progress.value, props.variationId))
const code = computed(() => CATALOG.find((c) => c.id === found.value?.opening.id)?.code ?? '')
const partial = computed(() => {
  if (props.stage !== 'lernen') return ''
  const n = keyPlies.value.length
  return n ? `${keyPlies.value.filter((p) => p <= ply.value).length}/${n} Stellungen` : ''
})
const plyLabel = (p: number) => (p === 0 ? 'Grundstellung' : `Zug ${Math.ceil(p / 2)}${p % 2 ? '' : '…'}`)
const playing = ref(false)
let timer: ReturnType<typeof setInterval> | undefined
const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
function stopPlay() { playing.value = false; clearInterval(timer) }
function togglePlay() {
  if (playing.value) return stopPlay()
  if (ply.value >= steps.value.length - 1) ply.value = 0
  playing.value = true
  timer = setInterval(() => {
    const r = playStep(ply.value, keyPlies.value, steps.value.length - 1)
    ply.value = r.ply
    if (!r.playing) stopPlay()
  }, reduceMotion ? 1400 : 900)
}
watch(() => [props.variationId, props.stage], stopPlay)
onBeforeUnmount(() => clearInterval(timer))
const coachShapes = ref<CoachShape[]>([])
const cur = computed(() => steps.value[ply.value]!)
const prev = computed(() => (ply.value > 0 ? steps.value[ply.value - 1]!.fen : undefined))
const lastUci = computed(() => (cur.value.last ? cur.value.last[0] + cur.value.last[1] : undefined))
const partOfName = computed(() => found.value?.opening.variations.find((v) => v.id === found.value?.variation.partOf)?.name)
const explanation = computed(() => (found.value ? explanationAtKey(props.bundle.explanations, cur.value.key, found.value.opening.id) : undefined))
const keyPlies = computed(() => steps.value.flatMap((s, i) => (found.value && explanationAtKey(props.bundle.explanations, s.key, found.value.opening.id) ? [i] : [])))
const ev = ref<EngineView>(EMPTY_VIEW)
const arrows = computed(() => [...(props.stage === 'lernen' ? (explanation.value?.arrows ?? NO_ARROWS) : NO_ARROWS), ...ev.value.arrows])
</script>

<template>
  <p v-if="!found" class="muted pad">Variante nicht gefunden. <a :href="hrefHome()">Zur Startseite</a></p>
  <div v-else :style="{ '--acc': accentFor(found.opening.id) }">
    <div class="pagebar">
      <p class="crumbs">
        <span class="code">{{ code }}</span> <a :href="hrefHome()">Start</a> › <a :href="hrefOpening(found.opening.id)">{{ found.opening.name }}</a> › {{ found.variation.name }}
      </p>
      <StageStepper :variation-id="variationId" :stage="stage" :states="states" :partial="partial" />
    </div>
    <Understand v-if="stage === 'verstehen'" :bundle="bundle" :variation="found.variation" :side="found.opening.side" :steps="steps" />
    <Drill v-else-if="stage === 'festigen'" :bundle="bundle" :variation-id="variationId" :side="found.opening.side" />
    <Apply v-else-if="stage === 'anwenden'" :bundle="bundle" :variation="found.variation" :side="found.opening.side" :anchor-fen="anchorFen" />
    <BoardLayout v-else>
      <template #left>
        <CoachPanel
          :fen="cur.fen" :own-side="found.opening.side" mode-key="lernen" :prev-fen="prev" :last-uci="lastUci"
          :book-status="ply > 0 ? 'theorie' : undefined" :explanation="explanation" lesson-above @shapes="coachShapes = $event"
        >
          <template #head><AudioButton :audio-id="`variante-${variationId}`" label="Idee anhören" /></template>
          <p v-if="found.variation.partOf" class="muted">Etappe von: {{ partOfName }}</p>
          <Learn
            :explanation="explanation"
            :has-lesson="keyPlies.length > 0"
            :content-version="bundle.contentVersion"
            :festigen-href="hrefVariation(variationId, 'festigen')"
          />
        </CoachPanel>
      </template>
      <template #board>
        <EvalBar :view="ev" :orientation="found.opening.side" />
        <Board :fen="cur.fen" :orientation="found.opening.side" :movable="false" :arrows="arrows" :shapes="coachShapes" :last-move="cur.last" />
      </template>
      <template #controls>
        <button class="edge" :disabled="ply === 0" aria-label="Zum Anfang" title="Anfang (Pos1)" @click="stopPlay(); go(0)">⇤</button>
        <button :disabled="ply === 0" aria-label="Ein Zug zurück" title="Zurück (←)" @click="stopPlay(); go(ply - 1)">◀</button>
        <button :disabled="ply === steps.length - 1" aria-label="Ein Zug vor" title="Vor (→)" @click="stopPlay(); go(ply + 1)">▶</button>
        <button class="edge" :disabled="ply === steps.length - 1" aria-label="Zum Ende" title="Ende (Ende)" @click="stopPlay(); go(steps.length - 1)">⇥</button>
        <button class="pri" :aria-pressed="playing" :aria-label="playing ? 'Pause' : 'Abspielen'" @click="togglePlay">{{ playing ? '❚❚' : '▶' }}<span class="lbl">{{ playing ? ' Pause' : ' Abspielen' }}</span></button>
        <div class="scrub" role="group" aria-label="Zeitleiste der Linie">
          <div class="track">
            <span class="fillbar" :style="{ width: (100 * ply) / Math.max(1, steps.length - 1) + '%' }"></span>
            <button
              v-for="(_, i) in steps" :key="i" class="tick" :class="[keyPlies.includes(i) ? 'key' : 'plain', { here: i === ply }]"
              :style="{ left: (100 * i) / Math.max(1, steps.length - 1) + '%' }"
              :title="keyPlies.includes(i) ? `${plyLabel(i)} – Schlüsselstellung` : plyLabel(i)" :aria-label="keyPlies.includes(i) ? `${plyLabel(i)} – Schlüsselstellung` : plyLabel(i)" @click="stopPlay(); go(i)"
            ></button>
          </div>
        </div>
        <span class="pos">{{ ply }}/{{ steps.length - 1 }}</span>
      </template>
      <template #right>
        <EnginePanel :fen="cur.fen" :orientation="found.opening.side" @view="ev = $event" />
        <MoveList :sans="found.variation.line" :current="ply" @select="go" />
      </template>
    </BoardLayout>
  </div>
</template>
