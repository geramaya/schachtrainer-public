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
const boardArrows = computed(() => ev.value.arrows)

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
      </div>
    </template>
    <template #board>
      <EvalBar :view="ev" :orientation="orientation" />
      <Board :fen="fen" :orientation="orientation" :movable="true" :arrows="boardArrows" :last-move="lastMove" @move="board = playMove(board, $event)" />
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
      <EnginePanel :fen="fen" :orientation="orientation" :analyse-link="false" @view="ev = $event" />
      <MoveList :sans="line.sans" :start-ply="line.startPly" :current="board.view" @select="board = goTo(board, $event)" />
    </template>
  </BoardLayout>
</template>
