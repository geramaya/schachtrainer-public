export type SplitSide = 'left' | 'right'
export interface StoredWidths { left: number | null; right: number | null }

export const LIMITS = { left: { min: 260, max: 640 }, right: { min: 240, max: 560 } } as const
/** Default = viewport share inside a range; chosen so the board is height-limited (not width-limited) at 1440x900. */
const DEFAULTS = { left: { min: 300, share: 0.215, max: 440 }, right: { min: 290, share: 0.2, max: 420 } } as const
const MIN_BOARD = 380 // middle column incl. eval bar
const KEY_STEP = 16
/** Page padding (2 x 12) + the two split handles (2 x 20) around the three areas. */
const FIXED = 2 * 12 + 2 * 20

const plainDefault = (side: SplitSide, vw: number): number => {
  const d = DEFAULTS[side]
  return Math.round(Math.min(d.max, Math.max(d.min, vw * d.share)))
}
/** Height the board loses to header, stage bar, bottom padding, controls and their gap (matches the CSS of the layout). */
const HEIGHT_RESERVE = 48 + 40 + 12 + 44 + 8
const EVAL_BAR = 22

/** With the viewport height known the left column also takes what a height-limited board leaves over (coach text is the reading column). */
export function defaultWidth(side: SplitSide, vw: number, vh?: number): number {
  const base = plainDefault(side, vw)
  if (side === 'right' || vh === undefined) return base
  const leftover = vw - FIXED - plainDefault('right', vw) - (vh - HEIGHT_RESERVE + EVAL_BAR)
  return Math.round(Math.min(LIMITS.left.max, Math.max(base, leftover)))
}

/** Width the middle column (eval bar and board) gets for given side widths. */
export const boardAreaWidth = (vw: number, left: number, right: number): number => vw - FIXED - left - right

/** Keeps a side inside its own range and leaves the board its minimum width given the other side. */
export function clampWidth(side: SplitSide, want: number, other: number, vw: number): number {
  const l = LIMITS[side]
  const max = Math.min(l.max, vw - FIXED - other - MIN_BOARD)
  return Math.max(l.min, Math.min(max, want))
}

export function resolveWidths(stored: StoredWidths, vw: number, vh?: number): { left: number; right: number } {
  const right0 = stored.right ?? defaultWidth('right', vw)
  const left = clampWidth('left', stored.left ?? defaultWidth('left', vw, vh), right0, vw)
  return { left, right: clampWidth('right', right0, left, vw) }
}

/** Arrow keys move the handle; the sign follows the direction of the board side. */
export function keyboardWidth(side: SplitSide, current: number, key: string): number | null {
  if (key !== 'ArrowLeft' && key !== 'ArrowRight') return null
  const toRight = key === 'ArrowRight'
  return current + (toRight === (side === 'left') ? KEY_STEP : -KEY_STEP)
}

export function parseStored(raw: string | null): StoredWidths {
  const none: StoredWidths = { left: null, right: null }
  if (!raw) return none
  try {
    const o = JSON.parse(raw) as Record<string, unknown>
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
    return { left: num(o.left), right: num(o.right) }
  } catch { return none }
}
