export interface Mods { alt: boolean; ctrl: boolean; meta: boolean; shift: boolean }

/** Whether the board navigation keys (←/→/Home/End/space) should act for this key event target. */
export function shouldHandleKey(key: string, tag: string, editable: boolean, mods: Mods): boolean {
  if (mods.alt || mods.ctrl || mods.meta || mods.shift) return false
  if (editable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return false
  if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Home' || key === 'End') return true
  return key === ' ' && tag !== 'BUTTON' // space activates a focused button
}

/** H asks the teacher for a hint (not in text fields, not with Ctrl/Alt/Meta; Shift is fine, capital H). */
export function isHintKey(key: string, tag: string, editable: boolean, mods: Mods): boolean {
  if (mods.alt || mods.ctrl || mods.meta || editable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return false
  return key.toLowerCase() === 'h'
}

/** Ply a navigation key leads to (←/→ one step, space = forward, Home = first, End = last), or null for other keys. */
export function navTarget(key: string, cur: number, last: number): number | null {
  const clamp = (n: number) => Math.max(0, Math.min(last, n))
  if (key === 'ArrowLeft') return clamp(cur - 1)
  if (key === 'ArrowRight' || key === ' ') return clamp(cur + 1)
  if (key === 'Home') return 0
  if (key === 'End') return last
  return null
}

/** F flips the board (not in text fields, not with Ctrl/Alt/Meta). */
export function isFlipKey(key: string, tag: string, editable: boolean, mods: Mods): boolean {
  if (mods.alt || mods.ctrl || mods.meta || editable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return false
  return key.toLowerCase() === 'f'
}
