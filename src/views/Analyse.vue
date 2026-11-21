<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Chess } from 'chess.js'
import type { Side } from '../content/types.ts'
import { analysisFen, currentFen, goBack, goForward, goTo, moveLine, newAnalysis, playMove } from '../train/analysisBoard.ts'
import { hrefHome, hrefSpielen } from '../router.ts'
import { navTarget, shouldHandleKey } from '../ui/keys.ts'
import Board from '../ui/Board.vue'
import EvalBar from '../ui/EvalBar.vue'
import EnginePanel from '../ui/EnginePanel.vue'
import MoveList from '../ui/MoveList.vue'
import BoardLayout from '../ui/BoardLayout.vue'
import { EMPTY_VIEW } from '../coach/ceval.ts'
import type { EngineView } from '../coach/ceval.ts'
import { progress, update } from '../store/state.ts'
import { FIGUREN, teacherOf } from '../teacher/avatar.ts'
import type { TeacherSettings } from '../teacher/avatar.ts'
import TeacherCard from '../ui/TeacherCard.vue'
import TeacherPick from '../ui/TeacherPick.vue'
import { useTeacherSpeech, talk, setTalk } from '../teacher/speech.ts'
import { boardMoveCategories, bestMoveText, judgedCard } from '../teacher/commentary.ts'
import { evaluateMove } from '../teacher/analyse.ts'
import { judgeMove } from '../teacher/judge.ts'
import type { Judgement } from '../teacher/judge.ts'
import { moveFacts } from '../teacher/quip-events.ts'
import { CancelledError, EngineError } from '../engine/service.ts'
import { getEngine, resetEngine } from '../engine/instance.ts'
import { engineErrorText } from '../content/fetch-bundle.ts'
import { pieceName } from '../coach/texts.ts'
import type { Arrow } from '../content/types.ts'

const props = defineProps<{ fen?: string }>()
const INITIAL = new Chess().fen()

const normalised = computed(() => (props.fen ? analysisFen(props.fen) : INITIAL))
const validFen = computed(() => normalised.value !== null)
const board = ref(newAnalysis(INITIAL))
const orientation = ref<Side>('white')
const ev = ref<EngineView>(EMPTY_VIEW)
watch(normalised, (f) => {
  board.value = newAnalysis(f ?? INITIAL)
  orientation.value = board.value.startFen.split(' ')[1] === 'b' ? 'black' : 'white'
}, { immediate: true })

const fen = computed(() => currentFen(board.value))
const line = computed(() => moveLine(board.value))
const lastMove = computed<[string, string] | undefined>(() => {
  const u = board.value.ucis[board.value.view - 1]
  return u ? [u.slice(0, 2), u.slice(2, 4)] : undefined
})
const boardArrows = computed<Arrow[]>(() => [...ev.value.arrows, ...(helpShown.value ? helpArrow.value : [])])

// Teacher at the board (switch, off by default): judges every freely played move like the sparring game, help on request
const TEACHER_DEPTH = 14
const teacher = computed(() => teacherOf(progress.value.settings))
const teacherName = computed(() => FIGUREN.find((f) => f.id === teacher.value.figur)!.name)
const setTeacher = (patch: Partial<TeacherSettings>) => update((p) => ({ ...p, settings: { ...p.settings, teacher: { ...p.settings.teacher, ...patch } } }))
const speech = useTeacherSpeech({ teacher, enabled: () => talk.value.board, seedKey: () => board.value.ucis.length })
const judging = ref(false)
const verdict = ref<Judgement | null>(null)
const revealed = ref(false)
const message = ref('')
let token = 0
const help = ref<{ fen: string; uci: string; text: string; hinted: boolean } | null>(null)
const helpShown = ref(false)
const helpArrow = computed<Arrow[]>(() => (help.value ? [{ orig: help.value.uci.slice(0, 2), dest: help.value.uci.slice(2, 4), brush: 'green' }] : []))
const hintSquare = computed(() => (help.value?.hinted && !helpShown.value ? [help.value.uci.slice(0, 2)] : []))
watch(fen, () => { help.value = null; helpShown.value = false })
const cardView = computed(() => {
  const c = judgedCard(verdict.value)
  return { ...c, text: helpShown.value && help.value ? help.value.text : c.text || message.value, gefuehl: speech.mood.value }
})

async function onBoardMove(uci: string) {
  const fenBefore = fen.value
  board.value = playMove(board.value, uci)
  speech.clearQuip(); verdict.value = null; revealed.value = false; message.value = ''
  if (!talk.value.board) return
  const mine = ++token
  judging.value = true
  try {
    const j = judgeMove(fenBefore, uci, await evaluateMove(getEngine(), fenBefore, uci, TEACHER_DEPTH))
    if (mine !== token) return
    verdict.value = j
    speech.say(boardMoveCategories(fenBefore, uci, j.rating), moveFacts(fenBefore, uci), `${fenBefore}|${uci}`)
  } catch (e) {
    if (e instanceof CancelledError || mine !== token) return
    if (e instanceof EngineError) resetEngine()
    message.value = `Der Lehrer konnte den Zug nicht prüfen. ${engineErrorText(e)}`
  } finally {
    if (mine === token) judging.value = false
  }
}

