<script setup lang="ts">
import { TIME_CONTROLS } from '../train/clock.ts'
import type { TimeControl } from '../train/clock.ts'

/** Thinking time as tiles like on Lichess: no clock (default), Bullet, Blitz, Schnellschach, Klassisch. */
defineProps<{ modelValue: TimeControl | null; /** a teacher game: offers the switch for the clock stop */ withTeacher: boolean; teacherPause: boolean }>()
const emit = defineEmits<{ select: [TimeControl | null]; pause: [boolean] }>()
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
.pause { display: block; margin-top: 6px; font-size: var(--fs-small, 0.85rem); color: var(--muted); }
</style>
