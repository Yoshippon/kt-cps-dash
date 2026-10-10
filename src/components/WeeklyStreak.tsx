import { useEffect, useState } from 'react'
import { fetchMatches, type MatchRecord } from '../services/matches'

type WeeklyStreak = {
  weeks: number
  lastFridayWithoutMatch: string
}

const toDateKey = (date: Date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-')

const formatDate = (date: string) => {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

function getWeeklyStreak(matches: Pick<MatchRecord, 'date'>[], now = new Date()): WeeklyStreak {
  const fridaysWithMatches = new Set(matches
    .filter((match) => new Date(`${match.date}T12:00:00`).getDay() === 5)
    .map((match) => match.date))
  const friday = new Date(now)
  friday.setHours(12, 0, 0, 0)
  friday.setDate(friday.getDate() - ((friday.getDay() - 5 + 7) % 7))

  let weeks = 0
  while (fridaysWithMatches.has(toDateKey(friday))) {
    weeks += 1
    friday.setDate(friday.getDate() - 7)
  }

  return { weeks, lastFridayWithoutMatch: toDateKey(friday) }
}

function WeeklyStreak() {
  const [streak, setStreak] = useState<WeeklyStreak | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchMatches()
      .then((matches) => setStreak(getWeeklyStreak(matches)))
      .catch(() => setError('Unable to load weekly streak.'))
  }, [])

  if (error) return <span className="weekly-streak weekly-streak-error" role="status">{error}</span>
  if (!streak) return null

  const weekLabel = streak.weeks === 1 ? 'week' : 'weeks'
  return (
    <span
      className="weekly-streak"
      title={`last Friday without a match: ${formatDate(streak.lastFridayWithoutMatch)}`}
    >
      <span className="streak-fire" aria-hidden="true">🔥</span> {streak.weeks} {weekLabel} streak
    </span>
  )
}

export default WeeklyStreak
