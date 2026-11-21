/**
 * Loads the Maia-2 model from our own origin and checks it (security gate Maia-2, M5/M6): the SHA-256 is formed over exactly the bytes that
 * are later handed to ONNX Runtime (never a URL, so check and use cannot differ). Without `crypto.subtle` nothing is loaded, there is no
 * way around it. A browser cache may hold the file; the check runs on every load anyway.
 */
export const MODEL_SHA256 = '027ddb8c1a8b7235b6e51827cffe325f9cb95fd4523dce65a131547c034ccfc9'
export const MODEL_BYTES = 93_246_338

export type LoadProgress = { phase: 'download'; loaded: number; total: number } | { phase: 'verify' }

/** The loaded file is not the pinned model. */
export class ModelIntegrityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ModelIntegrityError'
  }
}

export interface LoadOptions {
  url: string
  onProgress?: (p: LoadProgress) => void
  /** injectable for tests */
  fetchFn?: typeof fetch
  /** injectable for tests; the default is `globalThis.crypto?.subtle` */
  subtle?: SubtleCrypto | undefined
  expectedSha256?: string
  maxBytes?: number
}

const hex = (buf: ArrayBuffer): string => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('')

export async function loadVerified(o: LoadOptions): Promise<Uint8Array> {
  const subtle = 'subtle' in o ? o.subtle : globalThis.crypto?.subtle
  if (!subtle) throw new ModelIntegrityError('crypto.subtle is not available here, so the model cannot be checked and is not loaded.')
  const maxBytes = o.maxBytes ?? MODEL_BYTES
  const res = await (o.fetchFn ?? fetch)(o.url, { cache: 'force-cache', credentials: 'omit' })
  if (!res.ok || !res.body) throw new Error(`Model download failed: HTTP ${res.status}`)
  const length = Number(res.headers.get('content-length'))
  const total = Number.isFinite(length) && length > 0 && !res.headers.has('content-encoding') ? length : MODEL_BYTES

  const chunks: Uint8Array[] = []
  let loaded = 0
  const reader = res.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    loaded += value.length
    if (loaded > maxBytes) { void reader.cancel(); throw new Error('Model download is larger than the pinned model.') }
    chunks.push(value)
    o.onProgress?.({ phase: 'download', loaded, total })
  }
  const bytes = new Uint8Array(loaded)
  let at = 0
  for (const c of chunks) { bytes.set(c, at); at += c.length }

  o.onProgress?.({ phase: 'verify' })
  const got = hex(await subtle.digest('SHA-256', bytes))
  if (got !== (o.expectedSha256 ?? MODEL_SHA256)) throw new ModelIntegrityError(`Model checksum mismatch (${got.slice(0, 8)}…): the file is not the pinned Maia-2 model.`)
  return bytes
}
