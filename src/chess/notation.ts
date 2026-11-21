const GERMAN: Record<string, string> = { N: 'S', B: 'L', R: 'T', Q: 'D', K: 'K' }

/** English SAN to German SAN (N->S, B->L, R->T, Q->D); castling and pawn moves unchanged. */
export function toGermanSan(san: string): string {
  if (san.startsWith('O-O')) return san
  return san
    .replace(/^[NBRQK]/, (p) => GERMAN[p]!)
    .replace(/=([NBRQ])/, (_m, p: string) => `=${GERMAN[p]}`)
}

/** "1. e4 e5 2. Sf3"; startPly is the 0-based ply of the first move (odd = black, "1… "). */
export function formatLine(sans: string[], startPly = 0): string {
  const parts: string[] = []
  sans.forEach((san, i) => {
    const ply = startPly + i
    const number = Math.floor(ply / 2) + 1
    if (ply % 2 === 0) parts.push(`${number}.`)
    else if (i === 0) parts.push(`${number}…`)
    parts.push(toGermanSan(san))
  })
  return parts.join(' ')
}
