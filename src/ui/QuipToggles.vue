<script setup lang="ts">
/** The two quip switches: sarcastic sayings (off by default) and reading them aloud (only offered when audio exists). */
defineProps<{ quips: boolean; speak: boolean; audio: boolean }>()
const emit = defineEmits<{ quips: [boolean]; speak: [boolean] }>()
</script>

<template>
  <div class="toggles">
    <label><input type="checkbox" :checked="quips" @change="emit('quips', ($event.target as HTMLInputElement).checked)" /> Sprüche</label>
    <label v-if="audio" :class="{ off: !quips }"><input type="checkbox" :checked="speak" :disabled="!quips" @change="emit('speak', ($event.target as HTMLInputElement).checked)" /> Sprüche vorlesen</label>
  </div>
</template>

<style scoped>
.toggles { display: flex; flex-wrap: wrap; gap: 0.3rem 1rem; margin: 0.3rem 0; font-size: var(--fs-small, 0.85rem); }
.toggles label { display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; }
.toggles label.off { color: var(--muted); }
</style>
