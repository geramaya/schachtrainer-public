<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Arrow } from '../content/types.ts'
import { applyUci } from '../chess/game.ts'
import { toGermanSan } from '../chess/notation.ts'
import { hrefKurse, hrefLehrgang, hrefLehrgangSystem } from '../router.ts'
import { checkMove, isOwnPly, nextOwnPly } from '../lehrgang/loop.ts'
import { missFeedback } from '../lehrgang/feedback.ts'
import type { Miss } from '../lehrgang/feedback.ts'
import type { Modus } from '../lehrgang/loop.ts'
import { doneFalle, doneStep, ensureLehrgaenge, lehrgaenge, lehrgangFehler } from '../lehrgang/state.ts'
import { isTodo } from '../lehrgang/types.ts'
import type { Variante } from '../lehrgang/types.ts'
import { lehrgangGefuehl } from '../lehrgang/mood.ts'
import { progress, update } from '../store/state.ts'
import { FIGUREN, teacherOf } from '../teacher/avatar.ts'
import type { TeacherSettings } from '../teacher/avatar.ts'
import TeacherCard from '../ui/TeacherCard.vue'
import { markenOf, quellenLinks } from '../lehrgang/marks.ts'
import { isFlipKey, isHintKey, keyTag, navTarget, shouldHandleKey } from '../ui/keys.ts'
import Board from '../ui/Board.vue'
import BoardLayout from '../ui/BoardLayout.vue'
import { variantTitles } from '../lehrgang/title.ts'
import { CATALOG } from '../content/catalog.ts'
import ModeTabs from '../ui/ModeTabs.vue'
import MoveList from '../ui/MoveList.vue'
import SatzAudio from '../ui/SatzAudio.vue'
import { flipKey, lehrgangOrientation } from '../lehrgang/board.ts'
import { flipSide, rememberOrientation, savedOrientation } from '../ui/orientation.ts'
import EvalBar from '../ui/EvalBar.vue'
import EnginePanel from '../ui/EnginePanel.vue'
import { EMPTY_VIEW } from '../coach/ceval.ts'
import type { EngineView } from '../coach/ceval.ts'
import { engineLockFor, hasEngine, uebenEngineTask } from '../lehrgang/engine.ts'
import { loadAudioManifest } from '../audio/manifest.ts'
import { lehrgangAudioFile } from '../audio/lehrgang-audio.ts'
import { playAudioFile, stopQuip } from '../audio/play-quip.ts'

const props = defineProps<{ id: string; kind: 'v' | 'f' | 'm' | 's'; itemId: string; /** Step the page starts in (from the system page). */ modus?: 'gefuehrt' | 'kopf' }>()
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const OPPONENT_PAUSE_MS = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 400

