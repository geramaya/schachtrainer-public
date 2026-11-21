<script setup lang="ts">
import { computed, ref } from 'vue'
import { INC_MAX, MINUTE_STEPS, TIME_CONTROLS, customTimeControl } from '../train/clock.ts'
import type { TimeControl } from '../train/clock.ts'

/** Thinking time as tiles like on Lichess: no clock (default), Bullet, Blitz, Schnellschach, Klassisch. */
const emit = defineEmits<{ select: [TimeControl | null]; pause: [boolean] }>()
const props = defineProps<{ modelValue: TimeControl | null; withTeacher: boolean; teacherPause: boolean }>()
/** "Eigene": the sliders start with the stored free value, else 5+3. */
const custom = computed(() => props.modelValue?.id.startsWith('c:') ?? false)
const stepIx = ref(Math.max(0, MINUTE_STEPS.indexOf(custom.value ? props.modelValue!.baseMs / 60_000 : 5)))
const inc = ref(custom.value ? props.modelValue!.incMs / 1000 : 3)
const open = ref(custom.value)
const mine = computed(() => customTimeControl(MINUTE_STEPS[stepIx.value]!, inc.value))
const apply = () => { if (mine.value) emit('select', mine.value) }
</script>

<template>
  <fieldset class="tc">
    <legend>Bedenkzeit</legend>
    <div class="row">
      <button type="button" class="tile none" :class="{ sel: modelValue === null }" :aria-pressed="modelValue === null" @click="emit('select', null)">Ohne Zeit</button>
    </div>
    <div v-for="g in TIME_CONTROLS" :key="g.group" class="row">
      <span class="grp">{{ g.group }}</span>
      <button v-for="t in g.items" :key="t.id" type="button" class="tile" :class="{ sel: modelValue?.id === t.id }" :aria-pressed="modelValue?.id === t.id" @click="emit('select', t)">{{ t.label }}</button>
    </div>
    <div class="row">
      <span class="grp">Eigene</span>
      <button type="button" class="tile" :class="{ sel: custom }" :aria-pressed="custom" @click="open = true; apply()">{{ custom ? modelValue!.label : 'Eigene …' }}</button>
    </div>
    <div v-if="open" class="own">
      <label>Minuten: <b>{{ mine?.label.split('+')[0] }}</b>
        <input type="range" min="0" :max="MINUTE_STEPS.length - 1" step="1" :value="stepIx" aria-label="Minuten" @input="stepIx = Number(($event.target as HTMLInputElement).value); apply()" />
      </label>
      <label>Inkrement (Sekunden): <b>{{ inc }}</b>
        <input type="range" min="0" :max="INC_MAX" step="1" :value="inc" aria-label="Inkrement in Sekunden" @input="inc = Number(($event.target as HTMLInputElement).value); apply()" />
      </label>
    </div>
    <label v-if="modelValue && withTeacher" class="pause">
      <input type="checkbox" :checked="teacherPause" @change="emit('pause', ($event.target as HTMLInputElement).checked)" />
      Lehrer hält die Uhr an (bei Rückfrage, Prüfung und Hinweis; die Partie gilt dann als Lernpartie). Aus: die Uhr läuft immer, auch bei der Rückfrage.
    </label>
  </fieldset>
</template>

<style scoped>
.tc { border: 0; margin: 0.4rem 0 0.8rem; padding: 0; min-width: 0; }
.tc legend { padding: 0; font-weight: 600; margin-bottom: 4px; }
.row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 4px 0; }
.grp { flex: 0 0 6.8rem; color: var(--muted); font-size: var(--fs-small, 0.85rem); }
.tile { min-width: 3.4rem; height: 34px; padding: 0 10px; border-radius: 7px; border: 1px solid var(--line); background: var(--panel-2); color: var(--text); font: 600 var(--fs-small, 0.85rem) var(--mono); cursor: pointer; }
.tile.none { font-family: inherit; }
.tile.sel { border-color: var(--acc); background: var(--acc); color: var(--ink); }
.own { display: grid; gap: 4px; margin: 4px 0 6px; font-size: var(--fs-small, 0.85rem); color: var(--muted); }
.own label { display: flex; align-items: center; gap: 8px; }
.own input[type='range'] { flex: 1; min-width: 0; }
.pause { display: block; margin-top: 6px; font-size: var(--fs-small, 0.85rem); color: var(--muted); }
</style>
