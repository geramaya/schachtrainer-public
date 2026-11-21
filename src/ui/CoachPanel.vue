<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Explanation, Side } from '../content/types.ts'
import { CancelledError, EngineError } from '../engine/service.ts'
import { cancelEngine, getCoachEngine, resetEngine } from '../engine/instance.ts'
import { COACH_DEPTH, engineReport, sharedCoachCache, limitShapes, staticReport } from '../coach/explain.ts'
import type { BookStatus, Chance, CoachShape, EngineReport, Statement } from '../coach/explain.ts'
import { coachModeFor, withCoachMode } from '../coach/mode.ts'
import type { CoachKey, CoachMode } from '../coach/mode.ts'
import { QUIET } from '../coach/texts.ts'
import { badgeLabel } from '../train/lesson.ts'
import { progress, update } from '../store/state.ts'
import { engineErrorText } from '../content/fetch-bundle.ts'

const props = withDefaults(defineProps<{
  fen: string
  ownSide: Side
  /** which stage's mode setting this panel uses */
  modeKey: CoachKey
  prevFen?: string
  lastUci?: string
  bookStatus?: BookStatus
  explanation?: Explanation
  /** the lesson text is already on screen next to the panel (stage Lernen): only point to it */
  lessonAbove?: boolean
  /** mode "nach dem Zug": the coach talks only once the user has moved/answered */
  answered?: boolean
  /** false while another engine job (sparring move, game review) owns the engine */
  engineEnabled?: boolean
}>(), { engineEnabled: true, answered: false })
const emit = defineEmits<{ shapes: [CoachShape[]] }>()

const MODES: { id: CoachMode; label: string; title: string }[] = [{ id: 'immer', label: 'vorher', title: 'Der Coach erklärt schon vor deinem Zug' }, { id: 'nach-zug', label: 'nachher', title: 'Der Coach erklärt nach deinem Zug' }, { id: 'aus', label: 'aus', title: 'Der Coach ist aus' }]
const cache = sharedCoachCache

const mode = computed(() => coachModeFor(progress.value.settings, props.modeKey))
const setMode = (m: CoachMode) => update((p) => ({ ...p, settings: withCoachMode(p.settings, props.modeKey, m) }))
const visible = computed(() => mode.value === 'immer' || (mode.value === 'nach-zug' && props.answered))

const stat = computed(() => (visible.value ? staticReport({ fen: props.fen, ownSide: props.ownSide, prevFen: props.prevFen, lastUci: props.lastUci, bookStatus: props.bookStatus }) : null))

// ----- engine part -----
const eng = ref<EngineReport | null>(null)
const busy = ref(false)
const engineNote = ref('')
const engineNoteDetail = ref('') // raw message, tooltip only
let token = 0
let running = false
let retries = 0
let retryTimer: ReturnType<typeof setTimeout> | undefined
const RETRY_MS = 500
const MAX_RETRIES = 40

async function runEngine(fresh = true) {
  const mine = ++token
  clearTimeout(retryTimer)
  if (fresh) retries = 0
  if (running) { cancelEngine('coach'); running = false }
  eng.value = null; engineNote.value = ''; busy.value = false
  if (!visible.value || !props.engineEnabled || !stat.value) return
  busy.value = true; running = true
  try {
    const r = await engineReport({ fen: props.fen, ownSide: props.ownSide, prevFen: props.prevFen, lastUci: props.lastUci }, getCoachEngine(), COACH_DEPTH, cache, stat.value.chances)
    if (mine === token) eng.value = r
  } catch (e) {
    if (mine !== token) return
    if (e instanceof CancelledError) { // a game job had the engine: try again once it is free
      if (retries++ < MAX_RETRIES) retryTimer = setTimeout(() => void runEngine(false), RETRY_MS)
      return
    }
    if (e instanceof EngineError) resetEngine('coach')
    engineNote.value = `${engineErrorText(e)} Die Regel-Hinweise bleiben gültig.`
    engineNoteDetail.value = (e as Error).message
  } finally {
    if (mine === token) { busy.value = false; running = false }
  }
}
watch(() => [props.fen, props.prevFen, props.lastUci, visible.value, props.engineEnabled], () => runEngine(), { immediate: true })
onBeforeUnmount(() => { token++; clearTimeout(retryTimer); if (running) cancelEngine('coach'); emit('shapes', []) })

