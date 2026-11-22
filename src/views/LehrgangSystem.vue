<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Arrow } from '../content/types.ts'
import { applyUci } from '../chess/game.ts'
import { formatLine, toGermanSan } from '../chess/notation.ts'
import { hrefKurse, hrefLehrgang, hrefLehrgangUeben } from '../router.ts'
import { missFeedback } from '../lehrgang/feedback.ts'
import type { Miss } from '../lehrgang/feedback.ts'
import { isOwnPly } from '../lehrgang/loop.ts'
import { lehrgaenge, lehrgangFehler, lehrgangState, ensureLehrgaenge } from '../lehrgang/state.ts'
import { lehrgangGefuehl } from '../lehrgang/mood.ts'
import { markenOf } from '../lehrgang/marks.ts'
import { astLabel, linieMitAst, pruefeRaetselZug } from '../lehrgang/system.ts'
import { isTodo } from '../lehrgang/types.ts'
import { progress, update } from '../store/state.ts'
import { FIGUREN, teacherOf } from '../teacher/avatar.ts'
import type { TeacherSettings } from '../teacher/avatar.ts'
import { CATALOG } from '../content/catalog.ts'
import { isFlipKey, isHintKey, keyTag, navTarget, shouldHandleKey } from '../ui/keys.ts'
import Board from '../ui/Board.vue'
import BoardLayout from '../ui/BoardLayout.vue'
import ModeTabs from '../ui/ModeTabs.vue'
import MoveList from '../ui/MoveList.vue'
import TeacherCard from '../ui/TeacherCard.vue'
import { flipKey, lehrgangOrientation } from '../lehrgang/board.ts'
import { flipSide, rememberOrientation, savedOrientation } from '../ui/orientation.ts'
import EvalBar from '../ui/EvalBar.vue'
import EnginePanel from '../ui/EnginePanel.vue'
import { EMPTY_VIEW } from '../coach/ceval.ts'
import type { EngineView } from '../coach/ceval.ts'
import { engineLockFor, systemEngineTask } from '../lehrgang/engine.ts'

const props = defineProps<{ id: string; systemId: string }>()
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const REPLY_PAUSE_MS = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500

onMounted(() => void ensureLehrgaenge())
const lg = computed(() => lehrgaenge.value?.find((l) => l.id === props.id))
const sys = computed(() => lg.value?.systeme?.find((s) => s.id === props.systemId))
const side = computed(() => lg.value?.side ?? 'white')
const titel = computed(() => (sys.value && !isTodo(sys.value.titel) ? sys.value.titel : 'System'))
const text = (s: string, leer = 'Text folgt.') => (isTodo(s) ? leer : s)

/** The teacher is the one chosen in the game; here he only explains. */
const teacher = computed(() => teacherOf(progress.value.settings))
const teacherName = computed(() => FIGUREN.find((f) => f.id === teacher.value.figur)!.name)
const setTeacher = (patch: Partial<TeacherSettings>) => update((p) => ({ ...p, settings: { ...p.settings, teacher: { ...p.settings.teacher, ...patch } } }))

type Schritt = 'idee' | 'hauptlinie' | 'motive' | 'muster' | 'ueben'
const SCHRITTE: { id: Schritt; label: string }[] = [
  { id: 'idee', label: 'Idee' }, { id: 'hauptlinie', label: 'Hauptlinie' }, { id: 'motive', label: 'Motive' }, { id: 'muster', label: 'Musterpartien' }, { id: 'ueben', label: 'Üben' },
]
const schritt = ref<Schritt>('idee')
const ideeNr = ref(0)
const pos = ref(0)
const astId = ref<string | null>(null)
const motivNr = ref(0)
/** -1 = the explanation of the motif, otherwise the number of the puzzle. */
const raetselNr = ref(-1)

const timers: ReturnType<typeof setTimeout>[] = []
const later = (fn: () => void, ms: number) => { timers.push(setTimeout(fn, ms)) }
const clear = () => { while (timers.length) clearTimeout(timers.pop()) }
onBeforeUnmount(clear)

