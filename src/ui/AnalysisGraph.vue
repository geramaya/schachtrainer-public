<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Ev } from '../analysis/nag.ts'
import { graphPoints, plyAtX } from '../analysis/graph.ts'
import { layoutMarks, tooltipLeft } from '../analysis/marks.ts'
import type { GraphMark } from '../analysis/marks.ts'

/**
 * Evaluation over the half-moves (white view, win chance scale, mate at the edge). Moves with a notable category carry a mark with the
 * symbol (white moves above the curve, black below, close marks in further rows). Hover, keyboard focus and tap show a tooltip; click jumps to
 * the position. Colours come from the category classes (styles.css), the symbol is always there as text.
 */
const props = defineProps<{ positions: (Ev | null)[]; marks: GraphMark[]; current: number }>()
const emit = defineEmits<{ select: [ply: number] }>()

const H = 124
const PAD = 12
const GAP = 22
const ROW = 18
const TIP_W = 250
const box = ref<HTMLElement>()
const W = ref(300)
let ro: ResizeObserver | undefined
onMounted(() => {
  if (typeof ResizeObserver === 'undefined' || !box.value) return
  ro = new ResizeObserver(() => { W.value = Math.max(120, box.value?.clientWidth ?? 300) })
  ro.observe(box.value)
  W.value = Math.max(120, box.value.clientWidth)
})
onBeforeUnmount(() => ro?.disconnect())

