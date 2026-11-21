/** Row selection of the game list, as pure functions on sets of game ids (`visible` is the filtered list in display order). */

export function toggle(sel: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(sel)
  if (!next.delete(id)) next.add(id)
  return next
}

/** Shift-click: adds every row from the anchor to the target (either direction); without a visible anchor only the target. */
export function rangeSelect(sel: ReadonlySet<string>, visible: readonly string[], anchor: string | null, target: string): Set<string> {
  const next = new Set(sel)
  const a = anchor === null ? -1 : visible.indexOf(anchor)
  const b = visible.indexOf(target)
  if (b < 0) return next
  const [from, to] = a < 0 ? [b, b] : [Math.min(a, b), Math.max(a, b)]
  for (const id of visible.slice(from, to + 1)) next.add(id)
  return next
}

export type HeadState = 'none' | 'some' | 'all'

/** State of the head box: only visible rows count. */
export function headState(visible: readonly string[], sel: ReadonlySet<string>): HeadState {
  const n = visible.filter((id) => sel.has(id)).length
  return n === 0 ? 'none' : n === visible.length ? 'all' : 'some'
}

/** Head box: selects all visible rows (keeping other selected ones) or clears just those. */
export function setAll(sel: ReadonlySet<string>, visible: readonly string[], on: boolean): Set<string> {
  const next = new Set(sel)
  for (const id of visible) { if (on) next.add(id); else next.delete(id) }
  return next
}

/** After a filter change the selection stays only for rows that are still shown. */
export function keepVisible(sel: ReadonlySet<string>, visible: readonly string[]): Set<string> {
  const v = new Set(visible)
  return new Set([...sel].filter((id) => v.has(id)))
}