// puzzle state
const rFen = ref('')
const rIdx = ref(0)
const solved = ref(false)
const mistakes = ref(0)
const attempts = ref(0)
const miss = ref<Miss | null>(null)
const lastPlayed = ref<{ san: string; uci: string } | null>(null)
const message = ref('')
const showArrow = ref<Arrow[]>([])
const flash = ref<{ square: string; kind: 'ok' | 'err' } | null>(null)
const wobble = ref(false)
const lob = ref(false)

const idee = computed(() => sys.value?.idee[ideeNr.value])
const linie = computed(() => linieMitAst(sys.value ?? { hauptlinie: { zuege: [], aeste: [] } }, astId.value))
const fens = computed(() => { const out = [START]; for (const z of linie.value.zuege) { const r = applyUci(out[out.length - 1]!, z.uci); if (!r) break; out.push(r.fen) } return out })
const motiv = computed(() => sys.value?.motive[motivNr.value])
const raetsel = computed(() => (raetselNr.value >= 0 ? motiv.value?.raetsel[raetselNr.value] : undefined))
const ast = computed(() => sys.value?.hauptlinie.aeste.find((a) => a.id === astId.value))
const planTitel = (id: string | undefined) => sys.value?.idee.find((a) => a.id === id)?.titel

function resetRaetsel() {
  clear(); solved.value = false; mistakes.value = 0; attempts.value = 0; miss.value = null; lastPlayed.value = null; message.value = ''; showArrow.value = []; flash.value = null; lob.value = false; rIdx.value = 0
  rFen.value = raetsel.value?.fen ?? ''
}
watch(() => [raetsel.value?.fen, props.systemId, lehrgaenge.value], resetRaetsel, { immediate: true })
watch(schritt, () => { clear(); if (schritt.value !== 'motive') { raetselNr.value = -1 } })

const fen = computed(() => {
  if (!sys.value) return START
  if (schritt.value === 'idee') return idee.value?.fen ?? START
  if (schritt.value === 'hauptlinie') return fens.value[Math.min(pos.value, fens.value.length - 1)]!
  if (schritt.value === 'motive') return raetsel.value ? rFen.value : (motiv.value?.fen ?? START)
  return systemFen.value
})
/** The system position (the system line is the start of the main line). */
const systemFen = computed(() => {
  let f = START
  for (const z of (sys.value?.hauptlinie.zuege ?? []).slice(0, sys.value?.zuege.length ?? 0)) f = applyUci(f, z.uci)?.fen ?? f
  return f
})
/** Start = side of the Lehrgang; afterwards only the user turns the board (button, key F), kept across all tabs and puzzles. */
const chosen = ref(savedOrientation(flipKey(props.id)))
const orientation = computed(() => lehrgangOrientation(chosen.value, side.value))
function flipBoard() { chosen.value = flipSide(orientation.value); rememberOrientation(flipKey(props.id), chosen.value) }
const marks = computed(() => {
  if (schritt.value === 'idee') return markenOf(idee.value)
  if (schritt.value === 'hauptlinie') return pos.value > 0 ? markenOf(linie.value.zuege[pos.value - 1]) : []
  if (schritt.value === 'motive' && !raetsel.value) return markenOf(motiv.value)
  return []
})
const lastMove = computed<[string, string] | undefined>(() => {
  if (schritt.value !== 'hauptlinie') return undefined
  const z = linie.value.zuege[pos.value - 1]
  return z ? [z.uci.slice(0, 2), z.uci.slice(2, 4)] : undefined
})
const arrows = computed<Arrow[]>(() => [...ownArrows.value, ...ev.value.arrows])
const ownArrows = computed<Arrow[]>(() => (schritt.value === 'hauptlinie' && pos.value > 0 ? [{ orig: linie.value.zuege[pos.value - 1]!.uci.slice(0, 2), dest: linie.value.zuege[pos.value - 1]!.uci.slice(2, 4), brush: 'green' }] : schritt.value === 'motive' ? showArrow.value : []))
const solving = computed(() => schritt.value === 'motive' && !!raetsel.value && !solved.value)
/** Engine field: locked while a puzzle is open; lifting the lock on purpose counts as a help (per puzzle). */
const ev = ref<EngineView>(EMPTY_VIEW)
const helpFor = ref('')
const helps = ref(0)
const taskKey = computed(() => `${props.systemId}/${motivNr.value}/${raetselNr.value}`)
const engineLock = computed(() => engineLockFor(systemEngineTask(schritt.value, solving.value), helpFor.value === taskKey.value))
function unlockEngine() { if (helpFor.value !== taskKey.value) { helpFor.value = taskKey.value; helps.value++ } }
const played = computed(() => linie.value.zuege.slice(0, pos.value).map((z) => z.san))