onMounted(() => void ensureLehrgaenge())
const lg = computed(() => lehrgaenge.value?.find((l) => l.id === props.id))
/** A model game of the Lehrgang, or of a system (item id "<system>/<game>"). */
const muster = computed(() => (props.kind === 'm' ? [...(lg.value?.musterpartien ?? []), ...(lg.value?.systeme ?? []).flatMap((s) => s.musterpartien.map((m) => ({ ...m, id: `${s.id}/${m.id}` })))].find((x) => x.id === props.itemId) : undefined))
const system = computed(() => lg.value?.systeme?.find((s) => s.id === (props.kind === 's' ? props.itemId : props.itemId.split('/')[0])))
/** A model game is walked like a variety: its comments become the sentences of the plies they belong to, the other plies have none. */
const v = computed<Variante | undefined>(() => {
  if (props.kind === 'v') return lg.value?.varianten.find((x) => x.id === props.itemId)
  if (props.kind === 's') return system.value && { id: system.value.id, name: system.value.titel, stufe: 'kern', anteil: null, haeufigkeit: null, vorlaeufig: false, veraltet: false, ziel: [], zuege: system.value.hauptlinie.zuege }
  const m = muster.value
  if (!m) return undefined
  return { id: m.id, name: m.titel, stufe: 'kern', anteil: null, haeufigkeit: null, vorlaeufig: false, veraltet: false, ziel: [], zuege: m.zuege.map((z, i) => { const k = m.kommentare.find((c) => c.ply === i + 1); return { ...z, satz: k?.satz ?? '', ...(k ? { pfeile: k.pfeile, felder: k.felder, quelle: k.quelle } : {}) } }) }
})
const falle = computed(() => (props.kind === 'f' ? lg.value?.fallen.find((x) => x.id === props.itemId) : undefined))
const title = computed(() => (props.kind === 's' && system.value ? `Hauptlinie: ${isTodo(system.value.titel) ? 'System' : system.value.titel}` : muster.value ? (isTodo(muster.value.titel) ? 'Musterpartie (Titel folgt)' : muster.value.titel) : v.value && lg.value ? variantTitles(lg.value.varianten, lg.value.entry).get(v.value.id) : undefined))
const musterAngaben = computed(() => { const m = muster.value; return m && !isTodo(m.weiss) ? `${m.weiss} – ${m.schwarz}, ${m.jahr}, ${m.event}` : 'Spieler, Jahr und Turnier folgen.' })
const musterQuelle = computed(() => quellenLinks(muster.value ? [muster.value.quelle] : []))
const ziel = computed(() => (props.kind === 'v' ? (v.value?.ziel ?? []) : []))
const zielLinks = (q: string[] | undefined) => quellenLinks(q ?? [])

/** The teacher is the one chosen in the game (remembered in the settings); here he only explains, so no quip switches. */
const teacher = computed(() => teacherOf(progress.value.settings))
const teacherName = computed(() => FIGUREN.find((f) => f.id === teacher.value.figur)!.name)
const setTeacher = (patch: Partial<TeacherSettings>) => update((p) => ({ ...p, settings: { ...p.settings, teacher: { ...p.settings.teacher, ...patch } } }))
const lob = ref(false)
const side = computed(() => lg.value?.side ?? 'white')

/** fens[i] = position after i plies of the variety. */
const fens = computed(() => {
  const out = [START]
  for (const z of v.value?.zuege ?? []) { const r = applyUci(out[out.length - 1]!, z.uci); if (!r) break; out.push(r.fen) }
  return out
})
const n = computed(() => v.value?.zuege.length ?? 0)

const modus = ref<Modus>('vorfuehren')
const pos = ref(0)
const mistakes = ref(0)
const hintLevel = ref(0)
const miss = ref<Miss | null>(null)
const attempts = ref(0)
const lastPlayed = ref<{ san: string; uci: string } | null>(null)
const message = ref('')
const solved = ref(false)
/** Ply after which the info marks of the move just played stay on the board (Nachspielen); any later move clears them. */
const infoPly = ref(-1)
const flash = ref<{ square: string; kind: 'ok' | 'err' } | null>(null)
const wobble = ref(false)
const showArrow = ref<Arrow[]>([])
const timers: ReturnType<typeof setTimeout>[] = []
const later = (fn: () => void, ms: number) => { timers.push(setTimeout(fn, ms)) }
const clear = () => { while (timers.length) clearTimeout(timers.pop()) }
onBeforeUnmount(() => { clear(); stopQuip() })


/** "Vorlesen": reads the sentence of the move just shown aloud (remembered, off by default); the shared player never overlaps, leaving stops it. */
const VORLESEN_KEY = 'schachtrainer.lehrgang.vorlesen'
const readStored = (): boolean => { try { return localStorage.getItem(VORLESEN_KEY) === '1' } catch { return false } }
const vorlesen = ref(readStored())
function setVorlesen(on: boolean) { vorlesen.value = on; try { localStorage.setItem(VORLESEN_KEY, on ? '1' : '0') } catch { /* private mode: stays for this session */ } if (!on) stopQuip() }
async function speakSatz(text: string) {
  stopQuip()
  const file = lehrgangAudioFile(await loadAudioManifest(), text)
  if (file) await playAudioFile(file)
}

