<script setup lang="ts">
import { computed } from 'vue'
import type { Side } from '../content/types.ts'
import type { TakenPiece } from '../chess/material.ts'
import { materialOf } from '../chess/material.ts'

/**
 * Player bar above or below the board (like Lichess): colour dot, name, rating if known, the pieces this side has taken
 * and the material lead as "+2". Fixed height (see --pbar), so it never changes the board size.
 */
const props = defineProps<{ side: Side; name: string; elo?: number | null; fen: string }>()
const GLYPH: Record<TakenPiece, string> = { p: '\u265F', n: '\u265E', b: '\u265D', r: '\u265C', q: '\u265B' }
const mat = computed(() => materialOf(props.fen))
const taken = computed(() => (props.side === 'white' ? mat.value.takenByWhite : mat.value.takenByBlack))
const lead = computed(() => (props.side === 'white' ? mat.value.diff : -mat.value.diff))
</script>

<template>
  <div class="pbar" :class="side" :aria-label="`${name}${elo ? ` (${elo})` : ''}, ${side === 'white' ? 'Weiß' : 'Schwarz'}`">
    <i class="dot" aria-hidden="true"></i>
    <span class="nm">{{ name }}</span><span v-if="elo" class="elo">({{ elo }})</span>
    <span class="taken" aria-hidden="true"><span v-for="(p, i) in taken" :key="i" :class="side === 'white' ? 'ofblack' : 'ofwhite'">{{ GLYPH[p] }}</span></span>
    <b v-if="lead > 0" class="lead" :title="`Materialvorteil ${lead}`">+{{ lead }}</b>
  </div>
</template>

<style scoped>
.pbar { height: var(--pbar, 28px); box-sizing: border-box; display: flex; align-items: center; gap: 8px; padding: 0 4px; min-width: 0; font-size: var(--fs-small, 0.85rem); color: var(--text); }
.dot { flex: none; width: 12px; height: 12px; border-radius: 50%; border: 1px solid var(--line); }
.white .dot { background: #f2f2f2; }
.black .dot { background: #1c1c1c; border-color: #6b7890; }
.nm { font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.elo { color: var(--muted); flex: none; }
.taken { display: inline-flex; flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; font-size: 15px; line-height: 1; letter-spacing: -2px; }
.ofblack { color: #6f7b8f; }
.ofwhite { color: #cfd6e3; }
.lead { flex: none; margin-left: auto; color: var(--muted); font-family: var(--mono); }
</style>
