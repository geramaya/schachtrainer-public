<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { hrefHome, hrefMeinePartien, hrefSpielen } from '../router.ts'
import { badgesOf, enrichAll, exportPgn, filterGames, importGames, listGames, removeGame } from '../games/library.ts'
import { eloText, identityOf, parseAccounts, resultClass, resultFor, sideOfPlayer } from '../games/identity.ts'
import { loadEco } from '../openings/eco-load.ts'
import { progress, update } from '../store/state.ts'
import type { ImportReport } from '../games/library.ts'
import { dateDe, dateNote } from '../games/model.ts'
import type { GameResult, StoredGame } from '../games/model.ts'
import { toPgn } from '../games/pgn.ts'
import { gameStore } from '../games/idb.ts'
import { FIGUREN } from '../teacher/avatar.ts'
import { downloadBytes, downloadText } from '../ui/download.ts'
import { pgnFileNames, zipFileName } from '../games/export-names.ts'
import { headState, keepVisible, rangeSelect, setAll, toggle } from '../games/selection.ts'
import { makeZip } from '../games/zip.ts'
import type { Side } from '../content/types.ts'

/** Saved games: list with filter, selection (checkboxes, shift range), PGN/ZIP export (one, selected or all), import, delete with confirmation in the page. */
const MAX_IMPORT_BYTES = 10_000_000
const games = ref<StoredGame[]>([])
const loaded = ref(false)
const problem = ref('')
const text = ref('')
const result = ref<GameResult | 'abgebrochen' | ''>('')
const side = ref<Side | ''>('')
const onlyAnalysed = ref(false)
const confirming = ref<string | null>(null)
const report = ref<ImportReport | null>(null)
const importNote = ref('')
const progressNow = ref<{ done: number; total: number } | null>(null)
let cancelImport = false

const me = computed(() => identityOf(progress.value.settings))
const accountsText = ref(me.value.accounts.join(', '))
const shown = computed(() => filterGames(games.value, { text: text.value, result: result.value || undefined, side: side.value || undefined, analysed: onlyAnalysed.value }, me.value))
const viewSide = (g: StoredGame) => sideOfPlayer(g, me.value)
const sideLabel = (g: StoredGame) => { const s = viewSide(g); return s === 'white' ? 'Weiß' : s === 'black' ? 'Schwarz' : '–' }
const setPlayer = (patch: { name?: string; accounts?: string[] }) => update((p) => ({ ...p, settings: { ...p.settings, player: { ...p.settings.player, ...patch } } }))
const teacherName = (id: string | null) => FIGUREN.find((f) => f.id === id)?.name ?? ''
const day = (g: StoredGame) => dateDe(g)
const resultOf = (g: StoredGame) => resultFor(g, viewSide(g))
/** The Lehrer column only exists if a visible game has a teacher. */
/** "Lade …" only after 400 ms: a short load does not flicker. */
const slow = ref(false)
const slowTimer = setTimeout(() => { slow.value = true }, 400)
const hasTeachers = computed(() => shown.value.some((g) => g.teacher))
const pct = computed(() => (progressNow.value ? Math.round((progressNow.value.done / (progressNow.value.total || 1)) * 100) : 0))

// Selection: ids of rows; it follows the filter and keeps only rows that are shown (a hidden row is never exported or deleted by accident).
const selected = ref<Set<string>>(new Set())
let anchor: string | null = null
const shownIds = computed(() => shown.value.map((g) => g.id))
watch(shownIds, (ids) => { selected.value = keepVisible(selected.value, ids); if (anchor && !ids.includes(anchor)) anchor = null })
const selectedGames = computed(() => shown.value.filter((g) => selected.value.has(g.id)))
const head = computed(() => headState(shownIds.value, selected.value))
const bulkConfirm = ref(false)
watch(() => selectedGames.value.length, (n) => { if (!n) bulkConfirm.value = false })
const actionNote = ref('')
function pick(id: string, e: MouseEvent) {
  selected.value = e.shiftKey ? rangeSelect(selected.value, shownIds.value, anchor, id) : toggle(selected.value, id)
  anchor = id
  if (e.shiftKey) window.getSelection()?.removeAllRanges() // a shift-click must not drag a text selection across the rows
  bulkConfirm.value = false; actionNote.value = ''
}
function pickAll() { selected.value = setAll(selected.value, shownIds.value, head.value !== 'all'); anchor = null; bulkConfirm.value = false; actionNote.value = '' }
const clearSelection = () => { selected.value = new Set(); anchor = null; bulkConfirm.value = false }
const openGame = (g: StoredGame) => { location.hash = hrefMeinePartien(g.id) }

