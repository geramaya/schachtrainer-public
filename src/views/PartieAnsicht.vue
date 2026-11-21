<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { hrefAnalyse, hrefHome, hrefMeinePartien } from '../router.ts'
import { removeGame, setNote, storageErrorOf } from '../games/library.ts'
import { dateDe, dateNote, siteLink } from '../games/model.ts'
import { IN_DESKTOP_APP } from '../ui/desktop.ts'
import { displayName, identityOf, resultClass, resultFor, sideOfPlayer } from '../games/identity.ts'
import { loadEco } from '../openings/eco-load.ts'
import { enrichOpening } from '../openings/enrich.ts'
import type { StoredGame } from '../games/model.ts'
import { toPgn } from '../games/pgn.ts'
import { gameStore } from '../games/idb.ts'
import { createNoteSaver } from '../games/note-saver.ts'
import type { NoteStatus } from '../games/note-saver.ts'
import { gameFens } from '../train/review.ts'
import { normalizeAnalysis, summarize } from '../analysis/build.ts'
import { analyseStored } from '../analysis/run.ts'
import { moveComment } from '../analysis/comments.ts'
import { moveLabels } from '../analysis/labels.ts'
import { graphMarks } from '../analysis/marks.ts'
import { NAME, SYMBOL } from '../analysis/category.ts'
import { bookPliesOf, pickOpening } from '../train/free-play.ts'
import { repertoireNote } from '../teacher/repertoire.ts'
import { progress } from '../store/state.ts'
import type { ContentBundle } from '../content/types.ts'
import { formatLine } from '../chess/notation.ts'
import { EngineError } from '../engine/service.ts'
import { cancelEngine, getEngine, resetEngine } from '../engine/instance.ts'
import { FIGUREN } from '../teacher/avatar.ts'
import { navTarget, shouldHandleKey } from '../ui/keys.ts'
import { downloadText } from '../ui/download.ts'
import Board from '../ui/Board.vue'
import BoardLayout from '../ui/BoardLayout.vue'
import EvalBar from '../ui/EvalBar.vue'
import EnginePanel from '../ui/EnginePanel.vue'
import MoveList from '../ui/MoveList.vue'
import AnalysisGraph from '../ui/AnalysisGraph.vue'
import AnalysisSummary from '../ui/AnalysisSummary.vue'
import { EMPTY_VIEW } from '../coach/ceval.ts'
import type { EngineView } from '../coach/ceval.ts'

/** One saved game: moves, analysis (categories, graph, comments), own notes, board with engine like the analysis board. */
const props = defineProps<{ id: string; bundle: ContentBundle | null }>()
const ANALYSIS_DEPTH = 12
const game = ref<StoredGame | null>(null)
const problem = ref('')
const loaded = ref(false)
const view = ref(0)
const ev = ref<EngineView>(EMPTY_VIEW)
const confirming = ref(false)
const analysing = ref(false)
const done = ref(0)
const total = ref(0)
let cancelled = false
const noteDraft = ref('')
const noteStatus = ref<NoteStatus | null>(null)

// Notes save themselves: debounced while typing, at once on another move, when leaving. A text always goes to the id and move it was typed for.
const saver = createNoteSaver({
  delayMs: 800,
  schedule: (fn, ms) => setTimeout(fn, ms), cancel: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  onStatus: (s) => { noteStatus.value = s },
  save: async (id, ply, text) => {
    const r = await setNote(gameStore, id, ply, text)
    const g = game.value
    if (r.ok && g && g.id === id) {
      const notes = { ...g.notes }
      if (text.trim()) notes[ply] = text.trim()
      else delete notes[ply]
      game.value = { ...g, notes }
    }
    return r.ok ? { ok: true as const } : { ok: false as const, message: r.message }
  },
})
watch(() => props.id, () => { void saver.flush() }, { flush: 'sync' })

