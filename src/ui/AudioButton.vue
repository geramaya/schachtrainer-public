<script setup lang="ts">
import { publicUrl } from './assetBase.ts'
import { onBeforeUnmount, ref, watch } from 'vue'
import { loadAudioManifest } from '../audio/manifest.ts'
import type { AudioEntry } from '../audio/manifest.ts'

const props = defineProps<{ audioId: string; label: string }>()

const entry = ref<AudioEntry | null>(null)
const playing = ref(false)
const current = ref(0)
const duration = ref(0)
const showText = ref(false)
let audio: HTMLAudioElement | null = null

function stop() {
  audio?.pause()
  audio = null
  playing.value = false
  current.value = 0
}

watch(
  () => props.audioId,
  async (id) => {
    stop()
    showText.value = false
    entry.value = null
    const found = (await loadAudioManifest())[id]
    if (id === props.audioId) {
      entry.value = found ?? null
      duration.value = found?.durationSec ?? 0
    }
  },
  { immediate: true },
)

function toggle() {
  if (!entry.value) return
  if (!audio) {
    audio = new Audio(publicUrl(`audio/${entry.value.file}`))
    audio.addEventListener('timeupdate', () => (current.value = audio?.currentTime ?? 0))
    audio.addEventListener('loadedmetadata', () => { if (audio && isFinite(audio.duration)) duration.value = audio.duration })
    audio.addEventListener('ended', () => { playing.value = false; current.value = 0 })
  }
  if (playing.value) {
    audio.pause()
    playing.value = false
  } else {
    void audio.play().then(() => (playing.value = true)).catch(() => (playing.value = false))
  }
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
onBeforeUnmount(stop)
</script>

<template>
  <div v-if="entry" class="audio">
    <button type="button" @click="toggle">{{ playing ? '⏸ Pause' : '▶ ' + label }}</button>
    <progress :value="current" :max="duration || 1" aria-label="Fortschritt"></progress>
    <span class="muted">{{ fmt(current) }} / {{ fmt(duration) }}</span>
    <button type="button" class="linkish" :aria-expanded="showText" @click="showText = !showText">
      {{ showText ? 'Text verbergen' : 'Text zeigen' }}
    </button>
    <p v-if="showText" class="audio-text">{{ entry.text }}</p>
  </div>
</template>

<style scoped>
.audio { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin: 0; font-size: var(--fs-small); }
.audio progress { flex: 1 1 8rem; min-width: 6rem; }
.audio-text { flex-basis: 100%; white-space: pre-line; margin: 0.25rem 0 0; }
.linkish { background: none; border: none; padding: 0; text-decoration: underline; cursor: pointer; color: inherit; font: inherit; }
</style>
