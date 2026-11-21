/** Card id = opening id and position key: the same position in two openings is two cards (they may want different moves). */
export const cardKey = (openingId: string, key: string): string => `${openingId}:${key}`
export const cardId = (c: { openingId: string; key: string }): string => cardKey(c.openingId, c.key)