watch(() => props.id, async (id) => {
  cancelled = true // an analysis of the game that was open is not wanted any more (analyseStored stops by isStale)
  loaded.value = false
  try {
    let g = (await gameStore.get(id)) ?? null
    if (g && !g.enriched) { // opening data of an older game: from the table, without an engine, and kept
      const table = await loadEco()
      if (table) { g = enrichOpening(g, table); void gameStore.put(g).catch(() => undefined) }
    }
    game.value = g?.analysis ? { ...g, analysis: normalizeAnalysis(g.analysis, g.startFen, g.ucis) } : g
    problem.value = ''
  } catch (e) { game.value = null; problem.value = storageErrorOf(e).message }
  view.value = game.value ? game.value.ucis.length : 0
  noteStatus.value = null
  loaded.value = true
}, { immediate: true })

const fens = computed(() => (game.value ? gameFens(game.value.startFen, game.value.ucis) : []))
const fen = computed(() => fens.value[view.value] ?? '')
const orientation = computed(() => game.value?.ownSide ?? 'white')
const startPly = computed(() => { const f = game.value?.startFen.split(' '); return f ? (Number(f[5]) - 1) * 2 + (f[1] === 'b' ? 1 : 0) : 0 })
const lastMove = computed<[string, string] | undefined>(() => {
  const u = game.value?.ucis[view.value - 1]
  return u ? [u.slice(0, 2), u.slice(2, 4)] : undefined
})
const SEVERITY = { ungenau: 'Ungenau', fehler: 'Fehler', patzer: 'Patzer' } as const
const marks = computed(() => {
  const m: Record<number, string> = {}
  const r = game.value?.review
  if (!analysis.value) r?.marks.forEach((k) => { m[k.ply + 1] = k.severity })
  if (r?.bookExit != null) m[r.bookExit + 1] = [m[r.bookExit + 1], 'exit'].filter(Boolean).join(' ')
  return m
})
const analysis = computed(() => game.value?.analysis ?? null)
const labels = computed(() => (analysis.value ? moveLabels(analysis.value) : { nags: {}, cats: {}, titles: {} }))
const titles = computed(() => {
  const t: Record<number, string> = { ...labels.value.titles }
  if (!analysis.value) game.value?.review?.marks.forEach((k) => { t[k.ply + 1] = `${SEVERITY[k.severity]}, besser: ${k.betterSan}` })
  return t
})
const summary = computed(() => (game.value && analysis.value ? summarize(analysis.value, game.value.startFen) : null))
const me = computed(() => identityOf(progress.value.settings))
const mySide = computed(() => (game.value ? sideOfPlayer(game.value, me.value) : null))
/** Event of an own game is our own label, not worth showing. */
const event = computed(() => (game.value?.meta?.event && !game.value.meta.event.startsWith('Schachtrainer') ? game.value.meta.event : null))
const site = computed(() => (game.value?.meta?.site && game.value.meta.site !== 'Schachtrainer' ? game.value.meta.site : null))
const siteAs = computed(() => (site.value ? siteLink(site.value) : null))
const teacherName = computed(() => FIGUREN.find((f) => f.id === game.value?.teacher)?.name ?? null)

/** The analysis comment of a move (0-based index), with the repertoire note where the game has a side and the book is loaded. */
function commentAt(i: number): string | null {
  const g = game.value
  const a = analysis.value
  if (!g || !a || i < 0) return null
  const own = g.ownSide
  const bundle = props.bundle
  let repertoire = null
  if (bundle && own) {
    const openingId = pickOpening(bundle, g.ucis.slice(0, i + 1), g.startFen, progress.value.overlays, own)
    if (openingId) repertoire = repertoireNote(g.ucis.slice(0, i), g.ucis[i]!, g.startFen, bundle, openingId, progress.value.overlays, own)
  }
  return moveComment(a, g.startFen, g.ucis, i, { repertoire })
}
const graphMarkList = computed(() => (game.value && analysis.value ? graphMarks(analysis.value, game.value.startFen, game.value.ucis, { comment: commentAt }) : []))

/** The move the board shows (ply = 0-based index), its comment and the own note. */
const ply = computed(() => view.value - 1)
const moveTitle = computed(() => {
  const g = game.value
  const san = g?.sans[ply.value]
  return g && san ? formatLine([san], startPly.value + ply.value) : ''
})
const comment = computed(() => commentAt(ply.value))
const cat = computed(() => analysis.value?.moves[ply.value]?.cat ?? null)
const foreign = computed(() => game.value?.comments?.[ply.value] ?? null)
watch([ply, () => game.value?.id], () => { noteDraft.value = game.value?.notes?.[ply.value] ?? ''; noteStatus.value = null }, { immediate: true })
watch(ply, () => { void saver.flush() }, { flush: 'sync' })
function onNoteInput() {
  const g = game.value
  if (g && ply.value >= 0) saver.change({ id: g.id, ply: ply.value }, noteDraft.value)
}