const kopf = computed(() => {
  const s = schritt.value
  if (s === 'idee') return `${idee.value?.titel ?? ''} (${ideeNr.value + 1} von ${sys.value?.idee.length ?? 0})`
  if (s === 'hauptlinie') return ast.value ? `Hauptlinie, Abzweig ${astLabel(ast.value)}` : 'Hauptlinie'
  if (s === 'motive') return raetsel.value ? `${motiv.value?.titel && !isTodo(motiv.value.titel) ? motiv.value.titel : `Motiv ${motivNr.value + 1}`}: Rätsel ${raetselNr.value + 1} von ${motiv.value?.raetsel.length ?? 0}` : `Motiv ${motivNr.value + 1} von ${sys.value?.motive.length ?? 0}${motiv.value && !isTodo(motiv.value.titel) ? `: ${motiv.value.titel}` : ''}`
  return SCHRITTE.find((x) => x.id === s)!.label
})

const gesagt = computed(() => {
  const s = sys.value
  if (!s) return ''
  switch (schritt.value) {
    case 'idee': return text(idee.value?.satz ?? '')
    case 'hauptlinie': {
      if (pos.value === 0) return 'Die Hauptlinie beginnt. Mit ▶ oder → siehst du den ersten Zug; rechts stehen die Abzweige, wenn der Gegner abweicht.'
      const z = linie.value.zuege[pos.value - 1]!
      return `${isOwnPly(side.value, pos.value - 1) ? 'Dein Zug' : 'Gegner'}: ${toGermanSan(z.san)}. ${text(z.satz)}`
    }
    case 'motive':
      if (!raetsel.value) return text(motiv.value?.satz ?? '')
      if (solved.value) return `Richtig. ${text(raetsel.value.satz)}`
      return message.value || 'Du bist am Zug. Finde den Zug.'
    case 'muster': return 'Echte Partien in diesem System, Zug für Zug. Ich melde mich an den Wendepunkten.'
    default: return 'Jetzt du: Die Hauptlinie nachspielen, erst mit Hinweis, dann aus dem Kopf.'
  }
})
const note = computed(() => {
  if (miss.value) return miss.value.tipp ?? ''
  if (schritt.value !== 'hauptlinie' || pos.value === 0) return ''
  const z = linie.value.zuege[pos.value - 1]!
  const teile: string[] = []
  if (z.plan) teile.push(`Gehört zu: ${planTitel(z.plan)}.`)
  if (z.herkunft === 'engine') teile.push(isOwnPly(side.value, pos.value - 1) ? 'Dieser Zug ist der Bestzug der Engine (Stockfish); im Repertoire ist er nicht festgelegt.' : 'Dieser Gegnerzug ist der Bestzug der Engine (Stockfish); dafür gibt es keine Häufigkeitsdaten.')
  if (ast.value && pos.value === ast.value.ab + 1) teile.push(text(ast.value.satz, ''))
  return teile.join(' ')
})
const reveal = computed(() => (miss.value?.richtig ? `${miss.value.richtig}.${miss.value.satz ? ' ' + miss.value.satz : ''}` : ''))
const gefuehl = computed(() => lehrgangGefuehl(teacher.value.figur, { miss: !!miss.value && !!lastPlayed.value, solved: solved.value, mistakes: mistakes.value, lob: lob.value }))
const cardText = computed(() => miss.value?.meldung ?? gesagt.value)