const MODI: { id: Modus; label: string; hint: string }[] = [
  { id: 'vorfuehren', label: '1 Vorführen', hint: 'Zug für Zug, mit Pfeil und Erklärung' },
  { id: 'gefuehrt', label: '2 Nachspielen', hint: 'Du ziehst, Hinweis möglich' },
  { id: 'kopf', label: '3 Aus dem Kopf', hint: 'Ohne Hilfe, Fehler werden erklärt' },
]
const practising = computed(() => modus.value !== 'vorfuehren')
const myTurn = computed(() => practising.value && !solved.value && pos.value < n.value && isOwnPly(side.value, pos.value))
/** The trap after its solution: marks and sentence belong to the board after the move. */
const falleGeloest = computed(() => (falle.value && solved.value ? applyUci(falle.value.fen, falle.value.loesungUci)?.fen : undefined))
const fen = computed(() => (falle.value ? (falleGeloest.value ?? falle.value.fen) : fens.value[Math.min(pos.value, fens.value.length - 1)]!))
/** Whose sentence is explained on the board right now: its marks (arrows/circles after the move) and sources are shown with it. */
const info = computed(() => {
  if (falle.value) return solved.value ? falle.value : null
  if (modus.value === 'vorfuehren') return pos.value > 0 ? v.value?.zuege[pos.value - 1] ?? null : null
  return modus.value === 'gefuehrt' && infoPly.value === pos.value && pos.value > 0 ? v.value?.zuege[pos.value - 1] ?? null : null
})
const marks = computed(() => markenOf(info.value))
const quellen = computed(() => quellenLinks(info.value?.quelle ?? []))
const lastMove = computed<[string, string] | undefined>(() => { const z = v.value?.zuege[pos.value - 1]; return z ? [z.uci.slice(0, 2), z.uci.slice(2, 4)] : undefined })
const arrow = (uci: string, brush: Arrow['brush']): Arrow[] => [{ orig: uci.slice(0, 2), dest: uci.slice(2, 4), brush }]
/** System prototype: start = side of the Lehrgang, then only the user turns the board (shared with the system page). */
const chosen = ref(savedOrientation(flipKey(props.id)))
const boardSide = computed(() => (falle.value ? (falle.value.fen.split(' ')[1] === 'b' ? 'black' : 'white') : engine.value ? lehrgangOrientation(chosen.value, side.value) : side.value))
function flipBoard() { if (!engine.value) return; chosen.value = flipSide(boardSide.value); rememberOrientation(flipKey(props.id), chosen.value) }
const ownArrows = computed<Arrow[]>(() => {
  if (!v.value) return []
  if (modus.value === 'vorfuehren') return pos.value > 0 ? arrow(v.value.zuege[pos.value - 1]!.uci, 'green') : []
  return showArrow.value
})
/** Engine field (system prototype only): hidden answer while the learner is to move; lifting the lock on purpose counts as a help (per position). */
const engine = computed(() => hasEngine(props.kind, props.itemId))
const ev = ref<EngineView>(EMPTY_VIEW)
const helpFor = ref('')
const helps = ref(0)
const taskKey = computed(() => `${props.itemId}/${modus.value}/${pos.value}`)
const engineLock = computed(() => engineLockFor(uebenEngineTask({ modus: modus.value, myTurn: myTurn.value, solved: solved.value }), helpFor.value === taskKey.value))
function unlockEngine() { if (helpFor.value !== taskKey.value) { helpFor.value = taskKey.value; helps.value++ } }
const arrows = computed<Arrow[]>(() => (engine.value ? [...ownArrows.value, ...ev.value.arrows] : ownArrows.value))
const highlight = computed(() => (modus.value === 'gefuehrt' && hintLevel.value === 1 && myTurn.value ? [v.value!.zuege[pos.value]!.uci.slice(0, 2)] : []))
const played = computed(() => (v.value?.zuege ?? []).slice(0, modus.value === 'vorfuehren' ? n.value : pos.value).map((z) => z.san))
const satz = (i: number) => { const s = v.value?.zuege[i]?.satz ?? ''; return isTodo(s) ? 'Text folgt.' : s }

