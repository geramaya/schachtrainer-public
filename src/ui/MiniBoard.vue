<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Chessground } from '@lichess-org/chessground'
import type { Api } from '@lichess-org/chessground/api'
import type { Key } from '@lichess-org/chessground/types'
import type { Side } from '../content/types.ts'

const props = defineProps<{ fen: string; orientation: Side; lastMove?: [string, string] }>()
const el = ref<HTMLElement>()
let api: Api | undefined
const config = () => ({ fen: props.fen, orientation: props.orientation, viewOnly: true, animation: { enabled: false }, lastMove: props.lastMove as Key[] | undefined, coordinates: false })
onMounted(() => { api = Chessground(el.value!, config()) })
onBeforeUnmount(() => api?.destroy())
watch(() => [props.fen, props.orientation, props.lastMove], () => api?.set(config()))
</script>

<template>
  <div class="mini"><div ref="el" class="mini-board"></div></div>
</template>

<style scoped>
.mini { width: 180px; aspect-ratio: 1; }
.mini-board { width: 100%; height: 100%; }
</style>
