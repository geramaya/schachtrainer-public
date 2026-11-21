<script setup lang="ts">
import TeacherHead from './TeacherHead.vue'
import Icon from './Icon.vue'
import { FIGUREN } from '../teacher/avatar.ts'
import type { FigurId } from '../teacher/avatar.ts'

/** Game start: free game or with teacher, and which of the four teachers. */
withDefaults(defineProps<{ on: boolean; figur: FigurId; quips: boolean; speak: boolean; audio: boolean; labels?: { on: string; off: string } }>(), { labels: () => ({ on: 'Mit Lehrer', off: 'Freie Partie' }) })
const emit = defineEmits<{ on: [boolean]; figur: [FigurId]; quips: [boolean]; speak: [boolean] }>()
</script>

<template>
  <div class="pick">
    <div class="segs wide" role="group" aria-label="Partieart">
      <button type="button" class="seg" :aria-pressed="on" @click="emit('on', true)"><Icon name="teacher" /> {{ labels.on }}</button>
      <button type="button" class="seg" :aria-pressed="!on" @click="emit('on', false)"><Icon name="free" /> {{ labels.off }}</button>
    </div>
    <TeacherHead v-if="on" :figur="figur" :name="FIGUREN.find((f) => f.id === figur)!.name" :quips="quips" :speak="speak" :audio="audio" @figur="emit('figur', $event)" @quips="emit('quips', $event)" @speak="emit('speak', $event)" />
  </div>
</template>

<style scoped>
.pick { margin: 0; }
.segs { margin-bottom: 0.5rem; }
</style>
