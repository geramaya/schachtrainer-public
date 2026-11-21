import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { injectCsp, webCsp } from './tools/lib/csp.ts'

const csp = webCsp(readFileSync(new URL('./src-tauri/tauri.conf.json', import.meta.url), 'utf8'))

// <piece> is a chessground element (promotion dialog), not a Vue component.
// base: '/' by default (dev, preview, Tauri); VITE_BASE=/schachtrainer-play/ for GitHub Pages (subpath).
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  // Maia-2 (security gate M3/M4): the build without the inlined WASM glue; ort-wasm-simd-threaded.mjs/.wasm come from public/ort/ (npm run maia).
  resolve: { alias: { 'onnxruntime-web/wasm': fileURLToPath(new URL('./node_modules/onnxruntime-web/dist/ort.wasm.min.mjs', import.meta.url)) } },
  plugins: [
    vue({ template: { compilerOptions: { isCustomElement: (tag) => tag === 'piece' } } }),
    // CSP meta tag (M10) only in the build: the dev server injects inline styles and a websocket, which the strict CSP would block.
    { name: 'web-csp', apply: 'build', transformIndexHtml: (html) => injectCsp(html, csp) },
  ],
})
