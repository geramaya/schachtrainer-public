<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { LAYERS, isLocked } from './layerSettings.ts'
import { layerSettings, layersLocked, setLayer } from './layerState.ts'

const open = ref(false)
const root = ref<HTMLElement>()
const count = () => LAYERS.filter((l) => layerSettings.value[l.id] && !isLocked(l.id, layersLocked.value)).length
const outside = (e: MouseEvent) => { if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false }
const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') open.value = false }
onMounted(() => { document.addEventListener('mousedown', outside); document.addEventListener('keydown', esc) })
onBeforeUnmount(() => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', esc) })
</script>

<template>
  <div ref="root" class="layer-menu end">
    <button type="button" class="eye" :class="{ on: count() > 0 }" :aria-expanded="open" aria-controls="layer-popover" title="Brett-Ebenen: Angriffe, Drohungen, Felder" aria-label="Brett-Ebenen" @click="open = !open">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7S18.5 19 12 19 1.5 12 1.5 12z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" /><circle cx="12" cy="12" r="3.2" fill="currentColor" /></svg>
      <span v-if="count()" class="n">{{ count() }}</span>
    </button>
    <div v-if="open" id="layer-popover" class="pop" role="group" aria-label="Brett-Ebenen">
      <p class="h">Auf dem Brett zeigen</p>
      <label v-for="l in LAYERS" :key="l.id" class="row" :class="{ locked: isLocked(l.id, layersLocked) }">
        <input type="checkbox" role="switch" :checked="layerSettings[l.id]" :disabled="isLocked(l.id, layersLocked)" @change="setLayer(l.id, ($event.target as HTMLInputElement).checked)" />
        <span class="knob" aria-hidden="true"></span>
        <span class="t"><b>{{ l.label }}</b><small>{{ l.hint }}</small><small v-if="isLocked(l.id, layersLocked)" class="lock">{{ layersLocked === 'all' ? 'Gesperrt in der Wertungspartie: ohne Hilfen.' : 'Gesperrt, bis die Aufgabe gelöst ist: sie würde die Antwort verraten.' }}</small></span>
      </label>
    </div>
  </div>
</template>

<style scoped>
.layer-menu { position: relative; flex: none; }
.eye { position: relative; height: 36px; min-width: 40px; padding: 0 8px; border-radius: 7px; border: 1px solid var(--line); background: var(--panel-2); color: var(--muted); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
.eye:hover, .eye[aria-expanded='true'] { color: var(--text); }
.eye.on { color: var(--text); box-shadow: inset 0 0 0 1.5px var(--acc); }
.n { position: absolute; top: -6px; right: -6px; min-width: 17px; height: 17px; border-radius: 9px; background: var(--acc); color: var(--ink); font: 700 11px/17px system-ui, sans-serif; text-align: center; }
.pop { position: absolute; right: 0; bottom: calc(100% + 8px); width: min(340px, 80vw); padding: 10px 12px 6px; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.5); z-index: 20; }
.h { margin: 0 0 6px; font-size: var(--fs-label); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
.row { display: flex; gap: 10px; align-items: flex-start; padding: 6px 0; border-top: 1px solid var(--line); cursor: pointer; }
.row:first-of-type { border-top: 0; }
.row.locked { cursor: default; opacity: 0.7; }
.row input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.knob { position: relative; flex: none; width: 30px; height: 17px; margin-top: 3px; border-radius: 9px; background: var(--line); transition: background var(--t-fast); }
.knob::after { content: ''; position: absolute; top: 2px; left: 2px; width: 13px; height: 13px; border-radius: 50%; background: var(--text); transition: transform var(--t-fast) var(--ease-out); }
.row input:checked + .knob { background: var(--ok); }
.row.locked input:checked + .knob { background: var(--line); }
.row.locked input:checked + .knob::after { background: var(--muted); }
.row input:checked + .knob::after { transform: translateX(13px); background: var(--ink); }
.row input:focus-visible + .knob { outline: 2px solid var(--acc); outline-offset: 2px; }
.t { display: flex; flex-direction: column; gap: 1px; }
.t small { color: var(--muted); font-size: var(--fs-label); line-height: 1.35; }
.t small.lock { color: var(--hint); }
</style>
