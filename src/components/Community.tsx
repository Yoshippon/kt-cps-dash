import { useMemo, useState } from 'react'
import { MATCHES } from '../data'

type StatLine = { name: string; games: number; wins: number; draws: number; losses: number; points: number }
type CommunityView = 'table' | 'chart'

const isMirrorMatch = (match: typeof MATCHES[number]) => match.teamOne === match.teamTwo
const playerPlayedWithTeam = (match: typeof MATCHES[number], player: string, team: string) => (
  (match.player1 === player && match.teamOne === team) || (match.player2 === player && match.teamTwo === team)
)
const winRate = (stat: StatLine) => stat.games === 0 ? 0 : stat.points / stat.games * 100
const formatRate = (stat: StatLine) => `${winRate(stat).toFixed(0)}%`

function Community({ isActive }: { isActive: boolean }) {
  const [playerFilter, setPlayerFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [view, setView] = useState<CommunityView>('table')
  const eligibleMatches = useMemo(() => MATCHES.filter((match) => {
    if (isMirrorMatch(match)) return false
    const includesPlayer = !playerFilter || match.player1 === playerFilter || match.player2 === playerFilter
    const includesTeam = !teamFilter || match.teamOne === teamFilter || match.teamTwo === teamFilter
    const matchesPlayerTeam = !playerFilter || !teamFilter || playerPlayedWithTeam(match, playerFilter, teamFilter)
    return includesPlayer && includesTeam && matchesPlayerTeam
  }), [playerFilter, teamFilter])
  const teamStats = useMemo(() => {
    const stats = new Map<string, StatLine>()
    eligibleMatches.forEach((match) => {
      const sides = teamFilter
        ? [{ team: teamFilter, won: match.teamOne === teamFilter }]
        : playerFilter
        ? match.player1 === playerFilter
          ? [{ team: match.teamOne, won: true }]
          : [{ team: match.teamTwo, won: false }]
        : [{ team: match.teamOne, won: true }, { team: match.teamTwo, won: false }]
      sides.forEach(({ team, won }) => {
        const stat = stats.get(team) ?? { name: team, games: 0, wins: 0, draws: 0, losses: 0, points: 0 }
        stat.games += 1
        if (match.isTied) {
          stat.draws += 1
          stat.points += .5
        } else if (won) {
          stat.wins += 1
          stat.points += 1
        } else stat.losses += 1
        stats.set(team, stat)
      })
    })
    return [...stats.values()].sort((first, second) => winRate(second) - winRate(first) || second.games - first.games)
  }, [eligibleMatches, playerFilter, teamFilter])
  const players = useMemo(() => [...new Set(MATCHES
    .filter((match) => !isMirrorMatch(match) && (!teamFilter || match.teamOne === teamFilter || match.teamTwo === teamFilter))
    .flatMap((match) => teamFilter && match.teamOne === teamFilter ? [match.player1] : teamFilter ? [match.player2] : [match.player1, match.player2]))].sort(), [teamFilter])
  const teams = useMemo(() => [...new Set(MATCHES
    .filter((match) => !isMirrorMatch(match) && (!playerFilter || match.player1 === playerFilter || match.player2 === playerFilter))
    .flatMap((match) => playerFilter && match.player1 === playerFilter ? [match.teamOne] : playerFilter ? [match.teamTwo] : [match.teamOne, match.teamTwo]))].sort(), [playerFilter])
  const playerGames = teamStats.reduce((total, stat) => total + stat.games, 0)
  const playerPoints = teamStats.reduce((total, stat) => total + stat.points, 0)
  const playerWinRate = playerGames === 0 ? 0 : playerPoints / playerGames * 100
  const clearFilters = () => {
    setPlayerFilter('')
    setTeamFilter('')
  }

  return (
    <div hidden={!isActive}>
      <section className="intro" aria-labelledby="community-heading">
        <div><h2 id="community-heading">Community</h2><p className="intro-copy">Win rates and playing habits across non-mirror matches. Draws count as half a win.</p></div>
        <div className="stats" aria-label="Community statistics"><div><strong>{eligibleMatches.length}</strong><span>games analyzed</span></div><div><strong>{teamStats.length}</strong><span>teams</span></div>{playerFilter && <div><strong>{playerWinRate.toFixed(0)}%</strong><span>win rate</span></div>}</div>
      </section>
      <div className="community-filters">
        <label>Player<select value={playerFilter} onChange={(event) => { const player = event.target.value; setPlayerFilter(player); if (teamFilter && !MATCHES.some((match) => !isMirrorMatch(match) && playerPlayedWithTeam(match, player, teamFilter))) setTeamFilter('') }}><option value="">All players</option>{players.map((player) => <option key={player} value={player}>{player}</option>)}</select></label>
        <label>Team<select value={teamFilter} onChange={(event) => { const team = event.target.value; setTeamFilter(team); if (playerFilter && !MATCHES.some((match) => !isMirrorMatch(match) && playerPlayedWithTeam(match, playerFilter, team))) setPlayerFilter('') }}><option value="">All teams</option>{teams.map((team) => <option key={team} value={team}>{team}</option>)}</select></label>
        {(playerFilter || teamFilter) && <button type="button" className="clear-filters" onClick={clearFilters}>Clear filters</button>}
      </div>
      <section className="community-section" aria-labelledby="team-rates-heading">
        <header className="community-section-heading">
          <h3 id="team-rates-heading">Team winrates</h3>
          <div className="community-view-controls" aria-label="Team winrate view">
            <button type="button" className={view === 'table' ? 'active' : ''} aria-pressed={view === 'table'} onClick={() => setView('table')}>Table</button>
            <button type="button" className={view === 'chart' ? 'active' : ''} aria-pressed={view === 'chart'} onClick={() => setView('chart')}>Chart</button>
          </div>
        </header>
        <p className="community-section-note">Draws count as 0.5 wins</p>
        {view === 'table' ? <StatsTable stats={teamStats} noun="team" /> : <WinRateChart stats={teamStats} />}
      </section>
    </div>
  )
}

function StatsTable({ stats, noun }: { stats: StatLine[]; noun: string }) {
  return stats.length > 0 ? <div className="community-table-wrap"><table className="community-table"><thead><tr><th scope="col">{noun}</th><th scope="col">Games</th><th scope="col">W</th><th scope="col">D</th><th scope="col">L</th><th scope="col">Win rate</th></tr></thead><tbody>{stats.map((stat) => <tr key={stat.name}><th scope="row">{stat.name}</th><td>{stat.games}</td><td>{stat.wins}</td><td>{stat.draws}</td><td>{stat.losses}</td><td className="rate">{formatRate(stat)}</td></tr>)}</tbody></table></div> : <div className="empty-state"><strong>No matches found</strong><span>Try changing or clearing your filters.</span></div>
}

function WinRateChart({ stats }: { stats: StatLine[] }) {
  return stats.length > 0 ? <div className="win-rate-chart" role="list" aria-label="Team win rates">
    {stats.map((stat) => {
      const rate = winRate(stat)
      return <div className="win-rate-chart-row" key={stat.name} role="listitem">
        <strong>{stat.name}</strong>
        <div className="win-rate-chart-bar" role="progressbar" aria-label={`${stat.name} win rate`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(rate)}>
          <span style={{ width: `${rate}%` }} />
        </div>
        <span className="win-rate-chart-rate">{formatRate(stat)}</span>
        <small>{stat.games} {stat.games === 1 ? 'game' : 'games'} · {stat.wins}W {stat.draws}D {stat.losses}L</small>
      </div>
    })}
  </div> : <div className="empty-state"><strong>No matches found</strong><span>Try changing or clearing your filters.</span></div>
}

export default Community
