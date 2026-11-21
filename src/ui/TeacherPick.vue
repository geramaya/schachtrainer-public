<script setup lang="ts">
import TeacherHead from './TeacherHead.vue'
import { FIGUREN } from '../teacher/avatar.ts'
import type { FigurId } from '../teacher/avatar.ts'

/** Game start: free game or with teacher, and which of the four teachers. */
withDefaults(defineProps<{ on: boolean; figur: FigurId; quips: boolean; speak: boolean; audio: boolean; labels?: { on: string; off: string } }>(), { labels: () => ({ on: 'Mit Lehrer', off: 'Freie Partie' }) })
const emit = defineEmits<{ on: [boolean]; figur: [FigurId]; quips: [boolean]; speak: [boolean] }>()
</script>

<template>
  <div class="pick">
    <div class="mode" role="group" aria-label="Partieart">
      <button :class="{ sel: on }" :aria-pressed="on" @click="emit('on', true)">{{ labels.on }}</button>
      <button :class="{ sel: !on }" :aria-pressed="!on" @click="emit('on', false)">{{ labels.off }}</button>
    </div>
    <TeacherHead v-if="on" :figur="figur" :name="FIGUREN.find((f) => f.id === figur)!.name" :quips="quips" :speak="speak" :audio="audio" @figur="emit('figur', $event)" @quips="emit('quips', $event)" @speak="emit('speak', $event)" />
  </div>
</template>

<style scoped>
.pick { margin: 0.4rem 0 0.8rem; }
.mode { display: flex; gap: 6px; margin-bottom: 0.5rem; }
.mode button { flex: 1; }
.sel { border-color: var(--acc); }
</style>
