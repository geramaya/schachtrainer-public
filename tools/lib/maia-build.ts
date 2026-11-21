import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'

/** Build helpers for Maia-2 (security gate M3, M5): everything that enters public/ is checked against a pinned SHA-256 first, a mismatch aborts. */
export const sha256Hex = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex')

function check(name: string, bytes: Uint8Array, sha256: string): void {
  const got = sha256Hex(bytes)
  if (got !== sha256) throw new Error(`${name}: SHA-256 ${got} is not the pinned ${sha256}`)
}

/**
 * The pinned file: from the cache if it has the pinned hash, else downloaded (https only, a redirect is an error) and checked. The cache
 * file is written only after the check (via a temporary name), so a failed run leaves no unchecked file behind.
 */
export async function fetchPinned(o: { url: string; sha256: string; cacheFile: URL; fetchFn?: typeof fetch }): Promise<Uint8Array> {
  if (new URL(o.url).protocol !== 'https:') throw new Error(`${o.url}: only https is allowed`)
  if (existsSync(o.cacheFile)) {
    const cached = new Uint8Array(readFileSync(o.cacheFile))
    if (sha256Hex(cached) === o.sha256) return cached
  }
  const res = await (o.fetchFn ?? fetch)(o.url, { redirect: 'error' })
  if (!res.ok) throw new Error(`${o.url}: HTTP ${res.status}`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  check(o.url, bytes, o.sha256)
  const tmp = new URL(`${o.cacheFile.href}.part`)
  mkdirSync(new URL('.', o.cacheFile), { recursive: true })
  writeFileSync(tmp, bytes)
  renameSync(tmp, o.cacheFile)
  return bytes
}

/** Copies the listed files (and only these) from `src` to `dest`; all hashes are checked before the first copy. */
export function copyPinned(src: URL, dest: URL, files: Array<{ name: string; sha256: string }>): void {
  for (const f of files) check(f.name, new Uint8Array(readFileSync(new URL(f.name, src))), f.sha256)
  mkdirSync(dest, { recursive: true })
  for (const f of files) copyFileSync(new URL(f.name, src), new URL(f.name, dest))
}