/** Full analysis with the engine (two lines per position), stored with the game; a result for a game that is no longer shown is dropped. */
async function analyse() {
  const g = game.value
  if (!g || analysing.value) return
  const startedFor = props.id
  analysing.value = true; cancelled = false; done.value = 0; total.value = g.ucis.length + 1; problem.value = ''
  const r = await analyseStored(gameStore, getEngine(), g, {
    depth: ANALYSIS_DEPTH, onProgress: (d, t) => { done.value = d; total.value = t }, isCancelled: () => cancelled, isStale: () => props.id !== startedFor,
    bookPlies: g.ownSide ? bookPliesOf(props.bundle, g.ucis, g.startFen, progress.value.overlays, g.ownSide) : null,
  })
  if (props.id === startedFor) {
    analysing.value = false
    if (r.kind === 'done') game.value = r.game
    else if (r.kind === 'failed') { if (r.error instanceof EngineError) resetEngine(); problem.value = r.message }
    else if (r.kind === 'cancelled') problem.value = 'Analyse abgebrochen.'
  }
}
function cancelAnalysis() { cancelled = true; cancelEngine() }

const exportOne = () => { if (game.value) downloadText(`schachtrainer-${game.value.date.slice(0, 10)}-${game.value.id}.pgn`, toPgn(game.value) + '\n', 'application/x-chess-pgn') }
async function remove() {
  try { await removeGame(gameStore, props.id); location.hash = hrefMeinePartien() } catch (e) { problem.value = (e as Error).message; confirming.value = false }
}

function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  const mods = { alt: e.altKey, ctrl: e.ctrlKey, meta: e.metaKey, shift: e.shiftKey }
  if (!game.value || e.key === ' ' || !shouldHandleKey(e.key, t?.tagName ?? '', !!t?.isContentEditable, mods)) return
  const to = navTarget(e.key, view.value, game.value.ucis.length)
  if (to === null) return
  view.value = to
  e.preventDefault()
}
const flushNow = () => { void saver.flush() }
const onHidden = () => { if (document.visibilityState === 'hidden') flushNow() }
onMounted(() => { window.addEventListener('keydown', onKey); window.addEventListener('pagehide', flushNow); document.addEventListener('visibilitychange', onHidden) })
onBeforeUnmount(() => {
  flushNow(); cancelled = true
  window.removeEventListener('keydown', onKey); window.removeEventListener('pagehide', flushNow); document.removeEventListener('visibilitychange', onHidden)
})
</script>