async function load() {
  try {
    games.value = await listGames(gameStore); problem.value = ''
    // games saved before the opening table existed (or while it was not loaded) are completed now, without an engine
    if (games.value.some((g) => !g.enriched)) { const table = await loadEco(); if (table) games.value = await enrichAll(gameStore, games.value, table) }
  } catch (e) { problem.value = (e as Error).message }
  loaded.value = true
  clearTimeout(slowTimer)
}
onMounted(load)
onBeforeUnmount(() => clearTimeout(slowTimer))

async function remove(id: string) {
  confirming.value = null
  try { await removeGame(gameStore, id); await load() } catch (e) { problem.value = (e as Error).message }
}

const exportOne = (g: StoredGame) => downloadText(`schachtrainer-${g.date.slice(0, 10) || 'ohne-datum'}-${g.id}.pgn`, toPgn(g) + '\n', 'application/x-chess-pgn')
const day10 = () => new Date().toISOString().slice(0, 10)
const exportSelectedPgn = () => downloadText(`schachtrainer-auswahl-${day10()}.pgn`, exportPgn(selectedGames.value), 'application/x-chess-pgn')
/** One PGN per game in a ZIP built in the browser (nothing leaves the machine). */
function exportZip(list: StoredGame[]) {
  const names = pgnFileNames(list)
  const enc = new TextEncoder()
  const files = list.map((g, i) => { const d = new Date(g.date); return { name: names[i]!, data: enc.encode(toPgn(g) + '\n'), date: Number.isNaN(d.getTime()) ? new Date() : d } })
  downloadBytes(zipFileName(new Date()), makeZip(files), 'application/zip')
  actionNote.value = `${list.length} ${list.length === 1 ? 'Partie' : 'Partien'} als ZIP gespeichert.`
}
async function removeSelected() {
  const ids = selectedGames.value.map((g) => g.id)
  bulkConfirm.value = false
  try {
    for (const id of ids) await removeGame(gameStore, id)
    actionNote.value = `${ids.length} ${ids.length === 1 ? 'Partie' : 'Partien'} gelöscht.`
  } catch (e) { problem.value = (e as Error).message }
  selected.value = new Set(); anchor = null
  await load()
}
const exportAll = () => downloadText(`schachtrainer-partien-${new Date().toISOString().slice(0, 10)}.pgn`, exportPgn(games.value), 'application/x-chess-pgn')

async function upload(e: Event) {
  const input = e.target as HTMLInputElement
  report.value = null; importNote.value = ''
  const total: ImportReport = { added: 0, duplicates: 0, errors: [] }
  cancelImport = false
  for (const file of Array.from(input.files ?? [])) {
    if (file.size > MAX_IMPORT_BYTES) { importNote.value = `${file.name}: Datei zu groß (höchstens 10 MB).`; continue }
    progressNow.value = { done: 0, total: 0 }
    const r = await importGames(gameStore, await file.text(), { eco: await loadEco(), onProgress: (done, count) => { progressNow.value = { done, total: count } }, cancelled: () => cancelImport })
    total.added += r.added; total.duplicates += r.duplicates; total.errors.push(...r.errors)
    if (r.storageError) { total.storageError = r.storageError; break }
    if (r.cancelled) { total.cancelled = true; break }
  }
  progressNow.value = null
  report.value = total
  input.value = ''
  await load()
}
</script>

