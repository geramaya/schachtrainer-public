<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from './Icon.vue'
import type { IconName } from './Icon.vue'
import { INC_MAX, MINUTE_STEPS, TIME_CONTROLS, customTimeControl } from '../train/clock.ts'
import type { TimeControl } from '../train/clock.ts'

/** Thinking time as tiles like on Lichess (big time, small category): no clock (default), Bullet, Blitz, Rapid, Klassisch and a free value. */
const props = defineProps<{ modelValue: TimeControl | null; /** a teacher game: offers the switch for the clock stop */ withTeacher: boolean; teacherPause: boolean }>()
const emit = defineEmits<{ select: [TimeControl | null]; pause: [boolean] }>()
const CATEGORY: Record<string, { sub: string; icon: IconName }> = { Bullet: { sub: 'Bullet', icon: 'bullet' }, Blitz: { sub: 'Blitz', icon: 'blitz' }, Schnellschach: { sub: 'Rapid', icon: 'rapid' }, Klassisch: { sub: 'Klassisch', icon: 'classic' } }
const tiles = TIME_CONTROLS.flatMap((g) => g.items.map((t) => ({ t, ...CATEGORY[g.group]! })))
/** "Eigene": the sliders start with the stored free value, else 5+3. */
const custom = computed(() => props.modelValue?.id.startsWith('c:') ?? false)
const stepIx = ref(Math.max(0, MINUTE_STEPS.indexOf(custom.value ? props.modelValue!.baseMs / 60_000 : 5)))
const inc = ref(custom.value ? props.modelValue!.incMs / 1000 : 3)
const open = ref(custom.value)
const mine = computed(() => customTimeControl(MINUTE_STEPS[stepIx.value]!, inc.value))
const apply = () => { if (mine.value) emit('select', mine.value) }
</script>

<template>
  <div class="tc">
    <div class="segs" role="group" aria-label="Bedenkzeit">
      <button type="button" class="seg ctile" :aria-pressed="modelValue === null" @click="emit('select', null)"><span class="big">Ohne</span><span class="sub">Zeit</span></button>
      <button v-for="x in tiles" :key="x.t.id" type="button" class="seg ctile" :aria-pressed="modelValue?.id === x.t.id" @click="emit('select', x.t)">
        <span class="big">{{ x.t.label }}</span><span class="sub"><Icon :name="x.icon" :size="12" /> {{ x.sub }}</span>
      </button>
      <button type="button" class="seg ctile" :aria-pressed="custom" @click="open = true; apply()"><span class="big">{{ custom ? modelValue!.label : 'Eigene' }}</span><span class="sub"><Icon name="custom" :size="12" /> Eigene</span></button>
    </div>
    <div v-if="open" class="own">
      <label>Minuten <b>{{ mine?.label.split('+')[0] }}</b>
        <input type="range" min="0" :max="MINUTE_STEPS.length - 1" step="1" :value="stepIx" aria-label="Minuten" @input="stepIx = Number(($event.target as HTMLInputElement).value); apply()" />
      </label>
      <label>Inkrement (s) <b>{{ inc }}</b>
        <input type="range" min="0" :max="INC_MAX" step="1" :value="inc" aria-label="Inkrement in Sekunden" @input="inc = Number(($event.target as HTMLInputElement).value); apply()" />
      </label>
    </div>
    <label v-if="modelValue && withTeacher" class="pause" title="Beide Uhren stehen bei Prüfung, Rückfrage, Lehrerkommentar und offenem Hinweis; die Partie gilt dann als Lernpartie. Aus: Die Uhr läuft immer, auch bei der Rückfrage.">
      <input type="checkbox" :checked="teacherPause" @change="emit('pause', ($event.target as HTMLInputElement).checked)" /> Lehrer hält die Uhr an
    </label>
  </div>
</template>

<style scoped>
.own { display: grid; gap: 4px; margin: 8px 0 2px; font-size: var(--fs-small, 0.85rem); color: var(--muted); }
.own label { display: flex; align-items: center; gap: 8px; }
.own b { min-width: 2.4em; color: var(--text); font-variant-numeric: tabular-nums; }
.own input[type='range'] { flex: 1; min-width: 0; }
.pause { display: flex; align-items: center; gap: 6px; margin-top: 8px; font-size: var(--fs-small, 0.85rem); cursor: help; }
</style>
