<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Arrow } from '../content/types.ts'
import { applyUci } from '../chess/game.ts'
import { toGermanSan } from '../chess/notation.ts'
import { partieQueue } from '../train/partien.ts'
import { schedule } from '../train/srs.ts'
import { progress, update } from '../store/state.ts'
import { hrefHome } from '../router.ts'
import Board from '../ui/Board.vue'
import EvalBar from '../ui/EvalBar.vue'
import EnginePanel from '../ui/EnginePanel.vue'
import BoardLayout from '../ui/BoardLayout.vue'
import { EMPTY_VIEW } from '../coach/ceval.ts'
import type { EngineView } from '../coach/ceval.ts'
import { cardId } from '../train/srs.ts'

// The queue is fixed when the page opens, so grading a card does not reshuffle the list under the user.
const queue = ref(partieQueue(Object.values(progress.value.cards), Date.now()).map(cardId))
const index = ref(0)
const missed = ref(false)
const solved = ref(false)
const message = ref('')
const hint = ref<Arrow[]>([])

const ev = ref<EngineView>(EMPTY_VIEW)
const boardArrows = computed(() => [...hint.value, ...ev.value.arrows])
const card = computed(() => progress.value.cards[queue.value[index.value] ?? ''])
const fen = computed(() => (card.value ? `${card.value.key} 0 1` : ''))
const side = computed(() => (fen.value.split(' ')[1] === 'b' ? 'black' : 'white'))
const shownFen = computed(() => (solved.value && card.value ? (applyUci(fen.value, card.value.expectedUci)?.fen ?? fen.value) : fen.value))

function grade(g: 'gut' | 'nochmal') {
  const c = card.value
  if (c) update((p) => ({ ...p, cards: { ...p.cards, [cardId(c)]: schedule(c, g, Date.now()) } }))
}

function onMove(uci: string) {
  const c = card.value
  if (!c || solved.value) return
  if (uci === c.expectedUci) {
    if (!missed.value) grade('gut')
    solved.value = true; hint.value = []; message.value = 'Richtig.'
  } else {
    if (!missed.value) grade('nochmal')
    missed.value = true
    hint.value = [{ orig: c.expectedUci.slice(0, 2), dest: c.expectedUci.slice(2, 4), brush: 'green' }]
    const san = applyUci(fen.value, c.expectedUci)?.san
    message.value = `Nicht ganz. Der bessere Zug war ${san ? toGermanSan(san) : c.expectedUci} (Pfeil). Spiel ihn jetzt.`
  }
}

function next() { index.value++; missed.value = false; solved.value = false; message.value = ''; hint.value = [] }
</script>

<template>
  <div class="pagebar"><p class="crumbs"><a :href="hrefHome()">Start</a> › Aus deinen Partien</p></div>
  <div v-if="queue.length === 0 || !card" class="pad">
    <h1>Aus deinen Partien</h1>
    <p v-if="queue.length === 0" class="muted">Gerade ist nichts fällig. Spiel eine Sparring-Partie und lege die Fehler ins Training.</p>
    <p v-else class="muted">Alle {{ queue.length }} Stellungen geübt. <a class="linkbtn" :href="hrefHome()">Zur Startseite</a></p>
  </div>
  <BoardLayout v-else>
    <template #left>
      <div class="pane">
        <h2>Finde den besten Zug</h2>
        <p class="muted">Stellung {{ index + 1 }} von {{ queue.length }} · {{ side === 'white' ? 'Weiß' : 'Schwarz' }} am Zug. Hier hast du in einer Partie einen Fehler gemacht.</p>
        <p v-if="message" class="verdict" role="status">{{ message }}</p>
      </div>
    </template>
    <template #board>
      <EvalBar :view="ev" :orientation="side" />
      <Board :fen="shownFen" :orientation="side" :movable="!solved" :arrows="boardArrows" @move="onMove" />
    </template>
    <template #controls>
      <button v-if="solved" class="pri" @click="next">Weiter</button>
      <span v-else class="muted">Finde den Zug auf dem Brett.</span>
      <span class="pos">{{ index + 1 }}/{{ queue.length }}</span>
    </template>
    <template #right>
      <EnginePanel :fen="shownFen" :orientation="side" :lock="solved ? null : 'task'" @view="ev = $event" />
    </template>
  </BoardLayout>
</template>
