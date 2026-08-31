import { useCallback, useMemo, useState, useEffect } from 'react'
import { MATCHES, MAPS } from '../data'
import type { MapData } from '../data'
import { formatDate, getElapsedDays, getElapsedTime, getTimeUntilNextFriday19, formatTimeUntil } from '../utils/date'
import MapWheel from './MapWheel'
import MapVoting from './MapVoting'

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
type SuggestedMatchup = { firstPlayer: string; secondPlayer: string; lastPlayed: string | undefined; map?: string }
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
    const playerWeeks = new Set(MATCHES
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

function NextMeeting({ isActive }: { isActive: boolean }) {
  const [playerWindow, setPlayerWindow] = useState('3')
  const [timeUntil, setTimeUntil] = useState(getTimeUntilNextFriday19())

  useEffect(() => {
    const interval = setInterval(() => setTimeUntil(getTimeUntilNextFriday19()), 1000)
    return () => clearInterval(interval)
  }, [])
  const [ruleFirstPlayer, setRuleFirstPlayer] = useState('')
  const [ruleSecondPlayer, setRuleSecondPlayer] = useState('')
  const [lockedMatchups, setLockedMatchups] = useState<string[]>([])
  const [bannedMatchups, setBannedMatchups] = useState<string[]>([])
  const [randomSeed, setRandomSeed] = useState(0)
  const [mapSeed, setMapSeed] = useState(0)
  const [spinningMatchup, setSpinningMatchup] = useState<string | null>(null)
  const [selectedMaps, setSelectedMaps] = useState<Record<string, MapData>>({})
  const [confirmedAttendeeCount, setConfirmedAttendeeCount] = useState<number | null>(null)
  const [winningMapNames, setWinningMapNames] = useState<string[] | null>(null)
  const selectedWindow = PLAYER_WINDOWS.find((window) => window.value === playerWindow) ?? PLAYER_WINDOWS[0]
  const matrixPlayers = getPlayersForWindow(selectedWindow.days)
  const consecutiveGames = useMemo(getConsecutiveGames, [])
  const latestMatchups = useMemo(() => {
    const latest = new Map<string, string>()
    MATCHES.forEach((match) => {
      const pair = getPairKey(match.player1, match.player2)
      if (!latest.has(pair) || match.date > latest.get(pair)!) latest.set(pair, match.date)
    })
    return latest
  }, [])
  const recentPlayers = useMemo(() => matrixPlayers.slice(0, 4), [matrixPlayers])
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>(() => recentPlayers)

  const selectedMatrixPlayers = selectedPlayers.filter((player) => matrixPlayers.includes(player))
  const maxStreak = Math.max(0, ...matrixPlayers.map((player) => consecutiveGames.get(player) ?? 0))
  const availableMaps = useMemo(() => {
    if (winningMapNames !== null) {
      return MAPS.filter((map) => winningMapNames.includes(map.name))
    }
    if (selectedPlayers.length === 0) return []
    return MAPS.filter((map) => map.owners.some((owner) => selectedPlayers.includes(owner)))
  }, [selectedPlayers, winningMapNames])
  const handleAttendanceChange = useCallback((playerNames: string[], attendeeCount: number) => {
    setSelectedPlayers(playerNames)
    setConfirmedAttendeeCount(attendeeCount)
  }, [])
  const handleWinningMapsChange = useCallback((mapNames: string[]) => {
    setWinningMapNames(mapNames)
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

    const remainingPlayers = [...remaining]
    
    // Fisher-Yates shuffle using randomSeed
    const shuffled = [...remainingPlayers]
    let seed = randomSeed
    for (let i = shuffled.length - 1; i > 0; i--) {
      seed = (seed * 1664525 + 1013904223) >>> 0
      const j = seed % (i + 1)
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    for (let i = 0; i < shuffled.length - 1; i += 2) {
      const firstPlayer = shuffled[i]
      const secondPlayer = shuffled[i + 1]
      const pair = getPairKey(firstPlayer, secondPlayer)
      if (bannedMatchups.includes(pair)) {
        // Try to find alternative partner
        let found = false
        for (let k = i + 2; k < shuffled.length; k++) {
          const altPair = getPairKey(firstPlayer, shuffled[k])
          if (!bannedMatchups.includes(altPair)) {
            ;[shuffled[i + 1], shuffled[k]] = [shuffled[k], shuffled[i + 1]]
            suggestions.push({ firstPlayer, secondPlayer: shuffled[i + 1], lastPlayed: latestMatchups.get(getPairKey(firstPlayer, shuffled[i + 1])) })
            found = true
            break
          }
        }
        if (!found) {
          // Skip this player if no valid partner
          continue
        }
      } else {
        suggestions.push({ firstPlayer, secondPlayer, lastPlayed: latestMatchups.get(pair) })
      }
    }

    return { suggestions, byePlayer }
  }, [bannedMatchups, consecutiveGames, latestMatchups, lockedMatchups, selectedMatrixPlayers, randomSeed])

  const matchupsWithMaps = useMemo(() => {
    if (availableMaps.length === 0 || suggestedMatchups.suggestions.length === 0) {
      return suggestedMatchups.suggestions.map((m) => ({ ...m, map: undefined }))
    }
    const mapPool = [...availableMaps]
    // Fisher-Yates shuffle using mapSeed
    let seed = mapSeed
    for (let i = mapPool.length - 1; i > 0; i--) {
      seed = (seed * 1664525 + 1013904223) >>> 0
      const j = seed % (i + 1)
      ;[mapPool[i], mapPool[j]] = [mapPool[j], mapPool[i]]
    }
    return suggestedMatchups.suggestions.map((matchup, index) => ({
      ...matchup,
      map: selectedMaps[`${matchup.firstPlayer}-${matchup.secondPlayer}`] ?? mapPool[index % mapPool.length]
    }))
  }, [availableMaps, mapSeed, selectedMaps, suggestedMatchups])

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

  const handleMapSelect = (map: MapData) => {
    if (!spinningMatchup) return
    setSelectedMaps((current) => ({ ...current, [spinningMatchup]: map }))
  }

  const openWheel = (matchupKey: string) => {
    setSpinningMatchup(matchupKey)
  }

  return (
    <div hidden={!isActive}>
      <section className="intro" aria-labelledby="next-meeting-heading">
        <div className="intro-header">
          <h2 id="next-meeting-heading">Next Meeting</h2>
          <p className="intro-copy">Plan the upcoming Friday session: attendees and matchups.</p>
        </div>
        <div className="intro-stats">
          <div className="countdown" aria-label="Time until next meeting">
            Next meeting in <strong>{formatTimeUntil(timeUntil)}</strong>
          </div>
          <div className="stats" aria-label="Meeting statistics">
            <div><strong>{confirmedAttendeeCount ?? selectedPlayers.length}</strong><span>attending</span></div>
            <div><strong>{matrixPlayers.length}</strong><span>players available</span></div>
          </div>
        </div>
      </section>
      <div className="matrix-toolbar">
        <span>{matrixPlayers.length} {matrixPlayers.length === 1 ? 'player' : 'players'} shown</span>
        <label>Show players
          <select value={playerWindow} onChange={(event) => { const value = event.target.value; setPlayerWindow(value); }}>
            {PLAYER_WINDOWS.map((window) => <option value={window.value} key={window.value}>{window.label}</option>)}
          </select>
        </label>
      </div>

      <section className="attendees" aria-labelledby="attendees-heading">
        <div><h3 id="attendees-heading">Players Attending</h3><p>Confirmed players appear in one suggested matchup.</p></div>
        <div className="planner-players">
          {matrixPlayers.map((player) => {
            const streak = consecutiveGames.get(player) ?? 0
            const isLongestStreak = streak === maxStreak && streak > 0
            return (
            <label key={player}>
              <input
                type="checkbox"
                checked={selectedPlayers.includes(player)}
                onChange={() => setSelectedPlayers((current) =>
                  current.includes(player)
                    ? current.filter((selected) => selected !== player)
                    : [...current, player]
                )}
              />
              {player}{isLongestStreak && <span className="streak-fire" aria-label="Longest streak">🔥</span>}
              <small className={isLongestStreak ? 'streak-highlight' : ''}>{streak} streak</small>
            </label>
          )})}
        </div>
        <p className="attendee-count">{confirmedAttendeeCount ?? selectedPlayers.length} players attending</p>
      </section>
      <MapVoting onAttendanceChange={handleAttendanceChange} onWinningMapsChange={handleWinningMapsChange} />

      {selectedPlayers.length > 0 && (
        <section className="maps-section" aria-labelledby="maps-heading">
          <header className="section-heading"><h3 id="maps-heading">{winningMapNames !== null ? 'Winning Maps' : 'Available Maps'}</h3><span>{availableMaps.length} available</span></header>
          <div className="available-map-list">{availableMaps.map((map) => <span className="available-map" key={map.name}><strong>{map.name}</strong><small>{map.owners.filter((owner) => selectedPlayers.includes(owner)).join(', ')}</small></span>)}</div>
          {availableMaps.length === 0 && <p className="no-maps">No maps available for selected players.</p>}
        </section>
      )}

      <section className="matchup-planner" aria-labelledby="planner-heading">
        <div className="matchup-rules">
          <strong>Matchup Rules</strong>
          <div className="rule-form">
            <select
              aria-label="First player"
              value={ruleFirstPlayer}
              onChange={(event) => setRuleFirstPlayer(event.target.value)}
            >
              <option value="">First player</option>
              {selectedMatrixPlayers.map((player) => (
                <option value={player} key={player}>{player}</option>
              ))}
            </select>
            <select
              aria-label="Second player"
              value={ruleSecondPlayer}
              onChange={(event) => setRuleSecondPlayer(event.target.value)}
            >
              <option value="">Second player</option>
              {selectedMatrixPlayers.map((player) => (
                <option value={player} key={player}>{player}</option>
              ))}
            </select>
            <button type="button" onClick={() => addMatchupRule('lock')}>Lock matchup</button>
            <button type="button" onClick={() => addMatchupRule('ban')}>Ban matchup</button>
            <button type="button" className="randomize-btn" onClick={() => setRandomSeed((s) => s + 1)}>Randomize</button>
            <button type="button" className="randomize-btn" onClick={() => setMapSeed((s) => s + 1)}>Randomize Maps</button>
          </div>
          {[
            ...lockedMatchups.map((pair) => ({ pair, label: 'Locked' })),
            ...bannedMatchups.map((pair) => ({ pair, label: 'Banned' })),
          ].map(({ pair, label }) => {
            const [firstPlayer, secondPlayer] = pair.split('::')
            return (
              <div className="rule" key={pair}>
                <span>{label}</span>
                <b>{firstPlayer} vs {secondPlayer}</b>
                <button type="button" onClick={() => removeMatchupRule(pair)}>Remove</button>
              </div>
            )
          })}
        </div>

        {suggestedMatchups.suggestions.length > 0 || suggestedMatchups.byePlayer ? (
          <div className="suggestions">
            <strong>Suggested Matchups</strong>
            {matchupsWithMaps.map(({ firstPlayer, secondPlayer, lastPlayed, map }) => {
              const matchupKey = `${firstPlayer}-${secondPlayer}`
              const isLocked = lockedMatchups.includes(getPairKey(firstPlayer, secondPlayer))
              return (
                <div
                  className={isLocked ? 'suggestion locked' : 'suggestion'}
                  key={matchupKey}
                >
                  <span className="suggestion-pair">
                    <b>{firstPlayer}</b> vs <b>{secondPlayer}</b>
                  </span>
                  <span className="suggestion-meta">
                    {lastPlayed
                      ? `Last played ${formatDate(lastPlayed)} (${getElapsedTime(lastPlayed)})`
                      : 'Never played'}
                  </span>
                  <div className="suggestion-map-row">
                    {map ? <span className="suggestion-map">Map: {map.name}</span> : <span className="suggestion-map">Map: unassigned</span>}
                    <button type="button" className="spin-btn-small" onClick={() => openWheel(matchupKey)} disabled={spinningMatchup !== null && spinningMatchup !== matchupKey}>
                      {map ? 'Re-spin' : 'Spin for map'}
                    </button>
                  </div>
                </div>
              )
            })}
            {suggestedMatchups.byePlayer && <small>{suggestedMatchups.byePlayer} gets a bye after {consecutiveGames.get(suggestedMatchups.byePlayer)} game streak.</small>}
          </div>
        ) : (
          <p className="no-suggestions">Select at least two players to generate matchups.</p>
        )}
      </section>
      <MapWheel
        maps={MAPS}
        preselectedMapNames={winningMapNames ?? []}
        isOpen={spinningMatchup !== null}
        onClose={() => setSpinningMatchup(null)}
        onSelect={handleMapSelect}
      />
    </div>
  )
}

export default NextMeeting