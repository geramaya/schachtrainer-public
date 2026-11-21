<script setup lang="ts">
/** King for the side choice: white, black, or half and half for "Zufall". */
defineProps<{ mode: 'white' | 'black' | 'half' }>()
const KING = 'M12 3v4M10 5h4M6 21h12M7.5 21 6.5 12.5a5.5 5.5 0 0 1 11 0L16.5 21z'
</script>

<template>
  <svg class="king" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
    <defs><clipPath id="king-right"><rect x="12" y="0" width="12" height="24" /></clipPath></defs>
    <path :d="KING" :fill="mode === 'black' ? '#1c1c1c' : '#f2f2f2'" :stroke="mode === 'black' ? '#8d99ad' : '#10141b'" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" />
    <path v-if="mode === 'half'" :d="KING" fill="#1c1c1c" stroke="#8d99ad" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" clip-path="url(#king-right)" />
  </svg>
</template>
