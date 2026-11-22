<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { loadAudioManifest } from '../audio/manifest.ts'
import { lehrgangAudioFile } from '../audio/lehrgang-audio.ts'
import { playAudioFile } from '../audio/play-quip.ts'

const props = defineProps<{ text: string }>()
const has = ref(false)
onMounted(() => void loadAudioManifest().then((m) => { has.value = lehrgangAudioFile(m, props.text) !== null }))
async function play() {
  const file = lehrgangAudioFile(await loadAudioManifest(), props.text)
  if (file) await playAudioFile(file)
}
</script>

<template>
  <button v-if="has" type="button" class="satzaudio" aria-label="Vorlesen" title="Vorlesen" @click="play">🔊</button>
</template>

<style scoped>
.satzaudio { padding: 2px 8px; margin-left: .4rem; }
</style>
