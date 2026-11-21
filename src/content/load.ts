import { BASE } from '../ui/assetBase.ts'
import type { ContentBundle } from './types.ts'
import { fetchBundle } from './fetch-bundle.ts'

/** Loads the content bundle served next to the app (the only network access besides the app itself). */
export async function loadBundle(): Promise<ContentBundle> {
  // DEV-only switch (?fixture=1): import.meta.env.DEV is false in production builds, so this branch is removed there.
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('fixture')) {
    return (await import('../../test/fixtures/lesson-bundle.json')).default as unknown as ContentBundle
  }
  return fetchBundle(fetch, BASE)
}