/** Asks the engine for the best move of the shown position (once per position) and shows the hint (piece) or the move. */
async function askHelp(kind: 'hint' | 'best') {
  const at = fen.value
  let h = help.value?.fen === at ? help.value : null
  if (!h) {
    const mine = ++token
    judging.value = true; message.value = ''
    try {
      const line = (await getEngine().analyse(at, { depth: TEACHER_DEPTH })).lines[0]
      if (mine !== token || fen.value !== at || !line) return
      h = { fen: at, uci: line.uci, text: bestMoveText(at, line), hinted: false }
    } catch (e) {
      if (e instanceof CancelledError || mine !== token) return
      if (e instanceof EngineError) resetEngine()
      message.value = `Der Lehrer konnte keinen Zug berechnen. ${engineErrorText(e)}`
      return
    } finally {
      if (mine === token) judging.value = false
    }
  }
  help.value = { ...h, hinted: true }
  if (kind === 'best') helpShown.value = true
  else message.value = `Hinweis: Schau dir ${pieceName(new Chess(at).get(h.uci.slice(0, 2) as never)?.type ?? 'p')} auf ${h.uci.slice(0, 2)} an.`
}
const revealText = computed(() => (revealed.value && verdict.value ? verdict.value.reveal : ''))
const canLater = computed(() => !!verdict.value && !revealed.value && ['ungenau', 'fehler', 'patzer'].includes(verdict.value.rating))


function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  const mods = { alt: e.altKey, ctrl: e.ctrlKey, meta: e.metaKey, shift: e.shiftKey }
  if (e.key === ' ' || !shouldHandleKey(e.key, t?.tagName ?? '', !!t?.isContentEditable, mods)) return
  const to = navTarget(e.key, board.value.view, board.value.ucis.length)
  if (to === null) return
  board.value = goTo(board.value, to)
  e.preventDefault()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="pagebar"><p class="crumbs"><a :href="hrefHome()">Start</a> › Analysebrett</p></div>
  <BoardLayout>
    <template #left>
      <div class="pane">
        <h2>Analysebrett</h2>
        <p v-if="!validFen" class="err" role="alert">Die Stellung in der Adresse ist ungültig oder unmöglich. Das Brett zeigt die Grundstellung.</p>
        <p class="muted">Zieh für beide Seiten. Stockfish rechnet mit.</p>
        <TeacherPick
          :on="talk.board" :figur="teacher.figur" :quips="teacher.quips" :speak="teacher.speak" :audio="speech.audioAvailable.value" :labels="{ on: 'Lehrer an', off: 'Lehrer aus' }"
          @on="setTalk({ board: $event })" @figur="setTeacher({ figur: $event })" @quips="setTeacher({ quips: $event })" @speak="setTeacher({ speak: $event })"
        />
        <template v-if="talk.board">
          <TeacherCard
            :figur="teacher.figur" :name="teacherName" :gefuehl="cardView.gefuehl" :headline="cardView.headline" :severity="cardView.severity" :text="cardView.text"
            :reveal="revealText" :later="canLater" :blocked="false" :hinted="false" :quip="speech.quip.value" :quips="teacher.quips" :speak="teacher.speak" :audio="speech.audioAvailable.value"
            @later="revealed = true" @quips="setTeacher({ quips: $event })" @speak="setTeacher({ speak: $event })"
          />
          <p class="helpbtns">
            <button :disabled="judging" title="Markiert die Figur des besten Zuges" @click="askHelp('hint')">Hinweis</button>
            <button :disabled="judging" @click="askHelp('best')">Bester Zug</button>
          </p>
        </template>
      </div>
    </template>
    <template #board>
      <EvalBar :view="ev" :orientation="orientation" />
      <Board :fen="fen" :orientation="orientation" :movable="true" :arrows="boardArrows" :highlight="hintSquare" :last-move="lastMove" @move="onBoardMove" />
    </template>
    <template #controls>
      <button :disabled="board.view === 0" aria-label="Zum Anfang" title="Anfang (Pos1)" @click="board = goTo(board, 0)">⇤</button>
      <button :disabled="board.view === 0" aria-label="Ein Zug zurück" @click="board = goBack(board)">◀</button>
      <button :disabled="board.view === board.ucis.length" aria-label="Ein Zug vor" @click="board = goForward(board)">▶</button>
      <button :disabled="board.view === board.ucis.length" aria-label="Zum Ende" title="Ende" @click="board = goTo(board, board.ucis.length)">⇥</button>
      <a class="pbtn" :href="hrefSpielen(fen)">Partie ab hier</a>
      <button @click="orientation = orientation === 'white' ? 'black' : 'white'">Brett drehen</button>
      <button :disabled="!board.ucis.length" @click="board = goTo(board, 0)">Zur Ausgangsstellung</button>
    </template>
    <template #right>
      <EnginePanel :fen="fen" :orientation="orientation" :analyse-link="false" :lock="judging ? 'busy' : null" @view="ev = $event" />
      <MoveList :sans="line.sans" :start-ply="line.startPly" :current="board.view" @select="board = goTo(board, $event)" />
    </template>
  </BoardLayout>
</template>

<style scoped>
.helpbtns { display: flex; gap: 6px; margin: 0.3rem 0; }
</style>
