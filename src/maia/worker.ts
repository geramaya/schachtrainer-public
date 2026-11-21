/// <reference lib="webworker" />
/**
 * Web worker of Maia-2 (security gate Maia-2, M4/M6). Only the WASM build of ONNX Runtime Web (`onnxruntime-web/wasm`, vite.config.ts maps it to
 * ort.wasm.min.mjs), whose runtime files come from our own origin; one thread, no proxy worker. Nothing here is configurable from the URL,
 * localStorage or settings. The model is fetched, checked (SHA-256 over the loaded bytes) and only then handed to ORT as bytes.
 */
import * as ort from 'onnxruntime-web/wasm'
import { loadVerified } from './load.ts'
import type { FromWorker, ToWorker } from './protocol.ts'

const BASE: string = import.meta.env?.BASE_URL ?? '/'
ort.env.wasm.wasmPaths = new URL(`${BASE}ort/`, self.location.href).href
ort.env.wasm.numThreads = 1
ort.env.wasm.proxy = false

const post = (m: FromWorker, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(m, transfer)
let session: ort.InferenceSession | null = null

async function load(url: string): Promise<void> {
  const bytes = await loadVerified({ url: new URL(url, self.location.href).href, onProgress: (p) => post(p.phase === 'download' ? { type: 'progress', ...p } : { type: 'progress', phase: 'verify' }) })
  session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] })
}

async function run(m: Extract<ToWorker, { type: 'run' }>): Promise<Float32Array> {
  if (!session) throw new Error('model not loaded')
  const out = await session.run({
    boards: new ort.Tensor('float32', m.boards, [1, 18, 8, 8]),
    elo_self: new ort.Tensor('int64', BigInt64Array.from([BigInt(m.eloSelf)]), [1]),
    elo_oppo: new ort.Tensor('int64', BigInt64Array.from([BigInt(m.eloOppo)]), [1]),
  })
  return new Float32Array(out.logits_maia!.data as Float32Array)
}

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const m = e.data
  if (m.type === 'load') {
    load(m.url).then(() => post({ type: 'ready' }), (err) => post({ type: 'loadError', message: String((err as Error)?.message ?? err) }))
  } else {
    run(m).then((logits) => post({ type: 'result', id: m.id, logits }, [logits.buffer]), (err) => post({ type: 'runError', id: m.id, message: String((err as Error)?.message ?? err) }))
  }
}
