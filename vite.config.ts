import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// <piece> is a chessground element (promotion dialog), not a Vue component.
// base: '/' by default (dev, preview, Tauri); VITE_BASE=/schachtrainer-play/ for GitHub Pages (subpath).
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [vue({ template: { compilerOptions: { isCustomElement: (tag) => tag === 'piece' } } })],
})
