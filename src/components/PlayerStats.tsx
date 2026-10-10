import { useMemo, useState } from 'react'
import { MATCHES, TEAM_FACTIONS_BY_NAME } from '../data'
import { wilsonScore } from '../lib/wilsonScore'
import TeamSelect from './TeamSelect'

type StatLine = { name: string; games: number; wins: number; draws: number; losses: number; points: number }
type SortColumn = 'name' | 'games' | 'wins' | 'draws' | 'losses' | 'winRate' | 'wilsonScore'
type SortDirection = 'ascending' | 'descending'

const playerPlayedWithTeam = (match: typeof MATCHES[number], player: string, team: string) => (
  (match.player1 === player && match.teamOne === team) || (match.player2 === player && match.teamTwo === team)
)
const winRate = (stat: StatLine) => stat.games === 0 ? 0 : stat.points / stat.games * 100
const formatRate = (stat: StatLine) => `${winRate(stat).toFixed(0)}%`
const formatWilsonScore = (stat: StatLine) => `${(wilsonScore(stat.wins, stat.draws, stat.losses) * 100).toFixed(0)}%`

function PlayerStats({ isActive }: { isActive: boolean }) {
  const [playerFilter, setPlayerFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [dateFromFilter, setDateFromFilter] = useState('')
  const [dateToFilter, setDateToFilter] = useState('')
  const [ignoreHomebrew, setIgnoreHomebrew] = useState(false)
  const [sortColumn, setSortColumn] = useState<SortColumn>('games')
  const [sortDirection, setSortDirection] = useState<SortDirection>('descending')

  const eligibleMatches = useMemo(() => MATCHES.filter((match) => {
    if (ignoreHomebrew && match.isHomebrew) return false
    const includesPlayer = !playerFilter || match.player1 === playerFilter || match.player2 === playerFilter
    const includesTeam = !teamFilter || match.teamOne === teamFilter || match.teamTwo === teamFilter
    const matchesPlayerTeam = !playerFilter || !teamFilter || playerPlayedWithTeam(match, playerFilter, teamFilter)
    const isAfterStartDate = !dateFromFilter || match.date >= dateFromFilter
    const isBeforeEndDate = !dateToFilter || match.date <= dateToFilter
    return includesPlayer && includesTeam && matchesPlayerTeam && isAfterStartDate && isBeforeEndDate
  }), [dateFromFilter, dateToFilter, ignoreHomebrew, playerFilter, teamFilter])

  const playerStats = useMemo(() => {
    const stats = new Map<string, StatLine>()
    eligibleMatches.forEach((match) => {
      const sides = [
        { player: match.player1, won: true },
        { player: match.player2, won: false },
      ]
      sides.forEach(({ player, won }) => {
        const stat = stats.get(player) ?? { name: player, games: 0, wins: 0, draws: 0, losses: 0, points: 0 }
        stat.games += 1
        if (match.isTied) {
          stat.draws += 1
          stat.points += .5
        } else if (won) {
          stat.wins += 1
          stat.points += 1
        } else stat.losses += 1
        stats.set(player, stat)
      })
    })
    return [...stats.values()]
  }, [eligibleMatches])

  const sortedPlayerStats = useMemo(() => [...playerStats].sort((first, second) => {
    const comparison = sortColumn === 'name'
      ? first.name.localeCompare(second.name)
      : sortColumn === 'winRate'
        ? winRate(first) - winRate(second)
        : sortColumn === 'wilsonScore'
          ? wilsonScore(first.wins, first.draws, first.losses) - wilsonScore(second.wins, second.draws, second.losses)
          : first[sortColumn] - second[sortColumn]
    if (comparison !== 0) return sortDirection === 'ascending' ? comparison : -comparison
    return first.name.localeCompare(second.name)
  }), [playerStats, sortColumn, sortDirection])

  const players = useMemo(() => [...new Set(MATCHES
    .filter((match) => !teamFilter || match.teamOne === teamFilter || match.teamTwo === teamFilter)
    .flatMap((match) => {
      if (!teamFilter) return [match.player1, match.player2]
      if (match.teamOne === teamFilter && match.teamTwo === teamFilter) return [match.player1, match.player2]
      return match.teamOne === teamFilter ? [match.player1] : [match.player2]
    }))].sort(), [teamFilter])
  const teams = useMemo(() => [...new Set(MATCHES
    .filter((match) => !playerFilter || match.player1 === playerFilter || match.player2 === playerFilter)
    .flatMap((match) => playerFilter && match.player1 === playerFilter ? [match.teamOne] : playerFilter ? [match.teamTwo] : [match.teamOne, match.teamTwo]))].sort(), [playerFilter])
  const teamOptions = useMemo(() => teams.map((name) => ({ name, faction: TEAM_FACTIONS_BY_NAME.get(name) })), [teams])
  const selectedPlayerStat = playerStats.find((stat) => stat.name === playerFilter)

  const clearFilters = () => {
    setPlayerFilter('')
    setTeamFilter('')
    setDateFromFilter('')
    setDateToFilter('')
    setIgnoreHomebrew(false)
  }
  const changeSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((direction) => direction === 'ascending' ? 'descending' : 'ascending')
      return
    }
    setSortColumn(column)
    setSortDirection(column === 'name' ? 'ascending' : 'descending')
  }

  return (
    <div hidden={!isActive}>
      <section className="tab-summary" aria-label="Player statistics">
        <div className="stats" aria-label="Player statistics">
          <div><strong>{eligibleMatches.length}</strong><span>games analyzed</span></div>
          <div><strong>{playerStats.length}</strong><span>players</span></div>
          {selectedPlayerStat && <div><strong>{formatRate(selectedPlayerStat)}</strong><span>win rate</span></div>}
        </div>
      </section>
      <div className="community-filters">
        <label>Player<select value={playerFilter} onChange={(event) => { const player = event.target.value; setPlayerFilter(player); if (teamFilter && !MATCHES.some((match) => playerPlayedWithTeam(match, player, teamFilter))) setTeamFilter('') }}><option value="">All players</option>{players.map((player) => <option key={player} value={player}>{player}</option>)}</select></label>
        <label>Team<TeamSelect value={teamFilter} teams={teamOptions} emptyLabel="All teams" onChange={(team) => { setTeamFilter(team); if (playerFilter && !MATCHES.some((match) => playerPlayedWithTeam(match, playerFilter, team))) setPlayerFilter('') }} /></label>
        <label>From<input type="date" value={dateFromFilter} onChange={(event) => setDateFromFilter(event.target.value)} max={dateToFilter || undefined} /></label>
        <label>To<input type="date" value={dateToFilter} onChange={(event) => setDateToFilter(event.target.value)} min={dateFromFilter || undefined} /></label>
        <label className="community-checkbox"><input type="checkbox" checked={ignoreHomebrew} onChange={(event) => setIgnoreHomebrew(event.target.checked)} />Ignore homebrew games</label>
        {(playerFilter || teamFilter || dateFromFilter || dateToFilter || ignoreHomebrew) && <button type="button" className="clear-filters" onClick={clearFilters}>Clear filters</button>}
      </div>
      <section className="community-section" aria-labelledby="player-rates-heading">
        <header className="community-section-heading"><h3 id="player-rates-heading">Player win rates</h3></header>
        <p className="community-section-note">Mirror matches included. Draws count as 0.5 wins</p>
        <StatsTable stats={sortedPlayerStats} sortColumn={sortColumn} sortDirection={sortDirection} onSort={changeSort} />
      </section>
    </div>
  )
}

