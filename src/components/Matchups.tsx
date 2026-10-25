import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { MATCHES } from '../data'
import { formatDate, getElapsedDays, getElapsedTime, getMatchupStatus } from '../utils/date'
import { sortPlayersByStreakAndRecency } from '../utils/matches'

const PLAYER_WINDOWS = [
  { value: '3', label: 'Active players (last 3 months)', days: 90 },
  { value: '6', label: 'Players active in last 6 months', days: 180 },
  { value: '12', label: 'Players active in last 12 months', days: 365 },
  { value: 'all', label: 'All players', days: Infinity },
] as const

const getPlayersForWindow = (days: number) => {
  const latestGameByPlayer = new Map<string, string>()

  MATCHES.forEach((match) => {
    const players = [match.player1, match.player2]
    players.forEach((player) => {
      if (!latestGameByPlayer.has(player) || match.date > latestGameByPlayer.get(player)!) {
        latestGameByPlayer.set(player, match.date)
      }
    })
  })

  return sortPlayersByStreakAndRecency(
    [...latestGameByPlayer.keys()].filter((player) => days === Infinity || getElapsedDays(latestGameByPlayer.get(player)!) <= days),
    MATCHES,
  )
}

const getPairKey = (firstPlayer: string, secondPlayer: string) => [firstPlayer, secondPlayer].sort().join('::')

function Matchups({ isActive }: { isActive: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [hoveredCell, setHoveredCell] = useState<{ rowPlayer: string; columnPlayer: string } | null>(null)
  const playerWindow = searchParams.get('window') ?? '3'
  const selectedWindow = PLAYER_WINDOWS.find((window) => window.value === playerWindow) ?? PLAYER_WINDOWS[0]
  const matrixPlayers = getPlayersForWindow(selectedWindow.days)
  const latestMatchups = useMemo(() => {
    const latest = new Map<string, string>()
    MATCHES.forEach((match) => {
      const pair = getPairKey(match.player1, match.player2)
      if (!latest.has(pair) || match.date > latest.get(pair)!) latest.set(pair, match.date)
    })
    return latest
  }, [])

  return (
    <div hidden={!isActive}>
      <section className="tab-summary" aria-label="Match statistics">
        <div className="stats" aria-label="Match statistics"><div><strong>{MATCHES.length}</strong><span>games logged</span></div><div><strong>{MATCHES.filter((match) => match.isTied).length}</strong><span>draws</span></div><div><strong>{matrixPlayers.length}</strong><span>players</span></div></div>
      </section>
      <div className="matrix-toolbar"><span>{matrixPlayers.length} {matrixPlayers.length === 1 ? 'player' : 'players'} shown</span><label>Show players<select value={playerWindow} onChange={(event) => { const value = event.target.value; setSearchParams((currentParams) => { const nextParams = new URLSearchParams(currentParams); if (value === '3') nextParams.delete('window'); else nextParams.set('window', value); return nextParams }) }}>{PLAYER_WINDOWS.map((window) => <option value={window.value} key={window.value}>{window.label}</option>)}</select></label></div>
      <section className="matrix-wrap" aria-label="Time since player matchups"><div className="matrix-legend" aria-label="Matchup recency legend"><span><i className="fresh" />This week</span><span><i className="recent" />Recent</span><span><i className="average" />Average</span><span><i className="old" />Over 3 months</span><span><i className="never" />Never played</span></div><table className="matchup-matrix" onMouseLeave={() => setHoveredCell(null)}><thead><tr><th scope="col">Player</th>{matrixPlayers.map((player) => <th className={hoveredCell?.columnPlayer === player ? 'is-highlighted' : undefined} scope="col" key={player} onMouseEnter={() => setHoveredCell({ rowPlayer: '', columnPlayer: player })}>{player}</th>)}</tr></thead><tbody>{matrixPlayers.map((rowPlayer) => <tr key={rowPlayer}><th className={hoveredCell?.rowPlayer === rowPlayer ? 'is-highlighted' : undefined} scope="row" onMouseEnter={() => setHoveredCell({ rowPlayer, columnPlayer: '' })}>{rowPlayer}</th>{matrixPlayers.map((columnPlayer) => { const pair = getPairKey(rowPlayer, columnPlayer); const latestDate = rowPlayer === columnPlayer ? undefined : latestMatchups.get(pair); const status = latestDate ? getMatchupStatus(latestDate) : 'never'; const cellClassName = rowPlayer === columnPlayer ? 'diagonal' : `matchup-cell ${status}`; return <td className={cellClassName} key={columnPlayer} title={latestDate ? `Last played ${formatDate(latestDate)}` : undefined} onMouseEnter={() => setHoveredCell({ rowPlayer, columnPlayer })}>{rowPlayer === columnPlayer ? '\u2014' : latestDate ? getElapsedTime(latestDate) : 'N/A'}</td> })}</tr>)}</tbody></table></section>
    </div>
  )
}

export default Matchups
