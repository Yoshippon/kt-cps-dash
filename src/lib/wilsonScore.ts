export function wilsonScore(wins: number, draws: number, losses: number, z = 1.96): number {
  const n = wins + draws + losses
  if (n === 0) return 0

  const p = (wins + .5 * draws) / n
  const z2 = z * z
  const numerator = p + z2 / (2 * n) - z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))
  const denominator = 1 + z2 / n
  return numerator / denominator
}
