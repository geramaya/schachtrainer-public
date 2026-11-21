<script setup lang="ts">
/** Small speaker button in the top bar: sounds on/off. Volume lives in "Über". */
import { playSound, setSoundSettings, soundSettings } from './sound.ts'

function toggle() {
  setSoundSettings({ on: !soundSettings.value.on })
  playSound('move') // audible confirmation when switched on; silent when switched off
}
</script>

<template>
  <button type="button" class="snd" :aria-pressed="soundSettings.on" :aria-label="soundSettings.on ? 'Töne ausschalten' : 'Töne einschalten'" :data-tip="soundSettings.on ? 'Töne an' : 'Töne aus'" @click="toggle">
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor" />
      <template v-if="soundSettings.on"><path d="M16 9a4 4 0 0 1 0 6" /><path d="M18.5 6.5a8 8 0 0 1 0 11" /></template>
      <template v-else><path d="M17 9l5 6M22 9l-5 6" /></template>
    </svg>
  </button>
</template>

<style scoped>
.snd { background: none; border: 0; color: inherit; cursor: pointer; padding: 0.3rem; margin-left: auto; display: inline-flex; align-items: center; opacity: 0.85; }
.snd:hover, .snd:focus-visible { opacity: 1; }
.snd[aria-pressed='false'] { opacity: 0.5; }
</style>