/** Explanation box: vorführen explains the move just played (its marks refer to the board after it); practising shows the last message or the sentence of the move just played. */
const box = computed(() => {
  if (falle.value) return message.value || 'Du bist am Zug. Finde den Zug der Falle.'
  if (!v.value) return ''
  if (muster.value) return pos.value === 0 ? 'Die Partie beginnt. Mit ▶ oder → gehst du Zug für Zug; ich melde mich an den Wendepunkten.' : v.value.zuege[pos.value - 1]!.satz ? satz(pos.value - 1) : pos.value === n.value ? 'Ende der Partie.' : 'Hier gibt es nichts Besonderes. Weiter mit ▶ bis zum nächsten Wendepunkt.'
  if (modus.value === 'vorfuehren') return pos.value === 0 ? 'Die Variante beginnt. Mit ▶ oder → siehst du den ersten Zug.' : `${isOwnPly(side.value, pos.value - 1) ? 'Dein Zug' : 'Gegner'}: ${toGermanSan(v.value.zuege[pos.value - 1]!.san)}. ${satz(pos.value - 1)}${pos.value === n.value ? ' Ende der Variante. Weiter mit „2 Nachspielen“.' : ''}`
  if (solved.value) return mistakes.value ? `Geschafft, mit ${mistakes.value} Fehler${mistakes.value === 1 ? '' : 'n'}. Noch einmal, bis es ohne sitzt.` : 'Geschafft, ohne Fehler.'
  return message.value || (myTurn.value ? 'Du bist am Zug.' : '')
})

/** Engine moves beyond the data are named as such: they carry no frequency. */
const herkunftNote = computed(() => (modus.value === 'vorfuehren' && pos.value > 0 && v.value?.zuege[pos.value - 1]?.herkunft === 'engine' ? 'Dieser Gegnerzug ist der Bestzug der Engine (Stockfish); dafür gibt es keine Häufigkeitsdaten.' : ''))
const gefuehl = computed(() => lehrgangGefuehl(teacher.value.figur, { miss: !!miss.value && !!lastPlayed.value, solved: solved.value, mistakes: mistakes.value, lob: lob.value }))
const cardText = computed(() => miss.value?.meldung ?? box.value)
const cardNote = computed(() => (miss.value ? (miss.value.tipp ?? '') : herkunftNote.value))
const cardReveal = computed(() => (miss.value?.richtig ? `${miss.value.richtig}.${miss.value.satz && !isTodo(miss.value.satz) ? ' ' + miss.value.satz : ''}` : ''))

function clearMiss() { miss.value = null; attempts.value = 0; lastPlayed.value = null }

function resetRun(m: Modus) {
  clear(); modus.value = m; pos.value = 0; infoPly.value = -1; mistakes.value = 0; hintLevel.value = 0; message.value = ''; solved.value = false; showArrow.value = []; flash.value = null; lob.value = false; clearMiss()
  if (m !== 'vorfuehren') advance()
}
watch(() => [pos.value, modus.value, props.itemId], () => {
  const z = modus.value === 'vorfuehren' && pos.value > 0 ? v.value?.zuege[pos.value - 1] : undefined
  if (z && vorlesen.value && !muster.value && !isTodo(z.satz)) void speakSatz(z.satz)
  else stopQuip()
})
watch(() => [props.id, props.itemId, props.kind, lehrgaenge.value], () => { if (v.value) resetRun(props.modus ?? 'vorfuehren'); else { clear(); message.value = ''; solved.value = false; mistakes.value = 0; showArrow.value = []; clearMiss() } }, { immediate: true })

