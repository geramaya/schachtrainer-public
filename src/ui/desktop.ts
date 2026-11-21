// Detects the Tauri desktop shell. There, external URLs are shown as text
// (the webview must never navigate away or open windows; see docs/.../tauri-security-gate.md A8).
export function isDesktopApp(
  loc: { protocol: string; hostname: string },
  win: object = {},
): boolean {
  if ('__TAURI_INTERNALS__' in win) return true
  return loc.protocol === 'tauri:' || (loc.protocol === 'http:' && loc.hostname === 'tauri.localhost')
}

export const IN_DESKTOP_APP = typeof window !== 'undefined' && isDesktopApp(window.location, window)
