<script setup lang="ts">
import type { Side } from '../content/types.ts'
import type { LayerModel } from '../chess/layerModel.ts'
import { squarePercent } from '../chess/squarePosition.ts'

const props = defineProps<{ model: LayerModel; orientation: Side; hovered?: string | null }>()
const pos = (square: string) => { const { left, top } = squarePercent(square, props.orientation); return { left: `${left}%`, top: `${top}%` } }
</script>

<template>
  <div class="layers" aria-hidden="true">
    <i v-for="r in model.reach" :key="'r' + r.square" class="sq reach" :class="{ occ: r.occupied }" :style="pos(r.square)"></i>
    <i v-if="hovered && model.reach.length" class="sq here" :style="pos(hovered)"></i>
    <i v-for="r in model.rings" :key="'h' + r.square" class="sq ring" :class="r.own ? 'own' : 'opp'" :style="pos(r.square)"><b>{{ r.own ? '!' : '+' }}</b></i>
    <i v-for="b in model.badges" :key="'c' + b.square" class="sq count" :style="pos(b.square)"><b>{{ b.attackers }}/{{ b.defenders }}</b></i>
  </div>
</template>

<style scoped>
.layers { position: absolute; inset: 0; pointer-events: none; z-index: 3; }
.sq { position: absolute; width: 12.5%; height: 12.5%; display: block; font-style: normal; }
/* Hanging: coloured ring with a white inner line (readable on light and dark squares), corner sign for the colour-blind */
.ring.own { box-shadow: inset 0 0 0 3px #c62020, inset 0 0 0 5px #fff; }
.ring.opp { box-shadow: inset 0 0 0 3px #12722f, inset 0 0 0 5px #fff; }
.ring b { position: absolute; top: 2px; right: 2px; min-width: 1.15em; height: 1.15em; border-radius: 50%; display: grid; place-items: center; font: 800 clamp(9px, 1.9vw, 14px)/1 system-ui, sans-serif; color: #fff; border: 1.5px solid #fff; }
.ring.own b { background: #c62020; } .ring.opp b { background: #12722f; }
/* Reach of the hovered piece */
.reach::after { content: ''; position: absolute; left: 36%; top: 36%; width: 28%; height: 28%; border-radius: 50%; background: #1f6fe0; box-shadow: 0 0 0 2px #fff; }
.reach.occ::after { inset: 0; left: 0; top: 0; width: auto; height: auto; border-radius: 0; background: none; box-shadow: inset 0 0 0 3px #1f6fe0, inset 0 0 0 5px #fff; }
.here { box-shadow: inset 0 0 0 3px #fff; }
/* Attackers / defenders */
.count b { position: absolute; left: 2px; bottom: 2px; padding: 1px 4px; border-radius: 6px; background: rgba(16, 20, 27, 0.9); color: #fff; font: 700 clamp(9px, 1.7vw, 12px)/1.2 var(--mono); border: 1px solid #fff; }
</style>
