import { useMemo, useState } from 'react'
import { MATCHES } from '../data'
import { formatDate, getElapsedDays, getElapsedTime, getMatchupStatus } from '../utils/date'

const PLAYER_WINDOWS = [
  { value: '3', label: 'Active players (last 3 months)', days: 90 },
  { value: '6', label: 'Players active in last 6 months', days: 180 },
  { value: '12', label: 'Players active in last 12 months', days: 365 },
  { value: 'all', label: 'All players', days: Infinity },
] as const

const getPlayersForWindow = (days: number) => [...new Set(MATCHES.flatMap((match) => [match.player1, match.player2]))]
  .filter((player) => days === Infinity || MATCHES.some((match) => (
    (match.player1 === player || match.player2 === player) && getElapsedDays(match.date) <= days
  )))
  .sort()

const getPairKey = (firstPlayer: string, secondPlayer: string) => [firstPlayer, secondPlayer].sort().join('::')
type SuggestedMatchup = { firstPlayer: string; secondPlayer: string; lastPlayed: string | undefined }
const getWeekKey = (date: string) => {
  const day = new Date(`${date}T00:00:00Z`)
  const mondayOffset = (day.getUTCDay() + 6) % 7
  day.setUTCDate(day.getUTCDate() - mondayOffset)
  return day.toISOString().slice(0, 10)
}

const getConsecutiveGames = () => {
  const weeks = [...new Set(MATCHES.map((match) => getWeekKey(match.date)))].sort().reverse()
  const players = [...new Set(MATCHES.flatMap((match) => [match.player1, match.player2]))]
  return new Map(players.map((player) => {
    const playerWeeks = new Set(MATCHES.filter((match) => match.player1 === player || match.player2 === player).map((match) => getWeekKey(match.date)))
    let streak = 0
    for (const week of weeks) {
      if (!playerWeeks.has(week)) break
      streak += 1
    }
    return [player, streak]
  }))
}

