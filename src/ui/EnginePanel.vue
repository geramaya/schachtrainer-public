<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { Side } from '../content/types.ts'
import { createLiveController } from '../engine/liveController.ts'
import type { LiveState } from '../engine/liveController.ts'
import { engineEpoch, getCoachEngine, resetEngine } from '../engine/instance.ts'
import { engineArrows, shownScore, summarize } from '../coach/ceval.ts'
import type { EngineView, PvMove, Score } from '../coach/ceval.ts'
import { scoreLabel } from '../coach/ceval.ts'
import { evalPov, povSign, setEvalPov, parsePov } from './orientation.ts'
import { DEPTH_RANGE, MULTIPV_RANGE, engineAccess } from '../coach/cevalSettings.ts'
import type { EngineLock, EngineSettings } from '../coach/cevalSettings.ts'
import { hrefAnalyse } from '../router.ts'
import MiniBoard from './MiniBoard.vue'
import { engineSettings, lehrgangEngineSettings, setEngineSettings, setLehrgangEngineSettings } from './useEngineSettings.ts'
import { engineErrorText } from '../content/fetch-bundle.ts'
import { EngineError } from '../engine/service.ts'

const props = withDefaults(defineProps<{
  fen: string
  orientation: Side
  /** `task`: an exercise is open (nothing is computed); `busy`: a game job owns the engine */
  lock?: EngineLock
  /** offers the link to the analysis board (off on the analysis board itself) */
  analyseLink?: boolean
  /** teacher game: the player may lift the lock on purpose (counts as a help, the caller decides) */
  unlockable?: boolean
  /** text of the locked state when the default does not fit (Wertungspartie) */
  lockedText?: string
  /** which persistent setting set the field uses: the whole app, or the Lehrgang prototype (own key, off by default) */
  scope?: 'app' | 'lehrgang'
}>(), { lock: null, analyseLink: true, unlockable: false, lockedText: '', scope: 'app' })
const emit = defineEmits<{ view: [EngineView]; unlock: [] }>()

const settings = computed(() => (props.scope === 'lehrgang' ? lehrgangEngineSettings.value : engineSettings.value))
const setSettings = (patch: Partial<EngineSettings>) => (props.scope === 'lehrgang' ? setLehrgangEngineSettings(patch) : setEngineSettings(patch))

/** Scores come from White view; with the setting "from the bottom side" they flip when Black stands at the bottom. */
const lab = (s: Score): string => (povSign(evalPov.value, props.orientation) === 1 ? scoreLabel(s) : scoreLabel({ cp: s.cp === null ? null : -s.cp, mate: s.mate === null ? null : -s.mate }))
const access = computed(() => engineAccess(settings.value.enabled, props.lock))
const state = ref<LiveState | null>(null)
let usedEpoch = 0 // instance of the engine the running analysis belongs to: a late error of a replaced worker must not reset its successor
const controller = createLiveController({
  engine: () => { const e = getCoachEngine(); usedEpoch = engineEpoch(); return e },
  onState: (s) => { state.value = s },
  onEngineError: () => resetEngine('coach', usedEpoch),
})

watch(
  () => [props.fen, access.value, settings.value.multipv, settings.value.depth] as const,
  ([fen, acc, multipv, depth]) => {
    if (acc === 'on') controller.run(fen, { multipv, depth })
    else { controller.stop(); state.value = null }
  },
  { immediate: true },
)
/** "Erneut versuchen": a fresh worker and a new run for the shown position. */
function retry() {
  resetEngine('coach')
  if (access.value === 'on') controller.run(props.fen, { multipv: settings.value.multipv, depth: settings.value.depth })
}
onBeforeUnmount(() => { controller.stop(); emit('view', { score: null, arrows: [], access: 'off' }) })

/** Only a result of the shown position counts; while the next one is computing the last score stays on the bar. */
const summary = computed(() => (state.value?.analysis && state.value.fen === props.fen ? summarize(state.value.analysis, props.fen) : null))
const held = ref<Score | null>(null)
watch(summary, (s) => { if (s?.best) held.value = s.best })
const here = computed(() => (state.value?.fen === props.fen ? state.value : null))
watch(() => here.value?.ended || !!here.value?.error, (stale) => { if (stale) held.value = null }) // no old value may survive a finished position or an engine error
const score = computed(() => {
  if (access.value === 'busy') return held.value
  if (access.value !== 'on') return null
  return shownScore({ fen: props.fen, ended: here.value?.ended ?? false, error: here.value?.error ?? '', best: summary.value?.best ?? null, held: held.value })
})
const arrows = computed(() => (access.value === 'on' && summary.value ? engineArrows(summary.value.lines) : []))
watch([score, arrows, access, () => settings.value.showBar, () => settings.value.showLines], () => {
  const { showBar, showLines } = settings.value
  emit('view', { score: showBar ? score.value : null, arrows: showLines ? arrows.value : [], access: showBar ? access.value : 'off' })
}, { immediate: true })

const running = computed(() => state.value?.running ?? false)
const depthShown = computed(() => summary.value?.depth ?? 0)

