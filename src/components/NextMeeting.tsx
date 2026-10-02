import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MATCHES, MAPS } from '../data'
import type { MapData } from '../data'
import { formatDate, formatMeetingElapsedTime, formatTimeUntil, getElapsedDays, getElapsedTime, getMeetingStatus } from '../utils/date'
import { getConsecutiveGames } from '../utils/matches'
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
type SuggestedMatchup = { firstPlayer: string; secondPlayer: string; lastPlayed: string | undefined; map?: MapData }
type MatchupPlan = { pairs: SuggestedMatchup[]; recencyScores: number[] }

const compareMatchupPlans = (first: MatchupPlan, second: MatchupPlan) => {
  for (let index = 0; index < first.recencyScores.length; index += 1) {
    if (first.recencyScores[index] !== second.recencyScores[index]) {
      return first.recencyScores[index] - second.recencyScores[index]
    }
  }
  return 0
}

const seededOrder = (value: string, seed: number) => {
  let hash = seed
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  return hash >>> 0
}

const selectBestMatchups = (
  players: string[],
  latestMatchups: Map<string, string>,
  bannedMatchups: Set<string>,
  randomSeed: number,
): SuggestedMatchup[] => {
  const solve = (remainingPlayers: string[]): MatchupPlan | null => {
    if (remainingPlayers.length === 0) return { pairs: [], recencyScores: [] }

    const [firstPlayer, ...otherPlayers] = remainingPlayers
    let bestPlan: MatchupPlan | null = null
    const partners = [...otherPlayers].sort((first, second) =>
      seededOrder(getPairKey(firstPlayer, first), randomSeed) - seededOrder(getPairKey(firstPlayer, second), randomSeed))

    for (const secondPlayer of partners) {
      const pair = getPairKey(firstPlayer, secondPlayer)
      if (bannedMatchups.has(pair)) continue

      const nextPlan = solve(otherPlayers.filter((player) => player !== secondPlayer))
      if (!nextPlan) continue

      const lastPlayed = latestMatchups.get(pair)
      const plan = {
        pairs: [{ firstPlayer, secondPlayer, lastPlayed }, ...nextPlan.pairs],
        recencyScores: [lastPlayed ? Date.parse(`${lastPlayed}T00:00:00Z`) : Number.NEGATIVE_INFINITY, ...nextPlan.recencyScores]
          .sort((first, second) => second - first),
      }
      if (!bestPlan || (randomSeed === 0 && compareMatchupPlans(plan, bestPlan) < 0)) bestPlan = plan
    }

    return bestPlan
  }

  return solve(players)?.pairs ?? []
}

