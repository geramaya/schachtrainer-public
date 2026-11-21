import { assetUrl } from './asset-url.ts'

/** Base path of the app (Vite), for files in public/. Falls back to '/' where Vite is absent (node tests). */
export const BASE: string = import.meta.env?.BASE_URL ?? '/'

/** URL of a file in public/ below the app base. */
export const publicUrl = (path: string): string => assetUrl(path, BASE)