// ----- scroll hint: the lower edge fades while there is more to read below -----
const body = ref<HTMLElement>()
const more = ref(false)
const measure = () => { const b = body.value; more.value = !!b && b.scrollTop + b.clientHeight < b.scrollHeight - 2 }
let ro: ResizeObserver | undefined
onMounted(() => {
  if (typeof ResizeObserver === 'undefined' || !body.value) return
  ro = new ResizeObserver(measure)
  ro.observe(body.value)
  for (const c of Array.from(body.value.children)) ro.observe(c)
})
onBeforeUnmount(() => ro?.disconnect())
watch(() => [props.fen, mode.value, eng.value, stat.value], () => void nextTick(measure))

// ----- display -----
const RANK = { own: 0, opp: 1, weak: 2 }
const chances = computed<Chance[]>(() => [...(stat.value?.chances ?? []), ...(eng.value?.chances ?? [])].sort((a, b) => RANK[a.kind] - RANK[b.kind]))
const onBoard = computed(() => new Set(limitShapes(chances.value).map((s) => s.id)))
const happened = computed<Statement[]>(() => [...(stat.value?.happened ?? []), ...(eng.value?.happened ?? [])])
const why = computed<Statement[]>(() => eng.value?.why ?? [])
const counts = computed(() => {
  const n = (k: string) => chances.value.filter((c) => c.kind === k).length
  return `${n('own')} eigene · ${n('opp')} Gegner · ${n('weak')} Feld`
})
const KIND_WORD = { own: 'Du', opp: 'Gegner', weak: 'Feld' }

const chancesOpen = ref(true)
const hovered = ref<string | null>(null)
const pinned = ref<string | null>(null)
const active = computed(() => hovered.value ?? pinned.value)
const togglePin = (id: string) => { pinned.value = pinned.value === id ? null : id }

const shapes = computed<CoachShape[]>(() => {
  if (!visible.value || !chancesOpen.value) return []
  return limitShapes(chances.value).map((s) => ({ ...s, dim: active.value !== null && s.id !== active.value }))
})
watch(shapes, (s) => emit('shapes', s), { immediate: true, deep: true })
watch(() => props.fen, () => { hovered.value = null; pinned.value = null })
</script>

<template>
  <section class="coach pane" aria-label="Coach">
    <header class="chead">
      <h3>Coach</h3>
      <div class="modes" role="group" aria-label="Wann der Coach erklärt">
        <button v-for="m in MODES" :key="m.id" :class="{ on: mode === m.id }" :aria-pressed="mode === m.id" :title="m.title" @click="setMode(m.id)">{{ m.label }}</button>
      </div>
      <div v-if="$slots.head" class="headx"><slot name="head" /></div>
    </header>

    <div ref="body" class="cbody" :class="{ more }" @scroll="measure">
    <slot />
    <p v-if="mode === 'aus'" class="muted">Der Coach ist aus.</p>
    <p v-else-if="!visible" class="muted">Der Coach erklärt, sobald du gezogen hast.</p>
    <template v-else-if="stat">
      <details v-if="happened.length" :open="!lessonAbove" class="sec">
        <summary>Was ist passiert</summary>
        <p v-for="(s, i) in happened" :key="i">{{ s.text }} <small class="src">{{ s.source }}</small></p>
      </details>

      <details :open="!lessonAbove" class="sec">
        <summary>Warum</summary>
        <p v-if="explanation && lessonAbove" class="muted">Die Lektion steht oben. <small class="src">Lektion</small></p>
        <template v-else-if="explanation">
          <span class="badge" :class="explanation.status">{{ badgeLabel(explanation.status) }}</span>
          <p><b>{{ explanation.title }}</b> {{ explanation.text }} <small class="src">Lektion</small></p>
        </template>
        <p v-for="(s, i) in why" :key="i">{{ s.text }} <small class="src">{{ s.source }}</small></p>
        <p v-if="busy" class="muted" role="status">Stockfish rechnet (Tiefe 14) …</p>
        <p v-else-if="!explanation && !why.length && !engineNote" class="muted">Keine Engine-Aussage für diese Stellung.</p>
        <p v-if="engineNote" class="muted" role="status" :title="engineNoteDetail">{{ engineNote }} <button type="button" @click="resetEngine('coach'); runEngine()">Erneut versuchen</button></p>
      </details>

      <details class="sec" :open="chancesOpen" @toggle="chancesOpen = ($event.target as HTMLDetailsElement).open">
        <summary>Deine Chancen <small class="count">{{ counts }}</small></summary>
        <ul v-if="chances.length" class="chances">
          <li v-for="c in chances" :key="c.id" :class="{ active: active === c.id, off: !onBoard.has(c.id) }"
            @mouseenter="hovered = c.id" @mouseleave="hovered = null" @click="togglePin(c.id)">
            <span class="key" :class="c.kind" aria-hidden="true"><span>{{ c.label }}</span></span>
            <span><b class="who">{{ KIND_WORD[c.kind] }}</b> {{ c.statement.text }} <small class="src">{{ c.statement.source }}</small>
              <small v-if="!onBoard.has(c.id)" class="src"> · nicht auf dem Brett (höchstens 4)</small></span>
          </li>
        </ul>
        <p v-else-if="!busy" class="muted">{{ QUIET }}</p>
        <p v-else class="muted">Stockfish prüft Drohungen …</p>
      </details>

      <details class="sec">
        <summary>Stellung <small class="count">{{ stat.summary }}</small></summary>
        <table class="rows">
          <thead><tr><th></th><th>Weiß</th><th>Schwarz</th></tr></thead>
          <tbody>
            <tr v-for="r in stat.rows" :key="r.label">
              <th scope="row">{{ r.label }}</th>
              <td :class="{ plus: r.edge === 'white' }"><span v-if="r.edge === 'white'">+ </span>{{ r.white }}</td>
              <td :class="{ plus: r.edge === 'black' }"><span v-if="r.edge === 'black'">+ </span>{{ r.black }}</td>
            </tr>
          </tbody>
        </table>
        <small class="src">regel</small>
      </details>
    </template>
    </div>
  </section>
