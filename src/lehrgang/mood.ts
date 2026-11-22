import type { FigurId, Gefuehl } from '../teacher/avatar.ts'

/** Pity or anger at a wrong move, by the character of the teacher (Jonas and Aldo feel with the learner, Mira and Ferro are annoyed). */
const FEHLER: Record<FigurId, Gefuehl> = { mann: 'mitleid', frau: 'aergerlich', meister: 'mitleid', fuchs: 'aergerlich' }

/** Face of the teacher in a Lehrgang: a wrong move first, then the finished run (perfect = celebrating), then praise for a right move, else explaining. */
export function lehrgangGefuehl(figur: FigurId, s: { miss: boolean; solved: boolean; mistakes: number; lob: boolean }): Gefuehl {
  if (s.miss) return FEHLER[figur]
  if (s.solved) return s.mistakes === 0 ? 'begeistert' : 'freude'
  return s.lob ? 'freude' : 'neutral'
}