function StatsTable({ stats, sortColumn, sortDirection, onSort }: { stats: StatLine[]; sortColumn: SortColumn; sortDirection: SortDirection; onSort: (column: SortColumn) => void }) {
  const sortableHeader = (column: SortColumn, label: string) => <th scope="col" aria-sort={sortColumn === column ? sortDirection : 'none'}><button type="button" className="community-sort-button" onClick={() => onSort(column)}>{label}<span aria-hidden="true">{sortColumn === column ? sortDirection === 'ascending' ? ' ▲' : ' ▼' : ''}</span></button></th>

  return stats.length > 0 ? <div className="community-table-wrap"><table className="community-table"><thead><tr>{sortableHeader('name', 'Player')}{sortableHeader('games', 'Games')}{sortableHeader('wins', 'W')}{sortableHeader('draws', 'D')}{sortableHeader('losses', 'L')}{sortableHeader('winRate', 'Win rate')}{sortableHeader('wilsonScore', 'Wilson')}</tr></thead><tbody>{stats.map((stat) => <tr key={stat.name}><th scope="row">{stat.name}</th><td>{stat.games}</td><td>{stat.wins}</td><td>{stat.draws}</td><td>{stat.losses}</td><td className="rate">{formatRate(stat)}</td><td className="rate">{formatWilsonScore(stat)}</td></tr>)}</tbody></table></div> : <div className="empty-state"><strong>No matches found</strong><span>Try changing or clearing your filters.</span></div>
}

export default PlayerStats
