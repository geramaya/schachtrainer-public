import { copyPinned, fetchPinned } from './lib/maia-build.ts'
import { mkdirSync, writeFileSync } from 'node:fs'

/**
 * `npm run maia`: puts the Maia-2 model and the ONNX Runtime WebAssembly files into public/ (both gitignored, never in the repository).
 * Pins from the security gate Maia-2 (conditions M3 and M5). Any deviation aborts the build.
 */
const MODEL_URL = 'https://raw.githubusercontent.com/CSSLab/maia-platform-frontend/c2afeeaa96c7664dc9bb81954960b75ede7e4c20/public/maia2/maia_rapid.onnx'
const MODEL_SHA256 = '027ddb8c1a8b7235b6e51827cffe325f9cb95fd4523dce65a131547c034ccfc9'
const ORT_FILES = [
  { name: 'ort-wasm-simd-threaded.mjs', sha256: '30ed0b5cd1182ede931fea448afb567d4dc705ec957af09f108a2be5f770dac3' },
  { name: 'ort-wasm-simd-threaded.wasm', sha256: '4b884c203b0fa48d057be3332c65513ff85aa3c5bddd6946acc0fab7ecda001d' },
]

const root = new URL('../', import.meta.url)
const bytes = await fetchPinned({ url: MODEL_URL, sha256: MODEL_SHA256, cacheFile: new URL('tools/.cache/maia_rapid.onnx', root) })
mkdirSync(new URL('public/maia2/', root), { recursive: true })
writeFileSync(new URL('public/maia2/maia_rapid.onnx', root), bytes)
console.log(`maia: maia_rapid.onnx (${bytes.length} bytes, SHA-256 ok) -> public/maia2/`)
copyPinned(new URL('node_modules/onnxruntime-web/dist/', root), new URL('public/ort/', root), ORT_FILES)
for (const f of ORT_FILES) console.log(`maia: ${f.name} (SHA-256 ok) -> public/ort/`)
