<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { moveRows } from '../chess/moveText.ts'
import { scrollTopToShow } from './scrollIntoBox.ts'

const props = withDefaults(defineProps<{
  sans: string[]
  /** number of plies shown (0 = start position) */
  current: number
  startPly?: number
  /** false: the moves are shown but not clickable (e.g. a game in progress) */
  selectable?: boolean
  /** extra CSS class per ply index (1-based, like `current`), e.g. error severity or book exit */
  marks?: Record<number, string>
  titles?: Record<number, string>
  /** move sign per ply index (1-based like `current`), shown after the move in its colour */
  nags?: Record<number, string>
  /** category per ply index (like `nags`): tints the cell, the symbol shows it in colour (global classes q-<category>) */
  cats?: Record<number, string>
}>(), { startPly: 0, selectable: true, marks: () => ({}), titles: () => ({}), nags: () => ({}), cats: () => ({}) })
const emit = defineEmits<{ select: [index: number] }>()

const rows = computed(() => moveRows(props.sans, props.startPly))
const box = ref<HTMLElement>()

/** The list scrolls on its own to the current move (with one row of air below), also when the box is resized. */
function keepCurrentInView() {
  const b = box.value
  const el = b?.querySelector<HTMLElement>('.m.cur')
  if (!b || !el) return
  const top = scrollTopToShow({ scrollTop: b.scrollTop, height: b.clientHeight }, { top: el.offsetTop, height: el.offsetHeight * 2 })
  if (top !== b.scrollTop) b.scrollTop = top
}
watch(() => [props.current, props.sans.length], async () => { await nextTick(); keepCurrentInView() }, { immediate: true, flush: 'post' })
let ro: ResizeObserver | undefined
onMounted(() => { if (typeof ResizeObserver !== 'undefined' && box.value) { ro = new ResizeObserver(keepCurrentInView); ro.observe(box.value) } })
onBeforeUnmount(() => ro?.disconnect())
</script>

<template>
  <section class="pane movescard" aria-label="Zugfolge">
    <div class="h">Züge</div>
    <div ref="box" class="moves">
      <p v-if="!rows.length" class="muted">Noch kein Zug.</p>
      <div v-for="r in rows" :key="r.number" class="row">
        <span class="mn">{{ r.number }}.</span>
        <template v-for="c in [r.white, r.black]" :key="c?.index ?? 'blank'">
          <button
            v-if="c" type="button" class="m" :class="[marks[c.index], cats[c.index] ? `q-${cats[c.index]} has-q` : '', { cur: current === c.index }]" :title="titles[c.index]" :disabled="!selectable"
            @click="emit('select', c.index)"
          >{{ c.san }}<span v-if="nags[c.index]" class="nag">{{ nags[c.index] }}</span></button>
          <span v-else-if="!r.white" class="m gap">…</span>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.movescard { display: flex; flex-direction: column; min-height: 6rem; flex: 1 1 0; padding: 10px 12px; }
.h { font-size: var(--fs-label); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
.moves { position: relative; flex: 1; min-height: 0; overflow-y: auto; margin-top: 6px; font: 500 var(--fs-notation)/1.4 var(--mono); }
.moves p { margin: 0; font: inherit; }
.row { display: grid; grid-template-columns: 2.6rem 1fr 1fr; align-items: center; }
.row:nth-child(odd) { background: rgba(255, 255, 255, 0.03); }
.mn { color: var(--muted); padding-left: 6px; }
.gap { color: var(--muted); }
.m { background: none; border: 0; color: var(--text); font: inherit; text-align: left; padding: 2px 8px; border-radius: 4px; cursor: pointer; }
.m:hover:not(:disabled) { background: var(--panel-2); }
.m:disabled { cursor: default; }
.m.cur { background: var(--acc); color: var(--ink); font-weight: 700; }
.m.ungenau { color: var(--hint); }
.m.fehler, .m.patzer { color: var(--err-text); }
.m.cur.ungenau, .m.cur.fehler, .m.cur.patzer { color: var(--ink); }
.m.has-q { background: var(--qt); }
.m.has-q:hover:not(:disabled) { background: color-mix(in srgb, var(--qc) 26%, transparent); }
.nag { margin-left: 3px; font-weight: 800; color: var(--qc); }
.m.cur .nag { color: var(--ink); }
.m.cur.has-q { background: var(--acc); }
.m.exit { box-shadow: inset 0 -2px 0 var(--badge-engine); }
</style>