<template>
  <div class="pagebar"><p class="crumbs"><a :href="hrefHome()">Start</a> › <a :href="hrefMeinePartien()">Meine Partien</a> › Partie</p></div>
  <p v-if="problem" class="err" role="alert">{{ problem }}</p>
  <p v-else-if="loaded && !game" class="muted">Diese Partie ist nicht (mehr) gespeichert. <a :href="hrefMeinePartien()">Zur Liste</a></p>
  <BoardLayout v-if="game">
    <template #left>
      <div class="pane">
        <h2>Partie</h2>
        <dl class="head">
          <dt>Datum</dt><dd :data-tip="dateNote(game) || undefined">{{ dateDe(game) }}</dd>
          <dt>Weiß</dt><dd>{{ displayName(game, 'white') }}</dd>
          <dt>Schwarz</dt><dd>{{ displayName(game, 'black') }}</dd>
          <dt>Ergebnis</dt><dd>{{ game.result }} · <span class="res" :class="resultClass(resultFor(game, mySide))">{{ resultFor(game, mySide) }}</span><template v-if="mySide"> (du: {{ mySide === 'white' ? 'Weiß' : 'Schwarz' }})</template></dd>
          <dt>Eröffnung</dt>
          <dd>
            <template v-if="game.eco || game.opening"><b class="eco">{{ game.eco ?? '' }}</b> {{ game.opening ?? '' }}</template><template v-else>–</template>
            <span v-if="game.detected && (game.detected.eco !== game.eco || game.detected.name !== game.opening)" class="muted sub">Eigene Erkennung: {{ game.detected.eco }} {{ game.detected.name }}</span>
            <span v-if="game.repertoire" class="sub rep">Repertoire: {{ game.repertoire }}</span>
          </dd>
          <template v-if="event"><dt>Ereignis</dt><dd>{{ event }}</dd></template>
          <template v-if="site"><dt>Ort</dt><dd class="ort"><a v-if="siteAs && !IN_DESKTOP_APP" :href="siteAs.href" target="_blank" rel="noopener noreferrer" :data-tip="siteAs.href">{{ siteAs.label }}</a><template v-else>{{ site }}</template></dd></template>
          <template v-if="game.meta?.timeControl"><dt>Bedenkzeit</dt><dd>{{ game.meta.timeControl }}</dd></template>
          <template v-if="teacherName"><dt>Lehrer</dt><dd>{{ teacherName }}</dd></template>
        </dl>
        <p v-if="game.helps" class="muted">Hilfen: Hinweise {{ game.helps.hints }}, Beste Züge {{ game.helps.bests }}, Repertoirezüge {{ game.helps.repertoire ?? 0 }}</p>

        <h3>Analyse</h3>
        <div v-if="analysing" class="run">
          <progress :max="total || 1" :value="done"></progress> <span class="muted">Stellung {{ done }} von {{ total }}</span>
          <button @click="cancelAnalysis">Abbrechen</button>
        </div>
        <template v-else>
          <AnalysisSummary v-if="summary" :summary="summary" :white="game.white" :black="game.black" />
          <p v-if="analysis && analysis.source === 'pgn'" class="muted">Aus der PGN-Datei gelesen (Zeichen und Bewertungen), ohne Engine-Linien.</p>
          <button :class="{ primary: !analysis }" @click="analyse">{{ analysis ? 'Neu analysieren' : 'Analysieren' }}</button>
          <p v-if="!analysis" class="muted">Noch keine Analyse. Sie wird mit der Partie gespeichert und nicht neu gerechnet.</p>
        </template>

        <section v-if="view > 0" class="comment" :class="cat ? `q-${cat}` : ''" aria-label="Kommentar zum Zug">
          <h3>Zug {{ moveTitle }}<span v-if="cat" class="chip"><b class="sym">{{ SYMBOL[cat] }}</b> {{ NAME[cat] }}</span></h3>
          <p v-if="comment" class="said">{{ comment }}</p>
          <p v-if="foreign" class="muted">Kommentar aus der Datei: {{ foreign }}</p>
          <label class="note">Eigene Notiz zu diesem Zug
            <textarea v-model="noteDraft" rows="2" maxlength="500" @input="onNoteInput"></textarea>
            <span class="status" role="status">
              <template v-if="noteStatus?.kind === 'saving'">speichert …</template>
              <template v-else-if="noteStatus?.kind === 'saved'">gespeichert ✓</template>
              <template v-else-if="noteStatus?.kind === 'error'"><span class="err">{{ noteStatus.message }}</span></template>
            </span>
          </label>
        </section>

        <template v-if="game.review && !analysis">
          <h3>Auswertung</h3>
          <p v-if="!game.review.marks.length">Keine Ungenauigkeiten gefunden.</p>
          <ul v-else class="errors">
            <li v-for="m in game.review.marks" :key="m.ply">
              <button :class="{ on: view === m.ply + 1 }" @click="view = m.ply + 1">
                <b>{{ SEVERITY[m.severity] }}</b> Zug {{ m.ply + 1 }} (−{{ (m.lossCp / 100).toFixed(1) }}) · besser: {{ m.betterSan }}
              </button>
            </li>
          </ul>
          <p v-if="game.review.bookExit !== null" class="muted">Buchausstieg bei Zug {{ game.review.bookExit + 1 }}.</p>
        </template>
        <p v-if="game.retractions.length" class="muted">Zurückgenommen: {{ game.retractions.map((r) => r.san).join(', ') }}</p>
        <div class="acts">
          <button @click="exportOne">PGN exportieren</button>
          <template v-if="confirming">
            <span role="alert">Partie löschen?</span>
            <button class="danger" @click="remove">Ja, löschen</button>
            <button @click="confirming = false">Abbrechen</button>
          </template>
          <button v-else @click="confirming = true">Löschen</button>
        </div>
      </div>
    </template>
    <template #board>
      <EvalBar :view="ev" :orientation="orientation" />
      <Board :fen="fen" :orientation="orientation" :movable="false" :arrows="ev.arrows" :last-move="lastMove" />
    </template>
    <template #controls>
      <button :disabled="view === 0" aria-label="Zum Anfang" @click="view = 0">⇤</button>
      <button :disabled="view === 0" aria-label="Ein Zug zurück" @click="view--">◀</button>
      <button :disabled="view === game.ucis.length" aria-label="Ein Zug vor" @click="view++">▶</button>
      <button :disabled="view === game.ucis.length" aria-label="Zum Ende" @click="view = game.ucis.length">⇥</button>
      <a class="pbtn" :href="hrefAnalyse(fen)">Im Analysebrett weiterspielen</a>
    </template>
    <template #right>
      <EnginePanel :fen="fen" :orientation="orientation" :analyse-link="false" :lock="analysing ? 'busy' : null" @view="ev = $event" />
      <MoveList :sans="game.sans" :current="view" :start-ply="startPly" :marks="marks" :titles="titles" :nags="labels.nags" :cats="labels.cats" @select="view = $event" />
      <AnalysisGraph v-if="analysis" class="graphbox" :positions="analysis.positions" :marks="graphMarkList" :current="view" @select="view = $event" />
    </template>
  </BoardLayout>