function Matchups({ isActive }: { isActive: boolean }) {
  const [playerWindow, setPlayerWindow] = useState('3')
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>(() => getPlayersForWindow(90))
  const [ruleFirstPlayer, setRuleFirstPlayer] = useState('')
  const [ruleSecondPlayer, setRuleSecondPlayer] = useState('')
  const [lockedMatchups, setLockedMatchups] = useState<string[]>([])
  const [bannedMatchups, setBannedMatchups] = useState<string[]>([])
  const selectedWindow = PLAYER_WINDOWS.find((window) => window.value === playerWindow) ?? PLAYER_WINDOWS[0]
  const matrixPlayers = getPlayersForWindow(selectedWindow.days)
  const selectedMatrixPlayers = selectedPlayers.filter((player) => matrixPlayers.includes(player))
  const consecutiveGames = useMemo(getConsecutiveGames, [])
  const maxStreak = Math.max(0, ...selectedMatrixPlayers.map((player) => consecutiveGames.get(player) ?? 0))
  const latestMatchups = useMemo(() => {
    const latest = new Map<string, string>()
    MATCHES.forEach((match) => {
      const pair = getPairKey(match.player1, match.player2)
      if (!latest.has(pair) || match.date > latest.get(pair)!) latest.set(pair, match.date)
    })
    return latest
  }, [])
  const suggestedMatchups = useMemo(() => {
    const remaining = new Set(selectedMatrixPlayers)
    const suggestions: SuggestedMatchup[] = []

    lockedMatchups.forEach((pair) => {
      const [firstPlayer, secondPlayer] = pair.split('::')
      if (remaining.has(firstPlayer) && remaining.has(secondPlayer)) {
        suggestions.push({ firstPlayer, secondPlayer, lastPlayed: latestMatchups.get(pair) })
        remaining.delete(firstPlayer)
        remaining.delete(secondPlayer)
      }
    })

    const byePlayer = remaining.size % 2 === 1
      ? [...remaining].sort((first, second) => (consecutiveGames.get(second) ?? 0) - (consecutiveGames.get(first) ?? 0) || first.localeCompare(second))[0]
      : undefined
    if (byePlayer) remaining.delete(byePlayer)

    while (remaining.size > 1) {
      const candidates = [...remaining].flatMap((firstPlayer) => [...remaining]
        .filter((secondPlayer) => secondPlayer > firstPlayer)
        .map((secondPlayer) => {
          const pair = getPairKey(firstPlayer, secondPlayer)
          if (bannedMatchups.includes(pair)) return undefined
          return { firstPlayer, secondPlayer, lastPlayed: latestMatchups.get(pair) }
        }).filter((candidate): candidate is SuggestedMatchup => candidate !== undefined))
      const bestMatch = candidates.sort((first, second) => {
        if (!first.lastPlayed && second.lastPlayed) return -1
        if (first.lastPlayed && !second.lastPlayed) return 1
        return (first.lastPlayed ?? '').localeCompare(second.lastPlayed ?? '')
      })[0]
      if (!bestMatch) break
      suggestions.push(bestMatch)
      remaining.delete(bestMatch.firstPlayer)
      remaining.delete(bestMatch.secondPlayer)
    }

    return { suggestions, byePlayer }
  }, [bannedMatchups, consecutiveGames, latestMatchups, lockedMatchups, selectedMatrixPlayers])
  const addMatchupRule = (type: 'lock' | 'ban') => {
    if (!ruleFirstPlayer || !ruleSecondPlayer || ruleFirstPlayer === ruleSecondPlayer) return
    const pair = getPairKey(ruleFirstPlayer, ruleSecondPlayer)
    if (type === 'lock') {
      setLockedMatchups((current) => current.includes(pair) ? current : [...current, pair])
      setBannedMatchups((current) => current.filter((item) => item !== pair))
    } else {
      setBannedMatchups((current) => current.includes(pair) ? current : [...current, pair])
      setLockedMatchups((current) => current.filter((item) => item !== pair))
    }
    setRuleFirstPlayer('')
    setRuleSecondPlayer('')
  }
  const removeMatchupRule = (pair: string) => {
    setLockedMatchups((current) => current.filter((item) => item !== pair))
    setBannedMatchups((current) => current.filter((item) => item !== pair))
  }

  return (
    <div hidden={!isActive}>
      <section className="intro" aria-labelledby="matchups-heading">
        <div><h2 id="matchups-heading">Matchups</h2><p className="intro-copy">How long it has been since each pair of players last faced each other.</p></div>
        <div className="stats" aria-label="Match statistics"><div><strong>{MATCHES.length}</strong><span>games logged</span></div><div><strong>{MATCHES.filter((match) => match.isTied).length}</strong><span>draws</span></div><div><strong>{matrixPlayers.length}</strong><span>players</span></div></div>
      </section>
      <div className="matrix-toolbar"><span>{matrixPlayers.length} {matrixPlayers.length === 1 ? 'player' : 'players'} shown</span><label>Show players<select value={playerWindow} onChange={(event) => { const value = event.target.value; setPlayerWindow(value); setSelectedPlayers((current) => current.filter((player) => getPlayersForWindow(PLAYER_WINDOWS.find((window) => window.value === value)?.days ?? 90).includes(player))) }}>{PLAYER_WINDOWS.map((window) => <option value={window.value} key={window.value}>{window.label}</option>)}</select></label></div>
      <section className="matchup-planner" aria-labelledby="planner-heading"><div><h3 id="planner-heading">Friday match planner</h3><p>Select players attending. Each player appears in one suggested matchup.</p></div><div className="planner-players">{matrixPlayers.map((player) => { const streak = consecutiveGames.get(player) ?? 0; const isLongestStreak = selectedPlayers.includes(player) && streak === maxStreak && streak > 0; return <label key={player}><input type="checkbox" checked={selectedPlayers.includes(player)} onChange={() => setSelectedPlayers((current) => current.includes(player) ? current.filter((selected) => selected !== player) : [...current, player])} />{player}{isLongestStreak && <span className="streak-fire" aria-label="Longest streak">🔥</span>}<small className={isLongestStreak ? 'streak-highlight' : ''}>{streak} streak</small></label> })}</div><div className="matchup-rules"><strong>Matchup rules</strong><div className="rule-form"><select aria-label="First player" value={ruleFirstPlayer} onChange={(event) => setRuleFirstPlayer(event.target.value)}><option value="">First player</option>{selectedMatrixPlayers.map((player) => <option value={player} key={player}>{player}</option>)}</select><select aria-label="Second player" value={ruleSecondPlayer} onChange={(event) => setRuleSecondPlayer(event.target.value)}><option value="">Second player</option>{selectedMatrixPlayers.map((player) => <option value={player} key={player}>{player}</option>)}</select><button type="button" onClick={() => addMatchupRule('lock')}>Lock matchup</button><button type="button" onClick={() => addMatchupRule('ban')}>Ban matchup</button></div>{[...lockedMatchups.map((pair) => ({ pair, label: 'Locked' })), ...bannedMatchups.map((pair) => ({ pair, label: 'Banned' }))].map(({ pair, label }) => { const [firstPlayer, secondPlayer] = pair.split('::'); return <div className="rule" key={pair}><span>{label}</span><b>{firstPlayer} vs {secondPlayer}</b><button type="button" onClick={() => removeMatchupRule(pair)}>Remove</button></div> })}</div>{suggestedMatchups.suggestions.length > 0 || suggestedMatchups.byePlayer ? <div className="suggestions"><strong>Suggested matchups</strong>{suggestedMatchups.suggestions.map(({ firstPlayer, secondPlayer, lastPlayed }, index) => <div className={lockedMatchups.includes(getPairKey(firstPlayer, secondPlayer)) ? 'suggestion locked' : 'suggestion'} key={`${firstPlayer}-${secondPlayer}`}><span>{index + 1}</span><b>{firstPlayer}</b><em>vs</em><b>{secondPlayer}</b><small>{lastPlayed ? `Last played ${getElapsedTime(lastPlayed)} ago` : 'Never played'}</small></div>)}{suggestedMatchups.byePlayer && <small>{suggestedMatchups.byePlayer} gets a bye after {consecutiveGames.get(suggestedMatchups.byePlayer)} streak.</small>}</div> : <div className="planner-empty">Select at least 2 players to generate suggestions.</div>}</section>
      <section className="matrix-wrap" aria-label="Time since player matchups"><div className="matrix-legend" aria-label="Matchup recency legend"><span><i className="recent" />Recent</span><span><i className="average" />Average</span><span><i className="old" />Over 3 months</span><span><i className="never" />Never played</span></div><table className="matchup-matrix"><thead><tr><th scope="col">Player</th>{matrixPlayers.map((player) => <th scope="col" key={player}>{player}</th>)}</tr></thead><tbody>{matrixPlayers.map((rowPlayer) => <tr key={rowPlayer}><th scope="row">{rowPlayer}</th>{matrixPlayers.map((columnPlayer) => { const pair = getPairKey(rowPlayer, columnPlayer); const latestDate = rowPlayer === columnPlayer ? undefined : latestMatchups.get(pair); const status = latestDate ? getMatchupStatus(latestDate) : 'never'; return <td className={rowPlayer === columnPlayer ? 'diagonal' : `matchup-cell ${status}`} key={columnPlayer} title={latestDate ? `Last played ${formatDate(latestDate)}` : undefined}>{rowPlayer === columnPlayer ? '—' : latestDate ? getElapsedTime(latestDate) : 'N/A'}</td> })}</tr>)}</tbody></table></section>
    </div>
  )
}

export default Matchups