<template>
  <div class="partien">
    <div class="pagebar"><p class="crumbs"><a :href="hrefHome()">Start</a> › Meine Partien</p></div>
    <header class="phead">
      <h1>Meine Partien</h1>
      <div class="ptools" aria-label="Export und Import">
        <label class="tbtn filebtn">PGN importieren
          <input id="importfile" class="sr" type="file" accept=".pgn,text/plain,application/x-chess-pgn" multiple :disabled="!!progressNow" @change="upload" />
        </label>
        <button class="tbtn" :disabled="!games.length" @click="exportAll">Alle als PGN</button>
        <button class="tbtn" :disabled="!games.length" @click="exportZip(games)">Alle als ZIP</button>
      </div>
    </header>
    <p v-if="problem" class="err" role="alert">{{ problem }}</p>

    <div v-if="progressNow" class="card report" role="status">
      <div class="pbar" role="progressbar" aria-label="Import" :aria-valuenow="pct" aria-valuemin="0" aria-valuemax="100"><i :style="{ width: pct + '%' }"></i></div>
      <span class="muted">Partie {{ progressNow.done }} von {{ progressNow.total }}</span>
      <button class="tbtn" @click="cancelImport = true">Abbrechen</button>
    </div>
    <p v-if="importNote" class="err" role="alert">{{ importNote }}</p>
    <div v-if="report" class="card report" role="status">
      <p>Import<template v-if="report.cancelled"> (abgebrochen)</template>: <b>{{ report.added }}</b> neu, {{ report.duplicates }} schon vorhanden, {{ report.errors.length }} nicht lesbar.</p>
      <p v-if="report.storageError" class="err" role="alert">{{ report.storageError }}</p>
      <ul v-if="report.errors.length" class="errs">
        <li v-for="e in report.errors.slice(0, 10)" :key="e.index">Partie {{ e.index }} in der Datei: {{ e.message }}</li>
        <li v-if="report.errors.length > 10">… und {{ report.errors.length - 10 }} weitere</li>
      </ul>
    </div>

    <details class="card who">
      <summary><svg class="chev" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 4.5l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>Spieler-Einstellungen</summary>
      <div class="grid">
        <label for="pname">Dein Name</label>
        <input id="pname" :value="me.name" maxlength="40" @change="setPlayer({ name: ($event.target as HTMLInputElement).value })" />
        <label for="paccounts">Deine Konten</label>
        <input id="paccounts" v-model="accountsText" maxlength="200" placeholder="Lichess-, chess.com-Namen, mit Komma getrennt" @change="setPlayer({ accounts: parseAccounts(accountsText) })" />
        <p class="muted hint">Daran erkennt die Liste, ob du in einer importierten Partie Weiß oder Schwarz warst; der Name steht in deinen eigenen Partien.</p>
      </div>
    </details>

    <section class="card list">
      <div v-if="games.length" class="filter" role="search">
        <input v-model="text" type="search" placeholder="Suche: Name, ECO, Eröffnung, Ereignis, Datum" aria-label="Suche" />
        <select v-model="result" aria-label="Ergebnis">
          <option value="">Alle Ergebnisse</option><option value="1-0">1-0</option><option value="0-1">0-1</option><option value="1/2-1/2">Remis</option><option value="*">offen</option><option value="abgebrochen">abgebrochen</option>
        </select>
        <select v-model="side" aria-label="Farbe">
          <option value="">Beide Farben</option><option value="white">Weiß</option><option value="black">Schwarz</option>
        </select>
        <label class="onlyan"><input v-model="onlyAnalysed" type="checkbox" /> nur analysierte</label>
      </div>
      <!-- always there once games exist: it only changes content, never height, so the rows do not jump on the first tick -->
      <div v-if="games.length" class="bulk" role="region" aria-label="Aktionen für die Auswahl">
        <b class="count" :class="{ none: !selectedGames.length }" aria-live="polite">{{ selectedGames.length ? `${selectedGames.length} ausgewählt` : 'Keine Auswahl' }}</b>
        <template v-if="!bulkConfirm">
          <button class="tbtn" :disabled="!selectedGames.length" aria-label="Als PGN (eine Datei)" @click="exportSelectedPgn"><span class="long">Als PGN (eine Datei)</span><span class="short" aria-hidden="true">PGN</span></button>
          <button class="tbtn" :disabled="!selectedGames.length" aria-label="Als ZIP (je Partie eine PGN)" @click="exportZip(selectedGames)"><span class="long">Als ZIP (je Partie eine PGN)</span><span class="short" aria-hidden="true">ZIP</span></button>
          <button class="tbtn danger" :disabled="!selectedGames.length" @click="bulkConfirm = true">Löschen</button>
          <button class="tbtn" :disabled="!selectedGames.length" aria-label="Auswahl aufheben" @click="clearSelection"><span class="long">Auswahl aufheben</span><span class="short" aria-hidden="true">Aufheben</span></button>
        </template>
        <span v-else class="bconfirm" role="alert">
          {{ selectedGames.length }} {{ selectedGames.length === 1 ? 'Partie' : 'Partien' }} löschen?
          <button class="tbtn danger" @click="removeSelected">Ja, löschen</button>
          <button class="tbtn" @click="bulkConfirm = false">Abbrechen</button>
        </span>
        <span v-if="actionNote" class="muted" role="status">{{ actionNote }}</span>
      </div>
            <p v-if="!loaded" class="muted loading">{{ slow ? 'Lade …' : '' }}</p>
      <div v-else-if="!games.length && !problem" class="empty">
        <p class="muted">Noch keine Partien. Beendete Partien aus Sparring und freiem Spiel werden hier automatisch gespeichert.</p>
        <p class="emptyact">
          <label class="tbtn filebtn" for="importfile">PGN importieren</label>
          <a class="tbtn" :href="hrefSpielen()">Partie spielen</a>
        </p>
      </div>
      <p v-else-if="!shown.length" class="muted">Keine Partie passt zum Filter.</p>
      <div v-else class="tablewrap">
        <table class="games">
          <colgroup><col class="c-sel" /><col class="c-date" /><col class="c-names" /><col class="c-res" /><col class="c-side" /><col class="c-elo" /><col class="c-eco" /><col /><col v-if="hasTeachers" class="c-teacher" /><col class="c-marks" /><col class="c-acts" /></colgroup>
          <thead><tr><th class="selcell" @click="pickAll">
            <button type="button" role="checkbox" class="cb" :class="head" :aria-checked="head === 'all' ? 'true' : head === 'some' ? 'mixed' : 'false'" aria-label="Alle gefilterten Partien auswählen"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path v-if="head === 'all'" d="M3.5 8.5l3 3 6-6.5" /><path v-else-if="head === 'some'" d="M4 8h8" /></svg></button>
          </th><th>Datum</th><th>Partie</th><th>Ergebnis</th><th>Farbe</th><th>Elo</th><th>ECO</th><th>Eröffnung</th><th v-if="hasTeachers">Lehrer</th><th><span class="sr">Marken</span></th><th><span class="sr">Aktionen</span></th></tr></thead>
          <tbody>
            <template v-for="g in shown" :key="g.id">
              <tr class="row" :class="{ sel: selected.has(g.id) }" tabindex="0" role="link" :aria-label="`Partie öffnen: ${g.white} gegen ${g.black}, ${day(g)}${g.opening ? ', ' + g.opening : ''}`" @click="openGame(g)" @keydown.enter="openGame(g)" @keydown.space.prevent="openGame(g)">
                <td class="selcell" @click.stop="pick(g.id, $event)" @keydown.stop>
                  <button type="button" role="checkbox" class="cb" :class="selected.has(g.id) ? 'all' : 'none'" :aria-checked="selected.has(g.id)" :aria-label="`Partie auswählen: ${g.white} gegen ${g.black}, ${day(g)}`"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path v-if="selected.has(g.id)" d="M3.5 8.5l3 3 6-6.5" /></svg></button>
                </td>
                <td class="nw" :data-tip="dateNote(g) || undefined">{{ day(g) }}</td>
                <td><div class="clamp">{{ g.white }} – {{ g.black }}</div></td>
                <td class="nw"><span class="res" :class="resultClass(resultOf(g))">{{ resultOf(g) }}</span></td>
                <td class="nw"><template v-if="viewSide(g)"><span class="side-dot" :class="viewSide(g)"></span>{{ viewSide(g) === 'white' ? 'Weiß' : 'Schwarz' }}</template><template v-else>–</template></td>
                <td class="nw">{{ eloText(g) }}</td>
                <td class="nw"><b class="eco">{{ g.eco ?? '' }}</b></td>
                <td>
                  <div class="clamp">{{ g.opening ?? '' }}</div>
                  <span v-if="g.repertoire" class="rep" aria-label="Repertoire getroffen">☰ {{ g.repertoire }}</span>
                </td>
                <td v-if="hasTeachers" class="nw">{{ teacherName(g.teacher) }}</td>
                <td class="marks nw">
                  <svg v-if="badgesOf(g).analysed" class="mk" data-tip="analysiert" role="img" aria-label="analysiert" viewBox="0 0 16 16" width="16" height="16"><path d="M2 13V9m4 4V4m4 9V7m4 6V2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
                  <span v-if="badgesOf(g).learning" class="mk tag" data-tip="Lernpartie: die Uhr stand beim Lehrer-Halt">Lern</span>
                  <span v-if="badgesOf(g).rated" class="mk tag" data-tip="Wertungspartie: ohne Lehrer, ohne Hilfen">Wertung</span>
                  <span v-if="badgesOf(g).timeControl" class="mk tag" data-tip="Bedenkzeit">{{ badgesOf(g).timeControl }}</span>
                </td>
                <td class="acts" @click.stop>
                  <button class="ico" data-tip="PGN dieser Partie laden" aria-label="PGN dieser Partie herunterladen" @click="exportOne(g)">
                    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 2v8m0 0L5 7m3 3 3-3M3 13h10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
                  </button>
                  <button class="ico" data-tip="Partie löschen" aria-label="Partie löschen" @click="confirming = g.id">
                    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
                  </button>
                </td>
              </tr>
              <tr v-if="confirming === g.id" class="confirm">
                <td :colspan="hasTeachers ? 11 : 10" role="alert">
                  Partie {{ day(g) }}, {{ g.white }} – {{ g.black }} wirklich löschen?
                  <button class="tbtn danger" @click="remove(g.id)">Ja, löschen</button>
                  <button class="tbtn" @click="confirming = null">Abbrechen</button>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.partien .card { max-width: none; }