/** Opponent moves are played until the learner is to move or the line is over. */
function advance() {
  hintLevel.value = 0; showArrow.value = []
  const next = nextOwnPly(side.value, v.value!, pos.value)
  if (next === null || next >= n.value) { pos.value = n.value; finish(); return }
  if (pos.value < next) later(() => { pos.value++; advance() }, OPPONENT_PAUSE_MS)
}
function finish() {
  solved.value = true
  doneStep(props.id, props.itemId, modus.value)
}

function go(to: number) {
  pos.value = Math.max(0, Math.min(n.value, to))
  if (props.kind === 'v' && pos.value === n.value && n.value > 0) doneStep(props.id, props.itemId, 'vorfuehren')
}

/** The wrong move: red frames on its squares, error text on the left, the answer after the 2nd miss or on request; the wobble is only an extra. */
function bad(uci: string, expected: { san: string; uci: string; satz: string }, kind: 'gefuehrt' | 'kopf' | 'falle', reveal = false) {
  mistakes.value++
  attempts.value++
  lob.value = false
  lastPlayed.value = { san: applyUci(fen.value, uci)?.san ?? uci, uci }
  miss.value = missFeedback({ modus: kind, expected, played: lastPlayed.value, attempts: attempts.value, solutionShown: reveal })
  showArrow.value = miss.value.pfeil ? arrow(miss.value.pfeil, 'green') : []
  message.value = ''
  wobble.value = true
  later(() => { wobble.value = false }, 450)
}

/** "Lösung zeigen": answer and arrow at once; without a wrong try before, the text says so instead of naming a move. */
function reveal() {
  const exp = falle.value ? { san: falle.value.loesung, uci: falle.value.loesungUci, satz: falle.value.satz } : v.value && myTurn.value ? v.value.zuege[pos.value]! : null
  if (!exp || modus.value === 'gefuehrt' || solved.value) return
  const kind = falle.value ? 'falle' : 'kopf'
  const m = missFeedback({ modus: kind, expected: exp, played: lastPlayed.value ?? exp, attempts: attempts.value, solutionShown: true })
  miss.value = lastPlayed.value ? m : { ...m, meldung: 'Lösung angezeigt.', felder: [] }
  showArrow.value = [{ orig: exp.uci.slice(0, 2), dest: exp.uci.slice(2, 4), brush: 'green' }]
}

function onMove(uci: string) {
  if (falle.value) {
    if (solved.value) return
    if (uci === falle.value.loesungUci) {
      solved.value = true; flash.value = { square: uci.slice(2, 4), kind: 'ok' }; clearMiss(); showArrow.value = []
      message.value = `Richtig: ${toGermanSan(falle.value.loesung)}. ${isTodo(falle.value.satz) ? 'Text folgt.' : falle.value.satz}`
      doneFalle(props.id, props.itemId)
    } else bad(uci, { san: falle.value.loesung, uci: falle.value.loesungUci, satz: falle.value.satz }, 'falle')
    return
  }
  if (!myTurn.value || !v.value) return
  const r = checkMove(v.value, pos.value, uci)
  if (r.ok) {
    flash.value = { square: uci.slice(2, 4), kind: 'ok' }
    message.value = modus.value === 'gefuehrt' ? satz(pos.value) : 'Richtig.'
    lob.value = true
    infoPly.value = modus.value === 'gefuehrt' ? pos.value + 1 : -1
    clearMiss()
    pos.value++
    advance()
  } else bad(uci, v.value.zuege[pos.value]!, modus.value === 'kopf' ? 'kopf' : 'gefuehrt')
}

