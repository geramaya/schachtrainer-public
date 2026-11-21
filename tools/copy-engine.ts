import { copyFileSync, mkdirSync } from 'node:fs'

const SRC = new URL('../node_modules/stockfish/bin/', import.meta.url)
const DEST = new URL('../public/engine/', import.meta.url)
const FILES: Array<[string, string]> = [
  ['stockfish-19-lite-single.js', 'stockfish-lite-single.js'],
  ['stockfish-19-lite-single.wasm', 'stockfish-lite-single.wasm'],
]

mkdirSync(DEST, { recursive: true })
for (const [from, to] of FILES) {
  copyFileSync(new URL(from, SRC), new URL(to, DEST))
  console.log(`engine: ${from} -> public/engine/${to}`)
}