const plies = computed(() => Math.max(0, props.positions.length - 1))
const inner = computed(() => H - 2 * PAD)
const pts = computed(() => graphPoints(props.positions, W.value, inner.value).map((p) => ({ ...p, y: p.y + PAD })))
const line = computed(() => pts.value.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '))
const area = computed(() => (pts.value.length > 1 ? `M${pts.value[0]!.x},${H} L${line.value.replace(/ /g, ' L')} L${pts.value.at(-1)!.x},${H} Z` : ''))
const xOf = (ply: number) => (plies.value ? (ply / plies.value) * W.value : 0)
const yOf = (ply: number) => pts.value.find((p) => p.ply === ply)?.y ?? H / 2

/** Position of each mark: x on its move, y next to the curve on the side of the mover, row from the collision layout (null = dot only). */
const placed = computed(() => {
  const out = props.marks.map((m) => ({ m, x: xOf(m.ply), row: null as number | null, y: 0 }))
  for (const side of ['white', 'black'] as const) {
    const group = out.filter((p) => p.m.side === side)
    const rows = layoutMarks(group.map((p) => ({ x: p.x, priority: p.m.priority })), GAP, 3)
    group.forEach((p, i) => { p.row = rows[i]! })
  }
  for (const p of out) {
    const base = yOf(p.m.ply)
    const dir = p.m.side === 'white' ? -1 : 1
    p.y = Math.max(10, Math.min(H - 10, base + dir * (14 + (p.row ?? 0) * ROW)))
  }
  return out
})

const hover = ref<number | null>(null)
const active = ref<number | null>(null)
const tip = computed(() => (active.value === null ? null : placed.value[active.value] ?? null))
/** The tooltip opens above the graph (the graph sits at the bottom of the column and would cut it off below). */
const tipStyle = computed(() => {
  const t = tip.value
  if (!t) return {}
  const w = Math.min(TIP_W, W.value)
  return { left: `${tooltipLeft(t.x, W.value, w)}px`, width: `${w}px`, bottom: `${H + 6}px` }
})
const label = (m: GraphMark) => `${m.title}, ${m.name}. Bewertung ${m.evalText}. ${m.sentence}`
const plyFromEvent = (e: PointerEvent | MouseEvent) => plyAtX(e.clientX - box.value!.getBoundingClientRect().left, W.value, plies.value)
</script>

<template>
  <div ref="box" class="graphwrap" @pointerleave="hover = null; active = null">
    <svg
      class="graph" :width="W" :height="H" :viewBox="`0 0 ${W} ${H}`" role="img" aria-label="Bewertungsverlauf der Partie; Marken an Zügen mit Zugzeichen, Klick springt zur Stellung"
      @pointermove="hover = plyFromEvent($event)" @click="emit('select', plyFromEvent($event))"
    >
      <rect :width="W" :height="H" class="bg" />
      <path :d="area" class="area" />
      <line x1="0" :x2="W" :y1="H / 2" :y2="H / 2" class="mid" />
      <polyline :points="line" class="curve" />
      <line v-if="hover !== null" :x1="xOf(hover)" :x2="xOf(hover)" y1="0" :y2="H" class="hover" />
      <line :x1="xOf(current)" :x2="xOf(current)" y1="0" :y2="H" class="cur" />
      <g
        v-for="(p, i) in placed" :key="p.m.ply" class="mark" :class="[`q-${p.m.cat}`, { dot: p.row === null, on: active === i }]" tabindex="0" role="button" :aria-label="label(p.m)"
        @pointerenter="active = i" @focus="active = i" @blur="active = null" @click.stop="active = i; emit('select', p.m.ply)"
        @keydown.enter.prevent="emit('select', p.m.ply)" @keydown.space.prevent="emit('select', p.m.ply)"
      >
        <line :x1="p.x" :x2="p.x" :y1="yOf(p.m.ply)" :y2="p.y" class="stem" />
        <template v-if="p.row !== null">
          <circle :cx="p.x" :cy="p.y" r="9" class="disc" />
          <text :x="p.x" :y="p.y" class="sym" text-anchor="middle" dominant-baseline="central">{{ p.m.symbol }}</text>
        </template>
        <circle v-else :cx="p.x" :cy="p.y" r="4" class="dotc" />
      </g>
    </svg>
    <div v-if="tip" class="tip" :style="tipStyle" role="status" :class="`q-${tip.m.cat}`">
      <p class="t"><b class="s">{{ tip.m.symbol }}</b> {{ tip.m.title }} – {{ tip.m.name }}</p>
      <p class="e">Bewertung {{ tip.m.evalText }}</p>
      <p v-if="tip.m.sentence" class="x">{{ tip.m.sentence }}</p>
    </div>
  </div>
</template>

<style scoped>
.graphwrap { position: relative; width: 100%; }
.graph { display: block; cursor: pointer; border-radius: 6px; max-width: 100%; }
.bg { fill: var(--panel-2); }
.area { fill: rgba(233, 237, 244, 0.22); }
.mid { stroke: var(--line); stroke-width: 1; }
.curve { fill: none; stroke: var(--text); stroke-width: 1.5; }
.hover { stroke: var(--muted); stroke-width: 1; stroke-dasharray: 3 3; }
.cur { stroke: var(--hint); stroke-width: 2; }
.mark { cursor: pointer; outline: none; }
.mark .stem { stroke: var(--qc); stroke-width: 1; opacity: 0.6; }
.mark .disc { fill: var(--panel); stroke: var(--qc); stroke-width: 1.5; }
.mark .sym { fill: var(--qc); font: 800 10px var(--mono); paint-order: stroke; }
.mark .dotc { fill: var(--qc); stroke: var(--panel); stroke-width: 1; }
.mark:focus-visible .disc, .mark:focus-visible .dotc, .mark.on .disc { stroke: var(--text); stroke-width: 2.5; }
.tip { position: absolute; z-index: 5; padding: 6px 9px; background: var(--panel); border: 1px solid var(--qc); border-left-width: 4px; border-radius: 6px; font-size: var(--fs-small, 0.85rem); box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45); pointer-events: none; }
.tip p { margin: 2px 0; }
.tip .t { font-weight: 700; }
.tip .s { color: var(--qc); font-family: var(--mono); }
.tip .e { color: var(--muted); font-family: var(--mono); }
</style>