</template>

<style scoped>
.coach { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 12rem; overflow: hidden; }
.chead { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-bottom: 8px; border-bottom: 1px solid var(--line); }
.headx { flex-basis: 100%; }
.cbody { flex: 1; min-height: 0; overflow-y: auto; padding-top: 8px; scrollbar-width: thin; scrollbar-color: var(--line) transparent; }
.cbody.more { -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 36px), transparent); mask-image: linear-gradient(to bottom, #000 calc(100% - 36px), transparent); }
.cbody :deep(p) { max-width: 66ch; }
.chead h3 { margin: 0; }
.modes { display: flex; gap: 4px; margin-left: auto; }
.modes button { background: var(--panel-2); color: var(--text); border: 1px solid var(--line); border-radius: 999px; padding: 0.15rem 0.6rem; font: inherit; font-size: var(--fs-label); min-height: 28px; cursor: pointer; }
.modes button.on { box-shadow: 0 0 0 2px var(--acc); }
.sec { margin: 0.5rem 0; }
.sec summary { cursor: pointer; list-style: none; font-weight: 650; padding: 0.25rem 0; }
.sec summary::before { content: '\25B8'; display: inline-block; width: 1em; transition: transform var(--t-fast) var(--ease-out); }
.sec[open] > summary::before { transform: rotate(90deg); }
.sec p { margin: 0.3rem 0; }
.count { color: var(--muted); font-weight: 400; margin-left: 0.4rem; }
.src { color: var(--muted); font-size: var(--fs-label); }
.chances { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.chances li { display: flex; gap: 8px; align-items: flex-start; padding: 4px 6px; border-radius: 6px; cursor: pointer; border: 1px solid transparent; transition: border-color var(--t-fast) var(--ease-out); }
.chances li:hover, .chances li.active { border-color: var(--line); background: var(--panel-2); }
.chances li.off { opacity: 0.7; }
.key { flex: none; width: 1.5rem; height: 1.5rem; display: grid; place-items: center; color: #fff; font-weight: 700; font-size: 0.8rem; }
.key.own { background: var(--arrow-own); border-radius: 3px; }
.key.opp { background: var(--arrow-opp); border-radius: 50%; }
.key.weak { background: var(--mark-weak); color: var(--ink); transform: rotate(45deg); border-radius: 3px; width: 1.25rem; height: 1.25rem; margin: 0.1rem 0.12rem; }
.key.weak span { transform: rotate(-45deg); }
.who { font-size: var(--fs-label); margin-right: 0.2rem; }
.rows { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.rows th, .rows td { text-align: left; padding: 2px 4px; border-bottom: 1px solid var(--line); vertical-align: top; }
.rows thead th { color: var(--muted); font-weight: 600; }
.plus { color: var(--ok-text); font-weight: 600; }
</style>