.pagebar { padding-left: 0; }
.phead { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.6rem 1rem; margin-bottom: 0.9rem; }
.phead h1 { margin: 0; }
.ptools { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
@media (max-width: 760px) { .ptools { display: grid; grid-template-columns: 1fr 1fr; width: 100%; } .ptools .tbtn { white-space: normal; height: auto; min-height: 36px; padding: 4px 8px; } }
/* buttons like the controls under the board: 36 px, hover lifts, locked = dashed */
.tbtn { box-sizing: border-box; height: 36px; padding: 0 12px; border-radius: 7px; border: 1px solid var(--line); background: var(--panel-2); color: var(--text); font: inherit; font-size: 15px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; white-space: nowrap; transition: transform var(--t-fast) var(--ease-out), border-color var(--t-fast); }
.tbtn:hover:not(:disabled) { transform: translateY(-2px); border-color: var(--acc); }
.tbtn:disabled { color: var(--muted); border-style: dashed; cursor: default; }
.tbtn.danger { background: none; color: var(--err-text); border-color: var(--err-text); }
.filebtn:focus-within { outline: 2px solid var(--hint); outline-offset: 2px; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.report { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; align-items: center; }
.report .pbar { flex: 1 1 12rem; }
.errs { margin: 0.3rem 0; padding-left: 1.2rem; font-size: var(--fs-small, 0.85rem); flex-basis: 100%; }
.who summary { cursor: pointer; font-weight: 600; list-style: none; display: flex; align-items: center; gap: 0.5rem; }
.who summary::-webkit-details-marker { display: none; }
.who .chev { flex: none; color: var(--muted); transform: rotate(-90deg); transition: transform var(--t-fast) var(--ease-out); }
.who[open] .chev { transform: rotate(0); }
.who .grid { display: grid; grid-template-columns: 9rem minmax(12rem, 28rem); gap: 0.5rem 0.8rem; align-items: center; margin-top: 0.7rem; }
.who .grid label { color: var(--muted); font-size: var(--fs-small, 0.85rem); }
.who .grid input { box-sizing: border-box; height: 36px; background: var(--panel-2); color: var(--text); border: 1px solid var(--line); border-radius: 7px; padding: 0 0.6rem; font: inherit; min-width: 0; }
.who .hint { grid-column: 2; margin: 0; font-size: var(--fs-small, 0.85rem); }
.filter { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.7rem; }
.filter input, .filter select { box-sizing: border-box; height: 36px; background: var(--panel-2); color: var(--text); border: 1px solid var(--line); border-radius: 7px; padding: 0 0.7rem; font: inherit; }
.filter input { flex: 1; min-width: 14rem; }
.filter input::-webkit-search-cancel-button { appearance: none; }
.filter select { appearance: none; padding-right: 2rem; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4.5l4 4 4-4' fill='none' stroke='%23a3aec0' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; cursor: pointer; }
.loading { min-height: 1.5em; }
.empty .emptyact { display: flex; gap: 0.5rem; margin: 0.8rem 0 0.2rem; }
.games { width: 100%; min-width: 960px; table-layout: fixed; border-collapse: collapse; }
.c-sel { width: 2.8rem; } .c-date { width: 6.5rem; } .c-names { width: 22%; } .c-res { width: 7.6rem; } .c-side { width: 6rem; } .c-elo { width: 7rem; } .c-eco { width: 3.6rem; } .c-teacher { width: 7rem; } .c-acts { width: 5rem; } .c-marks { width: 9rem; }
.marks { text-align: right; }
.mk { display: inline-block; vertical-align: middle; margin-left: 6px; color: var(--muted); }
.mk.tag { font: 600 11px/1 var(--mono); padding: 3px 5px; border: 1px solid var(--line); border-radius: 4px; }
.onlyan { display: inline-flex; align-items: center; gap: 6px; height: 36px; color: var(--muted); }
.games th, .games td { text-align: left; padding: 0.35rem 0.5rem; border-bottom: 1px solid var(--line); vertical-align: middle; }
.games thead th { color: var(--muted); font-weight: 600; font-size: var(--fs-small, 0.85rem); }
.nw { white-space: nowrap; }
.clamp { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; line-height: 1.35; overflow-wrap: anywhere; }
/* own checkbox: a button with role=checkbox (Space works natively, Shift is readable on click); focus ring like the rows */
.selcell { text-align: center; padding-left: 0.4rem; padding-right: 0.2rem; }
.cb { box-sizing: border-box; width: 20px; height: 20px; padding: 1px; display: inline-grid; place-items: center; border: 1.5px solid var(--muted); border-radius: 5px; background: var(--panel-2); color: var(--bg); cursor: pointer; line-height: 0; transition: background var(--t-fast), border-color var(--t-fast); }
.cb:hover { border-color: var(--acc); }
.cb:focus-visible { outline: 2px solid var(--hint); outline-offset: 2px; }
.cb.all, .cb.some { background: var(--text); border-color: var(--text); }
.selcell { cursor: pointer; user-select: none; }
.row.sel td { background: rgba(163, 174, 192, 0.08); }
.row.sel td:first-child { box-shadow: inset 3px 0 0 var(--text); }
.cb path { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.bulk { min-height: 54px; box-sizing: border-box; display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-bottom: 0.7rem; padding: 0.5rem 0.7rem; background: var(--panel-2); border: 1px solid var(--line); border-radius: 8px; }
.bulk .count { margin-right: 0.4rem; }
.bulk .short { display: none; }
@media (max-width: 760px) {
  .bulk { display: grid; grid-template-columns: 1fr 1fr; }
  .bulk .count, .bulk .bconfirm, .bulk > .muted { grid-column: 1 / -1; }
  .bulk .long { display: none; }
  .bulk .short { display: inline; }
}
.bulk .count.none { color: var(--muted); font-weight: 400; }
.bconfirm { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; color: var(--err-text); }
.row { cursor: pointer; outline: none; }
.row:hover { background: var(--panel-2); }
.row:focus-visible td { box-shadow: inset 0 2px 0 var(--hint), inset 0 -2px 0 var(--hint); }
.row:focus-visible td:first-child { box-shadow: inset 2px 2px 0 var(--hint), inset 0 -2px 0 var(--hint); }
.row:focus-visible td:last-child { box-shadow: inset -2px 2px 0 var(--hint), inset 0 -2px 0 var(--hint); }
.eco { font-family: var(--mono); color: var(--q-book); }
.rep { display: block; color: var(--muted); font-size: var(--fs-small, 0.85rem); }
.res { font-weight: 600; }
.res-win { color: var(--ok-text); }
.res-loss { color: var(--err-text); }
.res-draw { color: var(--text); }
.res-abort { color: var(--muted); font-style: italic; font-weight: 400; }
.acts { white-space: nowrap; text-align: right; }
.ico { position: relative; box-sizing: border-box; width: 32px; height: 32px; padding: 8px; background: none; border: 1px solid transparent; color: var(--muted); border-radius: 6px; cursor: pointer; line-height: 0; }
.ico + .ico { margin-left: 4px; }
.ico:hover, .ico:focus-visible { color: var(--text); border-color: var(--line); background: var(--panel); }
.confirm td { background: var(--err-tint); border-bottom: 1px solid var(--line); }
.confirm .tbtn { margin-left: 0.5rem; }
/* position: the visually hidden header text (.sr, absolute) must be clipped with the table, else it widens the whole page (measured 924 px at 390) */
.tablewrap { position: relative; }
@media (max-width: 1100px) { .tablewrap { overflow-x: auto; } }
</style>
