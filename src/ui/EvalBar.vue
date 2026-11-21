<script setup lang="ts">
import { computed } from 'vue'
import type { Side } from '../content/types.ts'
import { barCp, scoreLabel } from '../coach/ceval.ts'
import type { EngineView } from '../coach/ceval.ts'
import { whiteShare } from '../coach/evalbar.ts'

const props = defineProps<{ view: EngineView; orientation: Side }>()

const active = computed(() => props.view.access === 'on' || props.view.access === 'busy')
const share = computed(() => (active.value ? whiteShare(barCp(props.view.score)) : 50))
const label = computed(() => (active.value && props.view.score ? scoreLabel(props.view.score) : '–'))
const aria = computed(() => (active.value && props.view.score ? `Bewertung ${label.value} aus Sicht von Weiß` : props.view.access === 'locked' ? 'Bewertung nach deinem Zug verfügbar' : 'Keine Bewertung'))
</script>

<template>
  <div class="evalcol" :class="{ flipped: orientation === 'black', idle: !active, locked: view.access === 'locked' }" role="img" :aria-label="aria">
    <div class="evalbar" :title="label"><i :style="{ height: share + '%' }"></i></div>
  </div>
</template>

<style scoped>
.evalcol { display: flex; flex-direction: column; flex: none; height: var(--bs, 600px); }
.evalcol .evalbar { flex: 1; min-height: 0; }
.evalcol.locked .evalbar { background: repeating-linear-gradient(135deg, var(--panel-2) 0 6px, var(--panel) 6px 12px); }
.evalcol.locked .evalbar i { display: none; }
.evalcol.idle .evalbar i { background: var(--muted); opacity: 0.35; }
.flipped .evalbar i { bottom: auto; top: 0; }
</style>