// preview of a move of a line (hover, focus or click-to-pin) on a small board; the main board stays untouched
const hovered = ref<PvMove | null>(null)
const pinned = ref<PvMove | null>(null)
const preview = computed(() => hovered.value ?? pinned.value)
const previewLast = computed<[string, string] | undefined>(() => (preview.value ? [preview.value.uci.slice(0, 2), preview.value.uci.slice(2, 4)] : undefined))
watch(() => props.fen, () => { hovered.value = null; pinned.value = null })
const togglePin = (m: PvMove) => { pinned.value = pinned.value?.fen === m.fen ? null : m }

const onToggle = (e: Event) => {
  const box = e.target as HTMLInputElement
  if (access.value === 'locked') { box.checked = settings.value.enabled; if (props.unlockable) emit('unlock'); return }
  setSettings({ enabled: box.checked })
}
const onFlag = (key: 'showBar' | 'showLines' | 'whileThinking', e: Event) => setSettings({ [key]: (e.target as HTMLInputElement).checked })
const onLines = (e: Event) => setSettings({ multipv: Number((e.target as HTMLSelectElement).value) })
const onDepth = (e: Event) => setSettings({ depth: Number((e.target as HTMLInputElement).value) })
const settingsOpen = ref(false)
const lineCounts = Array.from({ length: MULTIPV_RANGE.max - MULTIPV_RANGE.min + 1 }, (_, i) => MULTIPV_RANGE.min + i)
</script>

<template>
  <section class="ceval pane" aria-label="Engine">
    <header class="chead">
      <div class="hl">
        <label class="switch" :class="{ locked: access === 'locked' }" :title="access === 'locked' ? (unlockable ? 'Stockfish ist im Spiel mit Lehrer gesperrt – klicken hebt die Sperre auf (zählt als Hilfe)' : 'Stockfish: gesperrt, bis du gezogen hast') : 'Stockfish ein oder aus'">
          <input type="checkbox" role="switch" :checked="settings.enabled" aria-label="Stockfish ein oder aus" @change="onToggle" />
          <span class="knob" aria-hidden="true"></span>
          <b>Stockfish</b>
        </label>
        <span v-if="access === 'on' && summary?.best" class="best" :aria-label="`Beste Bewertung (Sicht ${evalPov === 'white' ? 'Weiß' : 'der unteren Seite'})`">{{ lab(summary.best) }}</span>
      </div>
      <div class="hr">
        <span v-if="access === 'locked'" class="depth lockword">gesperrt</span>
        <span v-if="access === 'on'" class="depth">
          <span class="w">Tiefe </span>{{ depthShown }}/{{ settings.depth }}
          <span v-if="running" class="spin" role="status" aria-label="Stockfish rechnet"></span>
        </span>
        <button v-if="access !== 'locked'" type="button" class="ico" :class="{ open: settingsOpen }" :aria-expanded="settingsOpen" aria-controls="engine-settings" title="Einstellungen" aria-label="Einstellungen" @click="settingsOpen = !settingsOpen">⚙</button>
        <a v-if="analyseLink && access !== 'locked'" class="ico" :href="hrefAnalyse(fen)" title="Analysebrett ab hier" aria-label="Analysebrett ab hier">⤢</a>
      </div>
    </header>

    <div v-if="settingsOpen && access !== 'locked'" id="engine-settings" class="opts" @keydown.escape="settingsOpen = false">
      <label>Linien
        <select :value="settings.multipv" @change="onLines"><option v-for="n in lineCounts" :key="n" :value="n">{{ n }}</option></select>
      </label>
      <label>Bewertung aus Sicht
        <select :value="evalPov" @change="setEvalPov(parsePov(($event.target as HTMLSelectElement).value))"><option value="white">Weiß</option><option value="bottom">unten stehende Seite</option></select>
      </label>
      <label><input type="checkbox" :checked="settings.showBar" @change="onFlag('showBar', $event)" /> Bewertungsbalken anzeigen</label>
      <label><input type="checkbox" :checked="settings.showLines" @change="onFlag('showLines', $event)" /> Varianten und Pfeile anzeigen</label>
      <label><input type="checkbox" :checked="settings.whileThinking" @change="onFlag('whileThinking', $event)" /> Auch während Stockfish denkt (Partie)</label>
      <label>Höchsttiefe <b>{{ settings.depth }}</b>
        <input type="range" :min="DEPTH_RANGE.min" :max="DEPTH_RANGE.max" :value="settings.depth" aria-label="Höchsttiefe der Analyse" @change="onDepth" />
      </label>
    </div>

    <div class="body" :style="{ '--lines': settings.multipv }">
      <p v-if="access === 'locked'" class="note" role="status">{{ lockedText || (unlockable ? 'Im Spiel mit Lehrer gesperrt.' : 'Bewertung und Varianten nach deinem Zug verfügbar.') }} <button v-if="unlockable" type="button" class="unlock" @click="emit('unlock')">Trotzdem anzeigen (zählt als Hilfe)</button></p>
      <p v-else-if="access === 'off'" class="note">Engine aus. Schalter oben einschalten.</p>
      <p v-else-if="access === 'busy'" class="note" role="status">Die Engine ist gerade mit der Partie beschäftigt.</p>
      <template v-else>
        <p v-if="state?.ended" class="note">Stellung beendet: kein Zug mehr möglich.</p>
        <p v-else-if="state?.error" class="note" role="status" :title="state.error">{{ engineErrorText(new EngineError(state.error)) }} <button type="button" @click="retry">Erneut versuchen</button></p>
        <p v-else-if="!summary" class="note" role="status">Stockfish rechnet …</p>
        <p v-else-if="!settings.showLines" class="note">Varianten ausgeblendet (⚙ Einstellungen).</p>
        <ol v-else class="pvs">
          <li v-for="(l, i) in summary.lines" :key="i">
            <b class="sc">{{ lab(l.score) }}</b>
            <span class="mv">
              <template v-for="(m, j) in l.moves" :key="j">
                <i v-if="m.num" class="num">{{ m.num }}</i>
                <button type="button" class="san" :class="{ pin: pinned?.fen === m.fen }" @mouseenter="hovered = m" @mouseleave="hovered = null" @focus="hovered = m" @blur="hovered = null" @click="togglePin(m)">{{ m.san }}</button>
              </template>
            </span>
          </li>
        </ol>
        <div v-if="preview" class="preview"><MiniBoard :fen="preview.fen" :orientation="orientation" :last-move="previewLast" /></div>
      </template>
  
    </div>
  </section>
