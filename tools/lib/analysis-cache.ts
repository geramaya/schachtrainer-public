import { existsSync, readFileSync } from 'node:fs'
import type { Analysis, Engine } from '../../src/engine/service.ts'
import { writeAtomic } from './sources.ts'

/** Engine analyses are deterministic per (fen, depth, multipv) in the build, so they are kept on disk between runs. */
export function cachedEngine(inner: Engine, file: string): Engine & { flush(): void } {
  const store: Record<string, Analysis> = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, Analysis>) : {}
  return {
    ...inner,
    async analyse(fen, opts) {
      const key = `${fen}|${opts.depth}|${opts.multipv ?? 1}`
      return (store[key] ??= await inner.analyse(fen, opts))
    },
    dispose: () => inner.dispose(),
    flush: () => writeAtomic(file, JSON.stringify(store)),
  }
}
