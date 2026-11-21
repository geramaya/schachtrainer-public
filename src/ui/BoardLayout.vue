<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { keyboardWidth, LIMITS } from './splitWidths.ts'
import type { SplitSide } from './splitWidths.ts'
import LayerMenu from './LayerMenu.vue'
import { persistWidths, resetWidth, setWidth, viewportHeight, viewportWidth, widths } from './layoutState.ts'

/** Page layout A: coach left, board with controls in the middle, engine and moves right; the side columns are resizable. */
const onResize = () => { viewportWidth.value = window.innerWidth; viewportHeight.value = window.innerHeight }
onMounted(() => { onResize(); window.addEventListener('resize', onResize) })
onBeforeUnmount(() => window.removeEventListener('resize', onResize))

let drag: { side: SplitSide; x0: number; w0: number } | null = null
function down(side: SplitSide, e: PointerEvent) {
  drag = { side, x0: e.clientX, w0: widths.value[side] }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  e.preventDefault()
}
function move(e: PointerEvent) {
  if (!drag) return
  const dx = e.clientX - drag.x0
  setWidth(drag.side, drag.w0 + (drag.side === 'left' ? dx : -dx), false)
}
function up() { if (drag) persistWidths(); drag = null }
function key(side: SplitSide, e: KeyboardEvent) {
  const w = keyboardWidth(side, widths.value[side], e.key)
  if (w === null) return
  setWidth(side, w, true)
  e.preventDefault()
}
const SIDES: { side: SplitSide; label: string }[] = [{ side: 'left', label: 'Breite der Coach-Spalte' }, { side: 'right', label: 'Breite der Engine-Spalte' }]
</script>

<template>
  <div class="lay" :class="{ bars: $slots.top || $slots.bottom }" :style="{ '--side-l': widths.left + 'px', '--side-r': widths.right + 'px' }">
    <div class="col left"><slot name="left" /></div>
    <div
      class="grip" role="separator" aria-orientation="vertical" tabindex="0" :aria-label="SIDES[0]!.label + ' (Pfeiltasten, Doppelklick = Standard)'"
      :aria-valuenow="Math.round(widths.left)" :aria-valuemin="LIMITS.left.min" :aria-valuemax="LIMITS.left.max" title="Ziehen, Pfeiltasten oder Doppelklick für Standardbreite"
      @pointerdown="down('left', $event)" @pointermove="move" @pointerup="up" @pointercancel="up" @keydown="key('left', $event)" @dblclick="resetWidth('left')"
    ></div>
    <div class="center">
      <div class="stack">
        <div v-if="$slots.top" class="bar"><slot name="top" /></div>
        <div class="boardwrap"><slot name="board" /></div>
        <div v-if="$slots.bottom" class="bar"><slot name="bottom" /></div>
        <div v-if="$slots.controls" class="ctl"><slot name="controls" /><LayerMenu /></div>
      </div>
    </div>
    <div
      class="grip" role="separator" aria-orientation="vertical" tabindex="0" :aria-label="SIDES[1]!.label + ' (Pfeiltasten, Doppelklick = Standard)'"
      :aria-valuenow="Math.round(widths.right)" :aria-valuemin="LIMITS.right.min" :aria-valuemax="LIMITS.right.max" title="Ziehen, Pfeiltasten oder Doppelklick für Standardbreite"
      @pointerdown="down('right', $event)" @pointermove="move" @pointerup="up" @pointercancel="up" @keydown="key('right', $event)" @dblclick="resetWidth('right')"
    ></div>
    <div class="col right"><slot name="right" /></div>
  </div>
</template>
