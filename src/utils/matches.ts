import type { Match } from '../data'

const getWeekKey = (date: string) => {
  const day = new Date(`${date}T00:00:00Z`)
  const mondayOffset = (day.getUTCDay() + 6) % 7
  day.setUTCDate(day.getUTCDate() - mondayOffset)
  return day.toISOString().slice(0, 10)
}

export const getConsecutiveGames = (matches: Match[]) => {
  const weeks = [...new Set(matches.map((match) => getWeekKey(match.date)))].sort().reverse()
  const players = [...new Set(matches.flatMap((match) => [match.player1, match.player2]))]

  return new Map(players.map((player) => {
    const playerWeeks = new Set(matches
      .filter((match) => match.player1 === player || match.player2 === player)
      .map((match) => getWeekKey(match.date)))
    let streak = 0
    for (const week of weeks) {
      if (!playerWeeks.has(week)) break
      streak += 1
    }
    return [player, streak]
  }))
}
