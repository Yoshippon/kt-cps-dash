import type { Match } from '../data'

type PlayerMatch = Pick<Match, 'date' | 'player1' | 'player2'>

const getWeekKey = (date: string) => {
  const day = new Date(`${date}T00:00:00Z`)
  const mondayOffset = (day.getUTCDay() + 6) % 7
  day.setUTCDate(day.getUTCDate() - mondayOffset)
  return day.toISOString().slice(0, 10)
}

export const getConsecutiveGames = (matches: PlayerMatch[]) => {
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

export const sortPlayersByStreakAndRecency = (players: string[], matches: PlayerMatch[]) => {
  const consecutiveGames = getConsecutiveGames(matches)
  const latestGameByPlayer = new Map<string, string>()

  matches.forEach((match) => {
    for (const player of [match.player1, match.player2]) {
      if (!latestGameByPlayer.has(player) || match.date > latestGameByPlayer.get(player)!) {
        latestGameByPlayer.set(player, match.date)
      }
    }
  })

  return [...players].sort((firstPlayer, secondPlayer) => {
    const firstStreak = consecutiveGames.get(firstPlayer) ?? 0
    const secondStreak = consecutiveGames.get(secondPlayer) ?? 0
    const latestFirstGame = latestGameByPlayer.get(firstPlayer) ?? ''
    const latestSecondGame = latestGameByPlayer.get(secondPlayer) ?? ''
    return secondStreak - firstStreak
      || latestSecondGame.localeCompare(latestFirstGame)
      || firstPlayer.localeCompare(secondPlayer)
  })
}