</template>

<style scoped>
.head { display: grid; grid-template-columns: auto 1fr; gap: 4px 0.8rem; margin: 0.4rem 0 0.8rem; align-items: baseline; }
.head dt { color: var(--muted); font-size: var(--fs-small, 0.85rem); }
.head dd { margin: 0; font-size: var(--fs-body, 1rem); overflow-wrap: anywhere; }
.head .ort a { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text); text-decoration: underline; text-decoration-color: var(--line); }
.res { font-weight: 600; }
.res-win { color: var(--ok-text); }
.res-loss { color: var(--err-text); }
.res-draw { color: var(--text); }
.res-abort { color: var(--muted); font-style: italic; font-weight: 400; }
.head .eco { font-family: var(--mono); color: var(--q-book); }
.head .sub { display: block; font-size: var(--fs-label, 0.75rem); }
.head .rep { color: var(--muted); }
.errors { list-style: none; padding: 0; margin: 0.4rem 0; display: grid; gap: 4px; }
.errors button { width: 100%; background: var(--panel-2); color: var(--text); border: 1px solid var(--line); border-radius: 6px; padding: 0.3rem 0.6rem; cursor: pointer; font: inherit; text-align: left; }
.errors button.on { border-color: var(--acc); }
.acts button, .run button, .pane > button { background: var(--panel-2); color: var(--text); border: 1px solid var(--line); border-radius: 7px; padding: 0.3rem 0.7rem; font: inherit; cursor: pointer; }
.acts button.danger { border-color: var(--err, #c62f2f); }
.acts { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 0.8rem; }
.run progress { width: 100%; }
.comment { margin: 0.8rem 0; padding: 0.5rem 0.7rem; background: var(--panel-2); border-radius: 8px; border-left: 4px solid var(--qc, var(--line)); }
.comment h3 { margin-top: 0; }
.comment .said { margin: 0.3rem 0; }
.chip { margin-left: 0.6rem; font-size: var(--fs-small, 0.85rem); color: var(--qc); font-weight: 600; }
.chip .sym { font-family: var(--mono); }
.note { display: grid; gap: 4px; font-size: var(--fs-small, 0.85rem); color: var(--muted); }
.note textarea { background: var(--panel-2); color: var(--text); border: 1px solid var(--line); border-radius: 6px; padding: 0.3rem 0.5rem; font: inherit; resize: vertical; }
.status { min-height: 1.2em; }
.graphbox { flex: none; margin-top: 8px; }
</style>
