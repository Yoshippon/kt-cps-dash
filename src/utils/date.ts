export const formatDate = (date: string) => new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`))

export const getElapsedDays = (date: string) => {
  const matchDate = new Date(`${date}T12:00:00`)
  const today = new Date()
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const matchUtc = Date.UTC(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate())
  return Math.max(0, Math.floor((todayUtc - matchUtc) / 86400000))
}

export const getElapsedTime = (date: string) => {
  const days = getElapsedDays(date)

  if (days === 0) return 'Today'
  if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'}`
  const weeks = Math.floor(days / 7)
  return `${weeks} ${weeks === 1 ? 'week' : 'weeks'}`
}

export const getMatchupStatus = (date: string) => {
  const days = getElapsedDays(date)
  if (days < 7) return 'fresh'
  if (days < 28) return 'recent'
  if (days < 90) return 'average'
  return 'old'
}

export const getTimeUntilNextFriday19 = () => {
  const now = new Date()
  const nextFriday = new Date(now)
  const dayOfWeek = now.getDay()
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7
  nextFriday.setDate(now.getDate() + (daysUntilFriday === 0 && now.getHours() >= 19 ? 7 : daysUntilFriday))
  nextFriday.setHours(19, 0, 0, 0)
  if (nextFriday <= now) nextFriday.setDate(nextFriday.getDate() + 7)
  const diff = nextFriday.getTime() - now.getTime()
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)
  return { days, hours, minutes, seconds, totalMs: diff }
}

export const formatTimeUntil = (time: ReturnType<typeof getTimeUntilNextFriday19>) => {
  const { days, hours, minutes, seconds } = time
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}
