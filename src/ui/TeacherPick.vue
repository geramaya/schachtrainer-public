<script setup lang="ts">
import TeacherAvatar from './TeacherAvatar.vue'
import QuipToggles from './QuipToggles.vue'
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
    <div v-if="on" class="figs" role="group" aria-label="Lehrer wählen">
      <button v-for="f in FIGUREN" :key="f.id" :class="{ sel: figur === f.id }" :aria-pressed="figur === f.id" :title="f.name" @click="emit('figur', f.id)">
        <TeacherAvatar :figur="f.id" gefuehl="neutral" :size="56" />
        <span>{{ f.name }}</span>
      </button>
    </div>
    <QuipToggles v-if="on" :quips="quips" :speak="speak" :audio="audio" @quips="emit('quips', $event)" @speak="emit('speak', $event)" />
  </div>
</template>

<style scoped>
.pick { margin: 0.4rem 0 0.8rem; }
.mode { display: flex; gap: 6px; margin-bottom: 0.5rem; }
.mode button { flex: 1; }
.sel { border-color: var(--acc); }
.figs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.figs button { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px 2px; font-size: 0.75rem; line-height: 1.1; text-align: center; }
</style>
