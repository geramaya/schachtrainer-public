<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Arrow, ContentBundle, Question, Side, Variation } from '../../content/types.ts'
import { badgeLabel, isShown, judgeMove } from '../../train/lesson.ts'
import { hrefVariation } from '../../router.ts'
import { markUnderstood } from '../../store/state.ts'
import { applyUci } from '../../chess/game.ts'
import Board from '../../ui/Board.vue'
import { playVerdict } from '../../ui/sound.ts'

import EvalBar from '../../ui/EvalBar.vue'
import EnginePanel from '../../ui/EnginePanel.vue'
import { EMPTY_VIEW } from '../../coach/ceval.ts'
import type { EngineView } from '../../coach/ceval.ts'
import CoachPanel from '../../ui/CoachPanel.vue'
import BoardLayout from '../../ui/BoardLayout.vue'
import type { CoachShape } from '../../coach/explain.ts'

const props = defineProps<{ bundle: ContentBundle; variation: Variation; side: Side; steps: { fen: string; key: string }[] }>()

/** Questions of this variation, in line order; questions whose position is not on the line are skipped. */
const questions = computed(() =>
  props.bundle.questions
    .filter((q) => q.variationId === props.variation.id)
    .map((q) => ({ q, idx: props.steps.findIndex((s) => s.key === q.key) }))
    .filter((x) => x.idx >= 0)
    .sort((a, b) => a.idx - b.idx),
)

const qi = ref(0)
const wrong = ref(0)
const done = ref(false)
const message = ref('')
const solution = ref<Arrow[]>([])
const solved = ref(false)
const picked = ref<number | null>(null)
const okMsg = ref(false)

function reset(i: number) { qi.value = i; wrong.value = 0; done.value = false; message.value = ''; solution.value = []; solved.value = false; picked.value = null; okMsg.value = false }
watch(() => props.variation.id, () => reset(0), { immediate: true })

const coachShapes = ref<CoachShape[]>([])
const cur = computed(() => questions.value[qi.value])
const question = computed<Question | undefined>(() => cur.value?.q)
const fen = computed(() => {
  if (!cur.value) return props.steps[0]!.fen
  const before = props.steps[cur.value.idx]!.fen
  // after a correct move the board shows the resulting position
  return solved.value && question.value?.kind === 'move' ? (applyUci(before, question.value.answerUci!)?.fen ?? before) : before
})
const explanation = computed(() => {
  const e = question.value ? props.bundle.explanations.find((x) => x.id === question.value!.explanationId) : undefined
  return e && isShown(e) ? e : undefined
})
const ev = ref<EngineView>(EMPTY_VIEW)
const arrows = computed<Arrow[]>(() => [...(done.value ? [...solution.value, ...(explanation.value?.arrows ?? [])] : []), ...ev.value.arrows])

function finish(ok: boolean) {
  playVerdict(ok)
  done.value = true
  okMsg.value = ok
  message.value = ok ? '✓ Richtig.' : '✗ Nicht ganz.'
  if (ok && question.value) markUnderstood(question.value.id)
}

function onMove(uci: string) {
  const q = question.value
  if (!q || done.value) return
  const answer = q.answerUci
  if (!answer) return // malformed move question: nothing to check against
  const r = judgeMove(q, uci, wrong.value)
  if (r === 'correct') { solved.value = true; return finish(true) }
  wrong.value++
  if (r === 'retry') { playVerdict(false); message.value = 'Das war es nicht. Versuch es noch einmal.'; return }
  solution.value = [{ orig: answer.slice(0, 2), dest: answer.slice(2, 4), brush: 'green' }]
  finish(false)
}

function onChoice(i: number) { if (done.value) return; picked.value = i; finish(!!question.value?.choices?.[i]?.correct) }
const next = () => reset(qi.value + 1)
</script>

<template>
  <div v-if="!questions.length" class="empty-card pad">
    <p>Keine Fragen zu dieser Variante. Du kannst sie trotzdem festigen.</p>
    <p><a class="primary linkbtn" :href="hrefVariation(variation.id, 'festigen')">Festigen</a></p>
  </div>
  <BoardLayout v-else-if="question">
    <template #left>
      <div class="pane">
        <p class="dotsrow">
          <i v-for="(_, n) in questions" :key="n" :class="{ done: n < qi, cur: n === qi }"></i>
          <span>Frage {{ qi + 1 }} von {{ questions.length }}</span>
        </p>
        <h3>{{ question.prompt }}</h3>
        <div v-if="question.kind === 'choice'" class="choices">
          <button
            v-for="(c, i) in question.choices" :key="c.text" :disabled="done" :class="{ right: done && c.correct, wrong: done && picked === i && !c.correct }" @click="onChoice(i)"
          >{{ c.text }}<span v-if="done && c.correct" class="sign">✓ richtig</span><span v-else-if="done && picked === i" class="sign">✗ falsch</span></button>
        </div>
        <p v-else-if="!done" class="muted">Zieh auf dem Brett (Ziehen oder Klick-Klick).</p>
        <p v-if="message" class="verdict" :class="okMsg ? 'ok-text' : 'err'" role="status">{{ message }}</p>
        <article v-if="done && explanation" class="expl">
          <span class="badge" :class="explanation.status">{{ badgeLabel(explanation.status) }}</span>
          <h3>{{ explanation.title }}</h3>
          <p>{{ explanation.text }}</p>
        </article>
      </div>
      <CoachPanel
        :fen="fen" :own-side="side" mode-key="verstehen" :answered="done"
        :prev-fen="solved && question.kind === 'move' ? props.steps[cur!.idx]!.fen : undefined" :last-uci="solved && question.kind === 'move' ? question.answerUci : undefined"
        book-status="theorie" :explanation="explanation" @shapes="coachShapes = $event"
      />
    </template>
    <template #board>
      <EvalBar :view="ev" :orientation="side" />
      <Board :fen="fen" :orientation="side" :movable="question.kind === 'move' && !done" :layer-lock="!done" :arrows="arrows" :shapes="coachShapes" @move="onMove" />
    </template>
    <template #controls>
      <button v-if="done && qi + 1 < questions.length" class="pri" @click="next">Weiter</button>
      <span v-else-if="done" class="muted">Das war die letzte Frage.</span>
      <span v-else class="muted">Antworte auf dem Brett oder links.</span>
      <span class="pos">{{ qi + 1 }}/{{ questions.length }}</span>
    </template>
    <template #right>
      <EnginePanel :fen="fen" :orientation="side" :lock="done ? null : 'task'" @view="ev = $event" />
    </template>
  </BoardLayout>
</template>
