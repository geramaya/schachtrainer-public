/** New scrollTop that keeps `el` (top relative to the scrolled content) inside a box, moving as little as possible. */
export function scrollTopToShow(box: { scrollTop: number; height: number }, el: { top: number; height: number }): number {
  if (el.top < box.scrollTop) return el.top
  const overshoot = el.top + el.height - (box.scrollTop + box.height)
  return overshoot > 0 ? box.scrollTop + overshoot : box.scrollTop
}
