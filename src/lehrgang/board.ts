import type { Side } from '../content/types.ts'
import { startOrientation } from '../ui/orientation.ts'

/** Key under which the flip choice of a Lehrgang is remembered (shared by the system page and its practice pages). */
export const flipKey = (id: string): string => `lehrgang:${id}`

/** The board starts at the side of the Lehrgang and turns only when the user flips it; never from the position shown. */
export const lehrgangOrientation = (saved: Side | null, lgSide: Side): Side => saved ?? startOrientation(lgSide)
