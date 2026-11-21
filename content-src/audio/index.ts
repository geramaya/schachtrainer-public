import { openingTexts } from './openings.ts'
import { variantTexts } from './variants.ts'
import { openingTextsOpen } from './openings-open.ts'
import { variantTextsOpen } from './variants-open.ts'
import { openingTextsD4 } from './openings-d4.ts'
import { variantTextsD4 } from './variants-d4.ts'
import type { AudioText } from './types.ts'

export type { AudioText }
export const audioTexts: AudioText[] = [...openingTexts, ...variantTexts, ...openingTextsOpen, ...variantTextsOpen, ...openingTextsD4, ...variantTextsD4]
