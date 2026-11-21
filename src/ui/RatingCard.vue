<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ratedGameOf } from '../games/library.ts'
import type { StoredGame } from '../games/model.ts'
import { CATEGORIES, CATEGORY_LABEL, START_RATING, recommend, replayRatings } from '../train/rating.ts'
import type { Category } from '../train/rating.ts'

/** Own training rating from Wertungspartien: one number per time category, its course as a small graph, and the advice for the next level. */
const props = defineProps<{ games: StoredGame[]; /** Stockfish level set now */ level: number; /** Maia level set now */ maiaLevel: number }>()

/** The rating is kept per opponent: Stockfish levels and Maia levels are not comparable. */
const opponent = ref<'stockfish' | 'maia'>('stockfish')
const rated = computed(() => replayRatings(props.games.map(ratedGameOf), opponent.value))
const count = (c: Category) => rated.value.entries.filter((e) => e.category === c).length
const chosen = ref<Category>('none')
// the category with the most games is shown first
watch(rated, () => { if (!count(chosen.value)) chosen.value = [...CATEGORIES].sort((a, b) => count(b) - count(a))[0]! }, { immediate: true })
const mine = computed(() => rated.value.entries.filter((e) => e.category === chosen.value))
const last = (c: Category) => rated.value.entries.filter((e) => e.category === c).at(-1)
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '±0')
const advice = computed(() => (opponent.value === 'maia' ? recommend(rated.value.entries, chosen.value, props.maiaLevel, { min: 1100, max: 1900 }) : recommend(rated.value.entries, chosen.value, props.level)))

const W = 280
const H = 64
/** Course of the chosen category: start value, then the rating after each game (the last 40). */
const path = computed(() => {
  const vals = [START_RATING, ...mine.value.map((e) => e.after)].slice(-41)
  if (vals.length < 2) return ''
  const lo = Math.min(...vals, START_RATING) - 10
  const hi = Math.max(...vals, START_RATING) + 10
  const x = (i: number) => (i / (vals.length - 1)) * (W - 8) + 4
  const y = (v: number) => H - 4 - ((v - lo) / (hi - lo)) * (H - 8)
  return vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
})
const baseY = computed(() => {
  const vals = [START_RATING, ...mine.value.map((e) => e.after)].slice(-41)
  const lo = Math.min(...vals, START_RATING) - 10
  const hi = Math.max(...vals, START_RATING) + 10
  return H - 4 - ((START_RATING - lo) / (hi - lo)) * (H - 8)
})
</script>

<template>
  <section class="card rating" aria-label="Meine Wertung">
    <h2>Meine Wertung</h2>
    <div class="opp" role="group" aria-label="Gegner">
      <button type="button" class="cat" :aria-pressed="opponent === 'stockfish'" @click="opponent = 'stockfish'">Stockfish</button>
      <button type="button" class="cat" :aria-pressed="opponent === 'maia'" @click="opponent = 'maia'">Maia (menschlich)</button>
    </div>
    <p class="muted note">Eigene Trainingswertung aus Wertungspartien gegen {{ opponent === 'maia' ? 'Maia 2' : 'Stockfish' }} – nicht mit Lichess oder FIDE vergleichbar. Gegner ist die eingestellte {{ opponent === 'maia' ? 'Maia' : 'Stockfish' }}-Stufe; je Gegnerart wird getrennt gezählt.</p>
    <div class="cats" role="group" aria-label="Bedenkzeit">
      <button v-for="c in CATEGORIES" :key="c" type="button" class="cat" :aria-pressed="chosen === c" @click="chosen = c">
        <span class="nm">{{ CATEGORY_LABEL[c] }}</span>
        <b class="num">{{ rated.current[c] }}</b>
        <span class="dl" :class="{ up: (last(c)?.delta ?? 0) > 0, down: (last(c)?.delta ?? 0) < 0 }">{{ last(c) ? signed(last(c)!.delta) : '–' }}</span>
      </button>
    </div>
    <div class="graph">
      <svg v-if="mine.length" :viewBox="`0 0 ${W} ${H}`" :width="W" :height="H" role="img" :aria-label="`Verlauf ${CATEGORY_LABEL[chosen]}: ${mine.length} Partien, aktuell ${rated.current[chosen]}`">
        <line x1="0" :x2="W" :y1="baseY" :y2="baseY" class="base" />
        <path :d="path" class="line" />
      </svg>
      <p v-else class="muted">Noch keine Wertungspartie in „{{ CATEGORY_LABEL[chosen] }}“. Spiele ohne Lehrer, dann erscheint hier deine Zahl.</p>
    </div>
    <p class="advice" :class="{ empty: !advice }">{{ advice?.text ?? 'Empfehlung ab 3 Partien in dieser Kategorie.' }}</p>
  </section>
</template>

<style scoped>
.rating h2 { margin: 0 0 0.3rem; font-size: var(--fs-h3); }
.note { margin: 0 0 0.6rem; font-size: var(--fs-small); }
.opp { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin: 0 0 0.5rem; }
.opp .cat { height: 36px; }
.cats { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 6px; }
.cat { box-sizing: border-box; height: 64px; display: grid; justify-items: center; align-content: center; gap: 2px; padding: 4px; border-radius: 8px; border: 1px solid var(--line); background: var(--panel-2); color: var(--text); font: inherit; cursor: pointer; }
.cat[aria-pressed='true'] { background: var(--acc); border-color: var(--acc); color: var(--ink); }
.nm { font-size: 11px; font-weight: 500; }
.num { font-size: 20px; line-height: 1; font-variant-numeric: tabular-nums; }
.dl { font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; }
.cat:not([aria-pressed='true']) .dl.up { color: var(--ok-text); }
.cat:not([aria-pressed='true']) .dl.down { color: var(--err-text); }
.graph { height: 72px; margin: 10px 0 4px; display: flex; align-items: center; }
.graph svg { display: block; max-width: 100%; height: auto; }
.base { stroke: var(--line); stroke-dasharray: 4 4; }
.line { fill: none; stroke: var(--acc); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.advice { margin: 0; min-height: 1.4em; font-weight: 600; }
.advice.empty { font-weight: 400; color: var(--muted); }
</style>
