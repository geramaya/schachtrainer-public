<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ContentBundle } from '../content/types.ts'
import { analysisFen } from '../train/analysisBoard.ts'
import type { GameRecord } from '../train/free-play.ts'
import { hrefHome } from '../router.ts'
import Sparring from './Sparring.vue'

/** Free game against Stockfish, with or without teacher; reuses the Sparring core. */
const props = defineProps<{ bundle: ContentBundle; fen?: string }>()
const start = computed(() => (props.fen ? analysisFen(props.fen) : null))
/** The finished game as data for saving later (not stored yet). */
const lastGame = ref<GameRecord | null>(null)
</script>

<template>
  <div class="pagebar"><p class="crumbs"><a :href="hrefHome()">Start</a> › Spielen</p></div>
  <p v-if="fen && !start" class="err" role="alert">Die Stellung in der Adresse ist ungültig oder unmöglich. Die Partie startet aus der Grundstellung.</p>
  <Sparring :bundle="bundle" side="white" free :start-fen="start ?? undefined" :data-finished="lastGame?.result" @finished="lastGame = $event" />
</template>
