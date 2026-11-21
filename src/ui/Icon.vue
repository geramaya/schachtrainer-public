<script setup lang="ts">
/** Small inline icons (no icon package). Stroke icons take the text colour; `play` is filled. */
export type IconName = 'undo' | 'hint' | 'target' | 'play' | 'take' | 'flip' | 'draw' | 'flag'
defineProps<{ name: IconName }>()
const PATHS: Record<IconName, string> = {
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  hint: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  play: 'M7 4l13 8-13 8z',
  take: 'M5 13l4 4L19 7',
  flip: 'M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4',
  draw: 'M5 9h14M5 15h14',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
}
</script>

<template>
  <svg class="ico" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" :fill="name === 'play' ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path :d="PATHS[name]" /></svg>
</template>

<style scoped>
.ico { flex: none; }
</style>