function waehleSchritt(s: string) { schritt.value = s as Schritt }
function goIdee(to: number) { ideeNr.value = Math.max(0, Math.min((sys.value?.idee.length ?? 1) - 1, to)) }
function go(to: number) { pos.value = Math.max(0, Math.min(linie.value.zuege.length, to)) }
function waehleAst(id: string | null) { astId.value = id; const a = sys.value?.hauptlinie.aeste.find((x) => x.id === id); pos.value = a ? a.ab + 1 : Math.min(pos.value, sys.value?.hauptlinie.zuege.length ?? 0) }
function waehleMotiv(m: number, r: number) { motivNr.value = m; raetselNr.value = r }

function bad(uci: string, erwartet: string) {
  mistakes.value++; attempts.value++; lob.value = false
  lastPlayed.value = { san: applyUci(rFen.value, uci)?.san ?? uci, uci }
  const r = raetsel.value!
  miss.value = missFeedback({ modus: 'falle', expected: { san: r.loesung[rIdx.value]!, uci: erwartet, satz: r.satz }, played: lastPlayed.value, attempts: attempts.value, solutionShown: false })
  showArrow.value = miss.value.pfeil ? [{ orig: miss.value.pfeil.slice(0, 2), dest: miss.value.pfeil.slice(2, 4), brush: 'green' }] : []
  message.value = ''
  wobble.value = true
  later(() => { wobble.value = false }, 450)
}
function onMove(uci: string) {
  const r = raetsel.value
  if (!r || solved.value) return
  const res = pruefeRaetselZug(r.loesungUci, rIdx.value, uci)
  if (!res.ok) return bad(uci, res.erwartet)
  const after = applyUci(rFen.value, uci)
  if (!after) return
  rFen.value = after.fen; miss.value = null; showArrow.value = []; lob.value = true
  flash.value = { square: uci.slice(2, 4), kind: 'ok' }
  rIdx.value = res.naechst
  if (res.antwort) later(() => { const a = applyUci(rFen.value, res.antwort!); if (a) rFen.value = a.fen; if (res.fertig) solved.value = true }, REPLY_PAUSE_MS)
  else solved.value = true
}
function zeigeHinweis() { message.value = text(raetsel.value?.hinweis ?? '', 'Hinweis folgt.') }
function zeigeLoesung() {
  const r = raetsel.value
  if (!r || solved.value) return
  const e = r.loesungUci[rIdx.value]!
  miss.value = lastPlayed.value ? missFeedback({ modus: 'falle', expected: { san: r.loesung[rIdx.value]!, uci: e, satz: r.satz }, played: lastPlayed.value, attempts: attempts.value, solutionShown: true }) : null
  message.value = lastPlayed.value ? '' : `Lösung: ${toGermanSan(r.loesung[rIdx.value]!)}`
  showArrow.value = [{ orig: e.slice(0, 2), dest: e.slice(2, 4), brush: 'green' }]
}

function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement
  const mods = { alt: e.altKey, ctrl: e.ctrlKey, meta: e.metaKey, shift: e.shiftKey }
  if (!shouldHandleKey(e.key, keyTag(t as HTMLInputElement), t.isContentEditable, mods)) return
  if (isFlipKey(e.key, t.tagName, t.isContentEditable, mods)) { flipBoard(); e.preventDefault(); return }
  if (schritt.value === 'idee') { const to = navTarget(e.key, ideeNr.value, (sys.value?.idee.length ?? 1) - 1); if (to !== null) { goIdee(to); e.preventDefault() } }
  else if (schritt.value === 'hauptlinie') { const to = navTarget(e.key, pos.value, linie.value.zuege.length); if (to !== null) { go(to); e.preventDefault() } }
  else if (isHintKey(e.key, keyTag(t as HTMLInputElement), t.isContentEditable, mods) && solving.value) zeigeHinweis()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const uebenStand = computed(() => lehrgangState.value.varianten[`${props.id}/${props.systemId}`] ?? {})
