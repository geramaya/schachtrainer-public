import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { injectCsp, tauriCsp, webCsp } from '../tools/lib/csp.ts'

const conf = readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8')

test('the web CSP is the Tauri CSP (one source), strict: no unsafe-inline, no unsafe-eval, only own origin, wasm allowed for Stockfish and ONNX Runtime', () => {
  const csp = tauriCsp(conf)
  assert.match(csp, /script-src 'self' 'wasm-unsafe-eval'/)
  assert.match(csp, /worker-src 'self'/)
  assert.match(csp, /connect-src 'self'/)
  assert.doesNotMatch(csp, /unsafe-inline|'unsafe-eval'|https?:|\*/)
})

test('web CSP = Tauri CSP plus exactly two relaxations the app needs: inline style attributes (chessground sets them on its shapes) and data: audio (the silent sound that unlocks audio)', () => {
  const csp = webCsp(conf)
  assert.match(csp, /style-src-attr 'unsafe-inline'/)
  assert.match(csp, /media-src 'self' data:/)
  assert.match(csp, /script-src 'self' 'wasm-unsafe-eval';/) // scripts stay strict
  assert.match(csp, /style-src 'self';/) // style elements stay strict
  assert.doesNotMatch(csp.replace("style-src-attr 'unsafe-inline'", ''), /unsafe-inline/)
  assert.equal(csp.split('; ').length, tauriCsp(conf).split('; ').length + 1)
})

test('injectCsp puts one CSP meta tag first in the head (a meta cannot carry frame-ancestors, so none is added)', () => {
  const out = injectCsp('<!doctype html><html><head>\n    <meta charset="UTF-8" />\n  </head><body></body></html>', "default-src 'self'")
  assert.match(out, /<head>\s*<meta http-equiv="Content-Security-Policy" content="default-src 'self'" \/>/)
  assert.equal(out.match(/Content-Security-Policy/g)?.length, 1)
  assert.doesNotMatch(out, /frame-ancestors/)
})
