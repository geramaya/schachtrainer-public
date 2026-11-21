/**
 * Content Security Policy of the web version (security gate Maia-2, M10): the one of the desktop app (src-tauri/tauri.conf.json), so both
 * builds run under the same rules. A meta tag cannot carry frame-ancestors (the Tauri CSP has none).
 */
export const tauriCsp = (json: string): string => {
  const csp = (JSON.parse(json) as { app: { security: { csp: string } } }).app.security.csp
  if (!csp) throw new Error('tauri.conf.json has no CSP')
  return csp
}

/** The CSP meta tag as the first element of <head> (it only protects what comes after it). */
export const injectCsp = (html: string, csp: string): string =>
  html.replace(/<head>/, `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp.replace(/"/g, '&quot;')}" />`)

/**
 * The CSP of the web build: the Tauri CSP plus two relaxations that were measured in Chromium (violation events) as needed by existing features:
 * `style-src-attr 'unsafe-inline'` (chessground writes style attributes on its SVG shapes with setAttribute) and `data:` in media-src (the silent
 * WAV that unlocks audio on the first click). Scripts and style elements stay strict.
 */
export const webCsp = (json: string): string =>
  tauriCsp(json).replace("media-src 'self'", "media-src 'self' data:").replace("style-src 'self';", "style-src 'self'; style-src-attr 'unsafe-inline';")