function hint() {
  if (modus.value !== 'gefuehrt' || !myTurn.value) return
  hintLevel.value = Math.min(2, hintLevel.value + 1)
  if (hintLevel.value === 2) showArrow.value = arrow(v.value!.zuege[pos.value]!.uci, 'green')
  message.value = hintLevel.value === 1 ? 'Hinweis: Diese Figur wird gezogen. Noch einmal H zeigt den Zug.' : 'Der Pfeil zeigt den Zug.'
}

function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement
  const mods = { alt: e.altKey, ctrl: e.ctrlKey, meta: e.metaKey, shift: e.shiftKey }
  if (engine.value && isFlipKey(e.key, t.tagName, t.isContentEditable, mods)) { flipBoard(); e.preventDefault(); return }
  if (v.value && modus.value === 'vorfuehren' && shouldHandleKey(e.key, keyTag(t as HTMLInputElement), t.isContentEditable, mods)) {
    const to = navTarget(e.key, pos.value, n.value)
    if (to !== null) { go(to); e.preventDefault() }
  } else if (isHintKey(e.key, keyTag(t as HTMLInputElement), t.isContentEditable, mods)) hint()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <p v-if="lehrgangFehler" class="err" role="alert">{{ lehrgangFehler }}</p>
  <p v-else-if="!lehrgaenge" class="muted">Lade Lehrgang …</p>
  <p v-else-if="!lg || (!v && !falle)" class="muted">Das gibt es nicht. <a :href="hrefKurse()">Zu den Kursen</a></p>
  <div v-else class="lgu" :style="{ '--acc': CATALOG.find((c) => c.id === lg!.id)?.acc ?? 'var(--muted)' }">
    <div class="pagebar"><p class="crumbs"><a href="#/">Start</a> › <a :href="hrefKurse()">Kurse</a> › <a :href="hrefLehrgang(lg.id)">{{ lg.name }}</a> › <template v-if="system"><a :href="hrefLehrgangSystem(lg.id, system.id)">System</a> › </template>{{ v ? (title ?? (muster ? 'Musterpartie' : 'Variante')) : 'Falle' }}</p></div>
    <BoardLayout>
      <template #left>
        <section class="box">
          <h2>{{ muster ? 'Musterpartie' : falle ? 'Falle' : MODI.find((m) => m.id === modus)!.label }}</h2>
          <p v-if="v?.haeufigkeit" class="muted small">Kommt {{ v.haeufigkeit }}.</p>
          <template v-if="muster">
            <p class="muted small">{{ musterAngaben }}</p>
            <p v-if="muster.platzhalter" class="muted small">Platzhalter-Partie: Auswahl und Kommentare werden noch ersetzt.</p>
          </template>
          <section v-if="ziel.length" class="ziel" aria-label="Ziel dieser Variante">
            <h3>Ziel dieser Variante</h3>
            <ul>
              <li v-for="(z, i) in ziel" :key="i" :class="{ muted: isTodo(z.satz) }">{{ isTodo(z.satz) ? 'Text folgt.' : z.satz }}<template v-for="q in zielLinks(z.quelle)" :key="q.url"> <a class="small" :href="q.url" target="_blank" rel="noopener noreferrer">({{ q.label }})</a></template></li>
            </ul>
          </section>
          <TeacherCard
            plain :figur="teacher.figur" :name="teacherName" :gefuehl="gefuehl" :text="cardText" :note="cardNote" :reveal="cardReveal" :blocked="false" :hinted="false"
            :quips="false" :speak="false" :audio="false" @figur="setTeacher({ figur: $event })"
          />
          <div class="audiorow"><SatzAudio v-if="v && !muster && modus === 'vorfuehren' && pos > 0 && !isTodo(v.zuege[pos - 1]!.satz)" :key="pos" :text="v.zuege[pos - 1]!.satz" /></div>
          <p v-if="quellen.length || musterQuelle.length" class="muted small quelle">Quelle: <template v-for="(q, i) in [...quellen, ...musterQuelle]" :key="q.url"><template v-if="i">, </template><a :href="q.url" target="_blank" rel="noopener noreferrer">{{ q.label }}</a></template></p>
          <p class="muted small cnt" :class="{ off: !practising && !falle }">Fehler: {{ mistakes }}<template v-if="helps"> · Hilfe: {{ helps }}</template></p>
        </section>
      </template>
      <template #board>
        <EvalBar v-if="engine" :view="ev" :orientation="boardSide" />
        <Board :fen="fen" :orientation="boardSide" :movable="falle ? !solved : myTurn" :arrows="arrows" :marks="marks" :highlight="highlight" :last-move="lastMove" :flash="flash" :err-squares="miss?.felder ?? []" :wobble="wobble" :layer-lock="!!falle && !solved ? 'all' : practising && !solved" @move="onMove" />
      </template>
      <template #controls>
        <template v-if="v && modus === 'vorfuehren'">
          <button :disabled="pos === 0" aria-label="Zum Anfang" @click="go(0)">⇤</button>
          <button :disabled="pos === 0" aria-label="Ein Zug zurück" title="←" @click="go(pos - 1)">◀</button>
          <button :disabled="pos >= n" aria-label="Ein Zug vor" title="→ oder Leertaste" @click="go(pos + 1)">▶</button>
          <button :disabled="pos >= n" aria-label="Zum Ende" @click="go(n)">⇥</button>
          <span class="pos">{{ pos }}/{{ n }}</span>
          <label v-if="!muster" class="vorlesen"><input type="checkbox" :checked="vorlesen" @change="setVorlesen(($event.target as HTMLInputElement).checked)" /> Vorlesen</label>
        </template>
        <template v-else-if="v">
          <button :disabled="modus !== 'gefuehrt' || !myTurn" title="H" @click="hint">Hinweis (H)</button>
          <button :disabled="modus !== 'kopf' || !myTurn" @click="reveal">Lösung zeigen</button>
          <button @click="resetRun(modus)">Von vorn</button>
        </template>
        <template v-else>
          <button :disabled="solved" @click="reveal">Lösung zeigen</button>
        </template>
        <button v-if="engine" aria-label="Brett drehen (F)" title="Brett drehen (F)" @click="flipBoard">⇅</button>
      </template>
      <template #right>
        <EnginePanel v-if="engine" :fen="fen" :orientation="boardSide" scope="lehrgang" :lock="engineLock" unlockable locked-text="Gesperrt, bis du gezogen hast." @unlock="unlockEngine" @view="ev = $event" />
        <ModeTabs v-if="v && !muster" :modes="MODI.map((m) => ({ id: m.id, label: m.label }))" :model-value="modus" @update:model-value="resetRun($event as Modus)" />
        <MoveList v-if="v" :sans="played" :current="modus === 'vorfuehren' ? pos : played.length" :selectable="modus === 'vorfuehren'" @select="go" />
        <p v-if="falle?.platzhalter || v?.vorlaeufig" class="muted small">Platzhalter-Inhalt: Auswahl und Texte werden noch ersetzt.</p>
      </template>
    </BoardLayout>
  </div>
</template>

<style scoped>
.lgu :deep(.modetabs) { grid-template-columns: 1fr; }
.lgu :deep(.modetabs a) { padding: 6px 10px; text-align: left; }
.box { min-height: 17rem; }
.cnt.off { visibility: hidden; }
.quelle { margin: .3rem 0 0; }
.ziel { margin: .5rem 0; padding: .5rem .7rem; border: 1px solid var(--line); border-left: 3px solid var(--acc); border-radius: 8px; background: var(--panel); }
.ziel h3 { margin: 0 0 .25rem; font-size: .95rem; }
.ziel ul { margin: 0; padding-left: 1.1rem; }
.ziel li { margin: .15rem 0; }
.audiorow { min-height: 2rem; }
</style>
