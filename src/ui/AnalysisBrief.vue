<script setup lang="ts">
import type { Summary } from '../analysis/build.ts'
import { NAME, SYMBOL } from '../analysis/category.ts'
import { briefSigns } from './compact.ts'

/** Short analysis overview: accuracy of both sides in one line, below the notable move signs per side (coloured, symbol always shown). */
defineProps<{ summary: Summary; white: string; black: string }>()
const pct = (a: number | null) => (a === null ? '–' : `${a.toFixed(1).replace('.', ',')} %`)
</script>

<template>
  <div class="brief" aria-label="Genauigkeit und Zugqualität, kurz">
    <p class="acc"><span class="lbl">Genauigkeit</span> <span :title="white">Weiß <b>{{ pct(summary.white.accuracy) }}</b></span> · <span :title="black">Schwarz <b>{{ pct(summary.black.accuracy) }}</b></span></p>
    <p class="signs">
      <span class="side">Weiß</span>
      <span v-for="s in briefSigns(summary.white.counts)" :key="s.cat" :class="`q-${s.cat}`" :title="NAME[s.cat]"><b class="sym">{{ SYMBOL[s.cat] }}</b> {{ s.n }}</span>
      <span class="side">Schwarz</span>
      <span v-for="s in briefSigns(summary.black.counts)" :key="s.cat" :class="`q-${s.cat}`" :title="NAME[s.cat]"><b class="sym">{{ SYMBOL[s.cat] }}</b> {{ s.n }}</span>
    </p>
  </div>
</template>

<style scoped>
.brief { font-size: var(--fs-small, 0.85rem); }
.brief p { margin: 0.15rem 0; }
.lbl, .side { color: var(--muted); }
.signs { display: flex; flex-wrap: wrap; gap: 2px 10px; align-items: baseline; }
.sym { color: var(--qc); font-family: var(--mono); font-weight: 800; }
.signs span[class^='q-'] { color: var(--qc); font-weight: 700; font-family: var(--mono); }
</style>
