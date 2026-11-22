/** Share of games (0..1) as a phrase for the learner: "etwa 4 von 10"; rarer lines get a coarser, still honest wording. */
export function frequencyText(p: number): string {
  const x = Math.round(p * 10)
  if (x >= 10) return 'in fast jeder Partie'
  if (x >= 1) return `etwa ${x} von 10`
  if (p < 0.01) return 'weniger als 1 von 100'
  return `etwa 1 von ${Math.round(1 / p / 10) * 10}`
}