const musterTitel = (t: string) => (isTodo(t) ? 'Musterpartie (Titel folgt)' : t)
</script>

<template>
  <p v-if="lehrgangFehler" class="err" role="alert">{{ lehrgangFehler }}</p>
  <p v-else-if="!lehrgaenge" class="muted">Lade Lehrgang …</p>
  <p v-else-if="!lg || !sys" class="muted">Das gibt es nicht. <a :href="hrefKurse()">Zu den Kursen</a></p>
  <div v-else class="lgu" :style="{ '--acc': CATALOG.find((c) => c.id === lg!.id)?.acc ?? 'var(--muted)' }">
    <div class="pagebar"><p class="crumbs"><a href="#/">Start</a> › <a :href="hrefKurse()">Kurse</a> › <a :href="hrefLehrgang(lg.id)">{{ lg.name }}</a> › System: {{ titel }}</p></div>
    <BoardLayout>
      <template #left>
        <section class="box">
          <h2>{{ kopf }}</h2>
          <p class="muted small">System <span class="vline">{{ formatLine(sys.zuege) }}</span></p>
          <TeacherCard
            plain :figur="teacher.figur" :name="teacherName" :gefuehl="gefuehl" :text="cardText" :note="note" :reveal="reveal" :blocked="false" :hinted="false"
            :quips="false" :speak="false" :audio="false" @figur="setTeacher({ figur: $event })"
          />
          <p class="muted small cnt" :class="{ off: !solving && !solved }">Fehler: {{ mistakes }}<template v-if="helps"> · Hilfe: {{ helps }}</template></p>
        </section>
      </template>
      <template #board>
        <EvalBar :view="ev" :orientation="orientation" />
        <Board :fen="fen" :orientation="orientation" :movable="solving" :arrows="arrows" :marks="marks" :last-move="lastMove" :flash="flash" :err-squares="miss?.felder ?? []" :wobble="wobble" :layer-lock="solving ? 'all' : false" @move="onMove" />
      </template>
      <template #controls>
        <template v-if="schritt === 'idee'">
          <button :disabled="ideeNr === 0" aria-label="Zurück" @click="goIdee(ideeNr - 1)">◀</button>
          <button :disabled="ideeNr >= sys.idee.length - 1" aria-label="Weiter" @click="goIdee(ideeNr + 1)">▶</button>
          <span class="pos">{{ ideeNr + 1 }}/{{ sys.idee.length }}</span>
        </template>
        <template v-else-if="schritt === 'hauptlinie'">
          <button :disabled="pos === 0" aria-label="Zum Anfang" @click="go(0)">⇤</button>
          <button :disabled="pos === 0" aria-label="Ein Zug zurück" title="←" @click="go(pos - 1)">◀</button>
          <button :disabled="pos >= linie.zuege.length" aria-label="Ein Zug vor" title="→ oder Leertaste" @click="go(pos + 1)">▶</button>
          <button :disabled="pos >= linie.zuege.length" aria-label="Zum Ende" @click="go(linie.zuege.length)">⇥</button>
          <span class="pos">{{ pos }}/{{ linie.zuege.length }}</span>
        </template>
        <template v-else-if="schritt === 'motive'">
          <template v-if="raetsel">
            <button :disabled="solved" title="H" @click="zeigeHinweis">Hinweis (H)</button>
            <button :disabled="solved" @click="zeigeLoesung">Lösung zeigen</button>
            <button @click="resetRaetsel">Von vorn</button>
          </template>
          <button v-else-if="motiv" :disabled="!motiv.raetsel.length" @click="waehleMotiv(motivNr, 0)">Zum Rätsel</button>
        </template>
        <button aria-label="Brett drehen (F)" title="Brett drehen (F)" @click="flipBoard">⇅</button>
      </template>
      <template #right>
        <EnginePanel :fen="fen" :orientation="orientation" scope="lehrgang" :lock="engineLock" unlockable locked-text="Beim Rätsel gesperrt, bis du es gelöst hast." @unlock="unlockEngine" @view="ev = $event" />
        <ModeTabs :modes="SCHRITTE" :model-value="schritt" @update:model-value="waehleSchritt" />
        <section class="pane steps" :aria-label="kopf">
          <template v-if="schritt === 'idee'">
            <ol class="list">
              <li v-for="(a, i) in sys.idee" :key="a.id"><button type="button" :class="{ cur: i === ideeNr }" @click="goIdee(i)">{{ a.titel }}</button></li>
            </ol>
          </template>
          <template v-else-if="schritt === 'hauptlinie'">
            <MoveList :sans="played" :current="pos" @select="go" />
            <div class="aeste">
              <p class="h">Abzweige</p>
              <ul class="list">
                <li><button type="button" :class="{ cur: astId === null }" @click="waehleAst(null)">Hauptlinie</button></li>
                <li v-for="a in sys.hauptlinie.aeste" :key="a.id"><button type="button" :class="{ cur: astId === a.id }" @click="waehleAst(a.id)">{{ astLabel(a) }}</button></li>
              </ul>
            </div>
          </template>
          <template v-else-if="schritt === 'motive'">
            <ul class="list">
              <li v-for="(m, i) in sys.motive" :key="m.id" class="col">
                <button type="button" :class="{ cur: i === motivNr && raetselNr === -1 }" @click="waehleMotiv(i, -1)">{{ isTodo(m.titel) ? `Motiv ${i + 1}` : m.titel }}</button>
                <ul class="sub"><li v-for="(r, k) in m.raetsel" :key="r.id"><button type="button" :class="{ cur: i === motivNr && raetselNr === k }" @click="waehleMotiv(i, k)">Rätsel {{ k + 1 }}<span v-if="r.platzhalter" class="pill">Platzhalter</span></button></li></ul>
              </li>
            </ul>
          </template>
          <template v-else-if="schritt === 'muster'">
            <ul class="list">
              <li v-for="m in sys.musterpartien" :key="m.id"><a :href="hrefLehrgangUeben(lg.id, 'm', `${sys.id}/${m.id}`)">{{ musterTitel(m.titel) }}</a><span v-if="m.platzhalter" class="pill">Platzhalter</span></li>
            </ul>
          </template>
          <template v-else>
            <ul class="list">
              <li><a :href="hrefLehrgangUeben(lg.id, 's', sys.id, 'gefuehrt')">2 Nachspielen</a><span class="dot">{{ uebenStand.gefuehrt ? '●' : '○' }}</span></li>
              <li><a :href="hrefLehrgangUeben(lg.id, 's', sys.id, 'kopf')">3 Aus dem Kopf</a><span class="dot">{{ uebenStand.kopf ? '●' : '○' }}</span></li>
            </ul>
          </template>
        </section>
      </template>
    </BoardLayout>
  </div>
</template>

<style scoped>
.lgu :deep(.modetabs) { grid-template-columns: 1fr; }
.lgu :deep(.modetabs a) { padding: 6px 10px; text-align: left; }
.box { min-height: 17rem; }
.cnt.off { visibility: hidden; }
.steps { padding: 10px 12px; min-height: 8rem; }
.list { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.list li { display: flex; align-items: center; gap: .5rem; justify-content: space-between; }
.list button { background: none; border: 0; color: var(--text); font: inherit; text-align: left; padding: 3px 8px; border-radius: 4px; cursor: pointer; flex: 1; }
.list button:hover { background: var(--panel-2); }
.list button.cur { background: var(--acc); color: var(--ink); font-weight: 700; }
.list li.col { display: block; }
.sub { list-style: none; margin: 0 0 .4rem 1rem; padding: 0; display: grid; gap: 2px; }
.sub button { display: flex; align-items: center; gap: .5rem; }
.aeste { margin-top: .6rem; }
.aeste .h { margin: 0 0 .2rem; font-size: var(--fs-label); font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.dot { color: var(--acc); }
</style>
