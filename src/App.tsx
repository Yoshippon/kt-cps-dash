import { useMemo, useState } from 'react'
import { MATCHES } from './data'
import './App.css'

const formatDate = (date: string) => new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`))

const getElapsedDays = (date: string) => {
  const matchDate = new Date(`${date}T12:00:00`)
  const today = new Date()
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const matchUtc = Date.UTC(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate())
  return Math.max(0, Math.floor((todayUtc - matchUtc) / 86400000))
}

const getElapsedTime = (date: string) => {
  const days = getElapsedDays(date)

  if (days === 0) return 'Today'
  if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'}`
  const weeks = Math.floor(days / 7)
  return `${weeks} ${weeks === 1 ? 'week' : 'weeks'}`
}

const getMatchupStatus = (date: string) => {
  const days = getElapsedDays(date)
  if (days < 28) return 'recent'
  if (days < 90) return 'average'
  return 'old'
}

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

function App() {
  const [activeTab, setActiveTab] = useState<'matches' | 'matchups'>('matches')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [playerFilter, setPlayerFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [mapFilter, setMapFilter] = useState('')
  const [playerWindow, setPlayerWindow] = useState('3')
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>(() => getPlayersForWindow(90))
  const [ruleFirstPlayer, setRuleFirstPlayer] = useState('')
  const [ruleSecondPlayer, setRuleSecondPlayer] = useState('')
  const [lockedMatchups, setLockedMatchups] = useState<string[]>([])
  const [bannedMatchups, setBannedMatchups] = useState<string[]>([])
  const filteredMatches = MATCHES.filter((match) => {
    const includesPlayer = !playerFilter || match.player1 === playerFilter || match.player2 === playerFilter
    const includesTeam = !teamFilter || match.teamOne === teamFilter || match.teamTwo === teamFilter
    const includesMap = !mapFilter || match.map === mapFilter
    return includesPlayer && includesTeam && includesMap
  })
  const sortedMatches = [...filteredMatches].sort((firstMatch, secondMatch) => secondMatch.date.localeCompare(firstMatch.date))
  const matchGroups = sortedMatches.reduce<Array<{ date: string; matches: typeof MATCHES }>>((groups, match) => {
    const currentGroup = groups.at(-1)
    if (currentGroup?.date === match.date) currentGroup.matches.push(match)
    else groups.push({ date: match.date, matches: [match] })
    return groups
  }, [])
  const playerCount = new Set(filteredMatches.flatMap((match) => [match.player1, match.player2])).size
  const hasFilters = Boolean(playerFilter || teamFilter || mapFilter)
  const allPlayers = getPlayersForWindow(Infinity)
  const teams = [...new Set(MATCHES.flatMap((match) => [match.teamOne, match.teamTwo]))].sort()
  const maps = [...new Set(MATCHES.map((match) => match.map))].sort()
  const selectedWindow = PLAYER_WINDOWS.find((window) => window.value === playerWindow) ?? PLAYER_WINDOWS[0]
  const matrixPlayers = getPlayersForWindow(selectedWindow.days)
  const selectedMatrixPlayers = selectedPlayers.filter((player) => matrixPlayers.includes(player))
  const latestMatchups = useMemo(() => {
    const latest = new Map<string, string>()
    MATCHES.forEach((match) => {
      const pair = [match.player1, match.player2].sort().join('::')
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

    return suggestions
  }, [bannedMatchups, latestMatchups, lockedMatchups, selectedMatrixPlayers])
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
  const clearFilters = () => {
    setPlayerFilter('')
    setTeamFilter('')
    setMapFilter('')
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup"><span className="brand-mark">KT</span><h1>Kill Team Campinas</h1></div>
        <button className="add-match" type="button" aria-label="Add a match"><span aria-hidden="true">+</span> Add match</button>
      </header>
      <nav className="tabs" aria-label="Dashboard views">
        <button className={activeTab === 'matches' ? 'tab active' : 'tab'} type="button" onClick={() => setActiveTab('matches')}>Matches</button>
        <button className={activeTab === 'matchups' ? 'tab active' : 'tab'} type="button" onClick={() => setActiveTab('matchups')}>Matchups</button>
      </nav>
      <section className="intro" aria-labelledby="matches-heading">
        <div><h2 id="matches-heading">{activeTab === 'matches' ? 'Matches' : 'Matchups'}</h2>{activeTab === 'matchups' && <p className="intro-copy">How long it has been since each pair of players last faced each other.</p>}</div>
        <div className="stats" aria-label="Match statistics"><div><strong>{MATCHES.length}</strong><span>games logged</span></div><div><strong>{MATCHES.filter((match) => match.isTied).length}</strong><span>draws</span></div><div><strong>{activeTab === 'matches' ? playerCount : matrixPlayers.length}</strong><span>players</span></div></div>
      </section>
      {activeTab === 'matches' && <><div className="toolbar"><span>{sortedMatches.length} {sortedMatches.length === 1 ? 'match' : 'matches'}{hasFilters ? ' found' : ''}</span><button type="button" className="filter-button" aria-expanded={isFilterOpen} aria-controls="match-filters" onClick={() => setIsFilterOpen((isOpen) => !isOpen)}>{hasFilters ? 'Filters applied' : 'All records'} <span aria-hidden="true">{isFilterOpen ? '⌃' : '⌄'}</span></button></div>
      {isFilterOpen && <div className="filter-panel" id="match-filters">
        <label>Player<select value={playerFilter} onChange={(event) => setPlayerFilter(event.target.value)}><option value="">All players</option>{allPlayers.map((player) => <option key={player} value={player}>{player}</option>)}</select></label>
        <label>Team<select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}><option value="">All teams</option>{teams.map((team) => <option key={team} value={team}>{team}</option>)}</select></label>
        <label>Map<select value={mapFilter} onChange={(event) => setMapFilter(event.target.value)}><option value="">All maps</option>{maps.map((map) => <option key={map} value={map}>{map}</option>)}</select></label>
        {hasFilters && <button type="button" className="clear-filters" onClick={clearFilters}>Clear filters</button>}
      </div>}</>}
      {activeTab === 'matches' ? <section className="match-list" aria-label="All matches">
        {matchGroups.length > 0 ? matchGroups.map((group) => <div className="date-block" key={group.date}><header className="date-header"><time dateTime={group.date}>{formatDate(group.date)}</time><span>{group.matches.length} {group.matches.length === 1 ? 'game' : 'games'}</span></header><div className="date-matches">{group.matches.map((match, index) => <article className="match-row" key={`${match.date}-${match.player1}-${match.player2}-${index}`}><div className="players"><strong>{match.player1}</strong><span>vs</span><strong>{match.player2}</strong></div><div className="teams"><span>{match.teamOne}</span><span>{match.teamTwo}</span></div><div className="match-meta"><span className="map">{match.map}</span>{match.isHomebrew && <span className="homebrew">Homebrew</span>}</div></article>)}</div></div>) : <div className="empty-state"><strong>No matches found</strong><span>Try changing or clearing your filters.</span></div>}
      </section> : <><div className="matrix-toolbar"><span>{matrixPlayers.length} {matrixPlayers.length === 1 ? 'player' : 'players'} shown</span><label>Show players<select value={playerWindow} onChange={(event) => { const value = event.target.value; setPlayerWindow(value); setSelectedPlayers((current) => current.filter((player) => getPlayersForWindow(PLAYER_WINDOWS.find((window) => window.value === value)?.days ?? 90).includes(player))) }}>{PLAYER_WINDOWS.map((window) => <option value={window.value} key={window.value}>{window.label}</option>)}</select></label></div><section className="matchup-planner" aria-labelledby="planner-heading"><div><h3 id="planner-heading">Friday match planner</h3><p>Select players attending. Each player appears in one suggested matchup.</p></div><div className="planner-players">{matrixPlayers.map((player) => <label key={player}><input type="checkbox" checked={selectedPlayers.includes(player)} onChange={() => setSelectedPlayers((current) => current.includes(player) ? current.filter((selected) => selected !== player) : [...current, player])} />{player}</label>)}</div>      <div className="matchup-rules"><strong>Matchup rules</strong><div className="rule-form"><select aria-label="First player" value={ruleFirstPlayer} onChange={(event) => setRuleFirstPlayer(event.target.value)}><option value="">First player</option>{selectedMatrixPlayers.map((player) => <option value={player} key={player}>{player}</option>)}</select><select aria-label="Second player" value={ruleSecondPlayer} onChange={(event) => setRuleSecondPlayer(event.target.value)}><option value="">Second player</option>{selectedMatrixPlayers.map((player) => <option value={player} key={player}>{player}</option>)}</select><button type="button" onClick={() => addMatchupRule('lock')}>Lock matchup</button><button type="button" onClick={() => addMatchupRule('ban')}>Ban matchup</button></div>{[...lockedMatchups.map((pair) => ({ pair, label: 'Locked' })), ...bannedMatchups.map((pair) => ({ pair, label: 'Banned' }))].map(({ pair, label }) => { const [firstPlayer, secondPlayer] = pair.split('::'); return <div className="rule" key={pair}><span>{label}</span><b>{firstPlayer} vs {secondPlayer}</b><button type="button" onClick={() => removeMatchupRule(pair)}>Remove</button></div> })}</div>{suggestedMatchups.length > 0 ? <div className="suggestions"><strong>Suggested matchups</strong>{suggestedMatchups.map(({ firstPlayer, secondPlayer, lastPlayed }, index) =>       <div className={lockedMatchups.includes(getPairKey(firstPlayer, secondPlayer)) ? 'suggestion locked' : 'suggestion'} key={`${firstPlayer}-${secondPlayer}`}><span>{index + 1}</span><b>{firstPlayer}</b><em>vs</em><b>{secondPlayer}</b><small>{lastPlayed ? `Last played ${getElapsedTime(lastPlayed)} ago` : 'Never played'}</small></div>)}{selectedMatrixPlayers.length % 2 === 1 && <small>{selectedMatrixPlayers.find((player) => !suggestedMatchups.flatMap(({ firstPlayer, secondPlayer }) => [firstPlayer, secondPlayer]).includes(player))} gets a bye.</small>}</div> : <div className="planner-empty">Select at least 2 players to generate suggestions.</div>}</section><section className="matrix-wrap" aria-label="Time since player matchups"><div className="matrix-legend" aria-label="Matchup recency legend"><span><i className="recent" />Recent</span><span><i className="average" />Average</span><span><i className="old" />Over 3 months</span><span><i className="never" />Never played</span></div><table className="matchup-matrix"><thead><tr><th scope="col">Player</th>{matrixPlayers.map((player) => <th scope="col" key={player}>{player}</th>)}</tr></thead><tbody>{matrixPlayers.map((rowPlayer) => <tr key={rowPlayer}><th scope="row">{rowPlayer}</th>{matrixPlayers.map((columnPlayer) => { const pair = [rowPlayer, columnPlayer].sort().join('::'); const latestDate = rowPlayer === columnPlayer ? undefined : latestMatchups.get(pair); const status = latestDate ? getMatchupStatus(latestDate) : 'never'; return <td className={rowPlayer === columnPlayer ? 'diagonal' : `matchup-cell ${status}`} key={columnPlayer} title={latestDate ? `Last played ${formatDate(latestDate)}` : undefined}>{rowPlayer === columnPlayer ? '—' : latestDate ? getElapsedTime(latestDate) : 'N/A'}</td> })}</tr>)}</tbody></table></section></>}
    </main>
  )
}

export default App
