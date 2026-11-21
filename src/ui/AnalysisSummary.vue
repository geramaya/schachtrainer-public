<script setup lang="ts">
import { computed } from 'vue'
import type { Summary } from '../analysis/build.ts'
import { CATEGORIES, MEANING, NAME, SYMBOL } from '../analysis/category.ts'

/** Accuracy and the number of moves per category and side; symbol, name and colour together, with a short legend. */
const props = defineProps<{ summary: Summary; white: string; black: string }>()
const pct = (a: number | null) => (a === null ? '–' : `${a.toFixed(1).replace('.', ',')} %`)
/** Categories that occur at all (the rest is in the legend). */
const shown = computed(() => CATEGORIES.filter((c) => props.summary.white.counts[c] + props.summary.black.counts[c] > 0))
</script>

<template>
  <table class="sum" aria-label="Genauigkeit und Zugqualität">
    <thead>
      <tr><th></th><th>{{ white }} (Weiß)</th><th>{{ black }} (Schwarz)</th></tr>
    </thead>
    <tbody>
      <tr><th>Genauigkeit</th><td>{{ pct(summary.white.accuracy) }}</td><td>{{ pct(summary.black.accuracy) }}</td></tr>
      <tr v-for="c in shown" :key="c" :class="`q-${c}`" :title="MEANING[c]">
        <th class="cat"><b class="sym">{{ SYMBOL[c] }}</b> {{ NAME[c] }}</th>
        <td class="n">{{ summary.white.counts[c] }}</td>
        <td class="n">{{ summary.black.counts[c] }}</td>
      </tr>
    </tbody>
  </table>
  <details class="legend">
    <summary>Legende</summary>
    <ul>
      <li v-for="c in CATEGORIES" :key="c" :class="`q-${c}`"><b class="sym">{{ SYMBOL[c] }}</b> {{ NAME[c] }}: {{ MEANING[c] }}</li>
    </ul>
    <p class="muted">Gewertet wird der Verlust an Gewinnerwartung gegen den besten Zug (ohne Wertungszahl-Anpassung). Das Zeichen steht immer dabei, die Farbe ist nur Zugabe.</p>
  </details>
</template>

<style scoped>
.sum { width: 100%; border-collapse: collapse; font-size: var(--fs-small, 0.85rem); margin: 0.4rem 0; }
.sum th, .sum td { text-align: left; padding: 2px 6px; border-bottom: 1px solid var(--line); }
.sum thead th { color: var(--muted); font-weight: 600; }
.sum tbody th { font-weight: 600; }
.sum tr[class^='q-'] { background: var(--qt); }
.sym { color: var(--qc); font-family: var(--mono); font-weight: 800; display: inline-block; min-width: 1.6em; }
.n { color: var(--qc); font-weight: 700; font-family: var(--mono); }
.legend { font-size: var(--fs-small, 0.85rem); margin: 0.3rem 0 0.6rem; }
.legend summary { cursor: pointer; color: var(--muted); }
.legend ul { list-style: none; padding: 0; margin: 0.3rem 0; display: grid; gap: 2px; }
.legend li { padding: 1px 4px; border-left: 3px solid var(--qc); }
</style>