</template>

<style scoped>
.ceval { padding: 8px 12px 10px; }
.ceval { container-type: inline-size; }
.chead { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 2px 8px; min-height: 30px; }
.hl, .hr { display: flex; align-items: center; gap: 8px; min-width: 0; }
.hr { gap: 4px; margin-left: auto; }
@container (max-width: 330px) { .depth .w { display: none; } }
@container (max-width: 230px) { .switch b { display: none; } }
.switch { display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer; }
.switch input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.knob { position: relative; width: 30px; height: 17px; border-radius: 9px; background: var(--line); transition: background var(--t-fast); flex: none; }
.knob::after { content: ''; position: absolute; top: 2px; left: 2px; width: 13px; height: 13px; border-radius: 50%; background: var(--text); transition: transform var(--t-fast) var(--ease-out); }
.switch input:checked + .knob { background: var(--ok); }
.switch input:checked + .knob::after { transform: translateX(13px); background: var(--ink); }
.switch input:focus-visible + .knob { outline: 2px solid var(--acc); outline-offset: 2px; }
.lockword { font-size: var(--fs-label); }
.switch.locked input:checked + .knob, .switch.locked .knob { background: var(--line); }
.switch.locked input:checked + .knob::after, .switch.locked .knob::after { background: var(--muted); }
.best { font: 700 16px/1 var(--mono); }
.depth { white-space: nowrap; font: 500 11px/1 var(--mono); color: var(--muted); }
.ico { background: none; border: 0; color: var(--muted); font-size: 16px; line-height: 1; padding: 2px; border-radius: 5px; cursor: pointer; }
.ico:hover, .ico.open { color: var(--text); background: var(--panel-2); }
.spin { display: inline-block; width: 9px; height: 9px; margin-left: 3px; border: 2px solid var(--muted); border-top-color: transparent; border-radius: 50%; animation: spin 0.9s linear infinite; vertical-align: -1px; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spin { animation: none; border-top-color: var(--muted); } }
/* the lines area keeps the height of the configured number of lines: no jump when the lines arrive or the position changes */
.body { min-height: calc(var(--lines) * (1.75 * var(--fs-small) + 1px) + 4px); }
.note { margin: 6px 0 0; padding: 8px 10px; border: 1px dashed var(--line); border-radius: 8px; color: var(--muted); font-size: var(--fs-small); }
.pvs { list-style: none; margin: 4px 0 0; padding: 0; }
.pvs li { display: flex; gap: 10px; align-items: baseline; border-top: 1px solid var(--line); font: 500 var(--fs-small)/1.75 var(--mono); white-space: nowrap; }
.sc { flex: none; width: 3.2em; text-align: right; font-weight: 700; }
.mv { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; color: var(--muted); }
.num { font-style: normal; color: var(--muted); margin: 0 2px 0 6px; }
.san { background: none; border: 0; color: var(--text); font: inherit; padding: 0 2px; border-radius: 3px; cursor: pointer; }
.san:hover, .san:focus-visible, .san.pin { background: var(--panel-2); outline: 1px solid var(--acc); }
.preview { margin-top: 8px; }
.opts { margin-top: 6px; padding: 8px 10px; background: var(--panel-2); border: 1px solid var(--line); border-radius: 8px; font-size: var(--fs-small); }
.opts label { display: flex; align-items: center; gap: 0.6rem; margin: 0.3rem 0; }
.opts input[type='range'] { flex: 1; }
.unlock { margin-top: 4px; cursor: pointer; }
</style>
