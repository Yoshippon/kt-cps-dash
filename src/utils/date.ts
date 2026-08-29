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