function NextMeeting({ isActive }: { isActive: boolean }) {
  const [playerWindow, setPlayerWindow] = useState('3')
  const [meetingStatus, setMeetingStatus] = useState(getMeetingStatus())

  useEffect(() => {
    const interval = setInterval(() => setMeetingStatus(getMeetingStatus()), 1000)
    return () => clearInterval(interval)
  }, [])
  const [ruleFirstPlayer, setRuleFirstPlayer] = useState('')
  const [ruleSecondPlayer, setRuleSecondPlayer] = useState('')
  const [lockedMatchups, setLockedMatchups] = useState<string[]>([])
  const [bannedMatchups, setBannedMatchups] = useState<string[]>([])
  const [randomSeed, setRandomSeed] = useState(0)
  const [spinningMatchup, setSpinningMatchup] = useState<string | null>(null)
  const [selectedMaps, setSelectedMaps] = useState<Record<string, MapData>>({})
  const [winningMapNames, setWinningMapNames] = useState<string[] | null>(null)
  const selectedWindow = PLAYER_WINDOWS.find((window) => window.value === playerWindow) ?? PLAYER_WINDOWS[0]
  const matrixPlayers = getPlayersForWindow(selectedWindow.days)
  const consecutiveGames = useMemo(() => getConsecutiveGames(MATCHES), [])
  const latestMatchups = useMemo(() => {
    const latest = new Map<string, string>()
    MATCHES.forEach((match) => {
      const pair = getPairKey(match.player1, match.player2)
      if (!latest.has(pair) || match.date > latest.get(pair)!) latest.set(pair, match.date)
    })
    return latest
  }, [])
  const recentPlayers = useMemo(() => matrixPlayers.slice(0, 4), [matrixPlayers])
  const savedPlayers = window.sessionStorage.getItem('kt-cps-selected-attendees')
  const savedMeetingDate = window.sessionStorage.getItem('kt-cps-selected-attendees-meeting-date')
  const hasSavedSelectedPlayers = useRef(savedPlayers !== null && savedMeetingDate === meetingStatus.meetingDate)
  const meetingDateRef = useRef(meetingStatus.meetingDate)
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>(() => {
    return savedPlayers !== null && savedMeetingDate === meetingStatus.meetingDate
      ? savedPlayers.split('\n').filter((player) => recentPlayers.includes(player))
      : recentPlayers
  })

  useEffect(() => {
    if (meetingDateRef.current === meetingStatus.meetingDate) return
    meetingDateRef.current = meetingStatus.meetingDate
    hasSavedSelectedPlayers.current = false
    setSelectedPlayers(recentPlayers)
  }, [meetingStatus.meetingDate, recentPlayers])

  useEffect(() => {
    window.sessionStorage.setItem('kt-cps-selected-attendees', selectedPlayers.join('\n'))
    window.sessionStorage.setItem('kt-cps-selected-attendees-meeting-date', meetingStatus.meetingDate)
  }, [meetingStatus.meetingDate, selectedPlayers])

  const selectedMatrixPlayers = selectedPlayers.filter((player) => matrixPlayers.includes(player))
  const maxStreak = Math.max(0, ...matrixPlayers.map((player) => consecutiveGames.get(player) ?? 0))
  const attendingPlayers = [...matrixPlayers].sort((firstPlayer, secondPlayer) =>
    (consecutiveGames.get(secondPlayer) ?? 0) - (consecutiveGames.get(firstPlayer) ?? 0)
    || firstPlayer.localeCompare(secondPlayer))
  const availableMaps = useMemo(() => {
    if (winningMapNames !== null) {
      return MAPS.filter((map) => winningMapNames.includes(map.name))
    }
    if (selectedPlayers.length === 0) return []
    return MAPS.filter((map) => map.owners.some((owner) => selectedPlayers.includes(owner)))
  }, [selectedPlayers, winningMapNames])
  const handleAttendanceChange = useCallback((playerNames: string[], changedByUser: boolean) => {
    if (changedByUser || !hasSavedSelectedPlayers.current) {
      setSelectedPlayers(playerNames)
      hasSavedSelectedPlayers.current = true
    }
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

    suggestions.push(...selectBestMatchups([...remaining].sort(), latestMatchups, new Set(bannedMatchups), randomSeed))

    return { suggestions, byePlayer }
  }, [bannedMatchups, consecutiveGames, latestMatchups, lockedMatchups, selectedMatrixPlayers, randomSeed])

  const matchupsWithMaps = useMemo(() => suggestedMatchups.suggestions.map((matchup) => ({
    ...matchup,
    map: selectedMaps[`${matchup.firstPlayer}-${matchup.secondPlayer}`],
  })), [selectedMaps, suggestedMatchups])

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

  const randomizeMaps = () => {
    if (availableMaps.length === 0) return

    const mapPool = [...availableMaps]
    for (let index = mapPool.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1))
      ;[mapPool[index], mapPool[randomIndex]] = [mapPool[randomIndex], mapPool[index]]
    }

    setSelectedMaps(Object.fromEntries(suggestedMatchups.suggestions.slice(0, mapPool.length).map((matchup, index) => [
      `${matchup.firstPlayer}-${matchup.secondPlayer}`,
      mapPool[index],
    ])))
  }

  return (
    <div hidden={!isActive}>
      <section className="tab-summary" aria-label="Game night overview">
        <div className="tab-summary-meeting">
          <div className="meeting-title">
            <span>Next Game Night</span>
            <strong>{formatDate(meetingStatus.meetingDate)}</strong>
          </div>
          <div className={meetingStatus.kind === 'started' ? 'countdown live' : 'countdown'} aria-label={meetingStatus.kind === 'started' ? 'Game night in progress' : 'Time until next game night'}>
            {meetingStatus.kind === 'started' ? (
              <>Game Night Started <strong>{formatMeetingElapsedTime(meetingStatus.elapsedMs)} ago</strong></>
            ) : (
              <>Next Game Night in <strong>{formatTimeUntil(meetingStatus.timeUntil)}</strong></>
            )}
          </div>
        </div>
      </section>
      <MapVoting
        onAttendanceChange={handleAttendanceChange}
        onWinningMapsChange={handleWinningMapsChange}
        refreshKey={meetingStatus.meetingDate}
      />

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
          {attendingPlayers.map((player) => {
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
        <p className="attendee-count">{selectedPlayers.length} players attending</p>
      </section>

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
            <button type="button" className="randomize-btn" onClick={randomizeMaps}>Randomize Maps</button>
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
                      Spin
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