<script setup lang="ts">
/** Small inline icons (no icon package). Stroke icons take the text colour; `play` is filled. */
export type IconName = 'undo' | 'hint' | 'target' | 'play' | 'take' | 'flip' | 'draw' | 'flag' | 'teacher' | 'free' | 'bullet' | 'blitz' | 'rapid' | 'classic' | 'custom'
defineProps<{ name: IconName; size?: number }>()
const PATHS: Record<IconName, string> = {
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  hint: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  play: 'M7 4l13 8-13 8z',
  take: 'M5 13l4 4L19 7',
  flip: 'M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4',
  draw: 'M5 9h14M5 15h14',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  teacher: 'M2 9l10-5 10 5-10 5zM6 11v5c3 2.5 9 2.5 12 0v-5',
  free: 'M12 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM8 21h8M9 21c0-4 1-5 3-6 2 1 3 2 3 6',
  bullet: 'M3 9h9c4 0 7 1.5 8 3-1 1.5-4 3-8 3H3z',
  blitz: 'M13 2 4 14h7l-1 8 9-12h-7z',
  rapid: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 1.5M9 2h6',
  classic: 'M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9',
  custom: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
}
</script>

<template>
  <svg class="ico" viewBox="0 0 24 24" :width="size ?? 18" :height="size ?? 18" aria-hidden="true" focusable="false" :fill="name === 'play' ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path :d="PATHS[name]" /></svg>
</template>

<style scoped>
.ico { flex: none; }
</style>
