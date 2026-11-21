/** Joins the app base (Vite `base`, e.g. "/" or "/schachtrainer-play/") and a path of a file in public/. */
export function assetUrl(path: string, base: string): string {
  return `${base.endsWith('/') ? base : `${base}/`}${path.replace(/^\/+/, '')}`
}
