import { useMemo, useState } from 'react'
import { MATCHES, MAPS } from '../data'
import type { MapData } from '../data'
import { formatDate, getElapsedDays, getElapsedTime } from '../utils/date'
import MapWheel from './MapWheel'

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

function NextMeeting({ isActive }: { isActive: boolean }) {
  const [playerWindow, setPlayerWindow] = useState('3')
  const [ruleFirstPlayer, setRuleFirstPlayer] = useState('')
  const [ruleSecondPlayer, setRuleSecondPlayer] = useState('')
  const [lockedMatchups, setLockedMatchups] = useState<string[]>([])
  const [bannedMatchups, setBannedMatchups] = useState<string[]>([])
  const [randomSeed, setRandomSeed] = useState(0)
  const [mapSeed, setMapSeed] = useState(0)
  const [spinningMatchup, setSpinningMatchup] = useState<string | null>(null)
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
  const recentPlayers = useMemo(() => matrixPlayers.slice(0, 4), [matrixPlayers])
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>(() => recentPlayers)

  const selectedMatrixPlayers = selectedPlayers.filter((player) => matrixPlayers.includes(player))
  const availableMaps = useMemo(() => {
    if (selectedPlayers.length === 0) return []
    return MAPS.filter((map) => map.owners.some((owner) => selectedPlayers.includes(owner)))
  }, [selectedPlayers])
  const mapsByCategory = useMemo(() => {
    const categories: Record<string, typeof MAPS> = { 'Open': [], 'Close Quarters': [], 'Hazardous Terrain': [] }
    availableMaps.forEach((map) => { categories[map.category].push(map) })
    return categories
  }, [availableMaps])
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

    return suggestions
  }, [bannedMatchups, latestMatchups, lockedMatchups, selectedMatrixPlayers, randomSeed])

  const matchupsWithMaps = useMemo(() => {
    if (availableMaps.length === 0 || suggestedMatchups.length === 0) {
      return suggestedMatchups.map((m) => ({ ...m, map: undefined }))
    }
    const mapPool = [...availableMaps]
    // Fisher-Yates shuffle using mapSeed
    let seed = mapSeed
    for (let i = mapPool.length - 1; i > 0; i--) {
      seed = (seed * 1664525 + 1013904223) >>> 0
      const j = seed % (i + 1)
      ;[mapPool[i], mapPool[j]] = [mapPool[j], mapPool[i]]
    }
    return suggestedMatchups.map((matchup, index) => ({
      ...matchup,
      map: mapPool[index % mapPool.length]
    }))
  }, [availableMaps, suggestedMatchups, mapSeed])

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

  const handleMapSelect = (_map: MapData) => {
    if (!spinningMatchup) return
    // In a full implementation, you'd store per-matchup map selection
    // For now, we'll use the mapSeed approach to trigger a re-randomization
    setMapSeed((s) => s + 1)
    setSpinningMatchup(null)
  }

  const openWheel = (matchupKey: string) => {
    setSpinningMatchup(matchupKey)
  }

  return (
    <div hidden={!isActive}>
      <section className="intro" aria-labelledby="next-meeting-heading">
        <div><h2 id="next-meeting-heading">Next Meeting</h2><p className="intro-copy">Plan the upcoming Friday session: attendees and matchups.</p></div>
        <div className="stats" aria-label="Meeting statistics"><div><strong>{selectedPlayers.length}</strong><span>attending</span></div><div><strong>{matrixPlayers.length}</strong><span>players available</span></div></div>
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
        <div><h3 id="attendees-heading">Players Attending</h3><p>Select players attending. Each player appears in one suggested matchup.</p></div>
        <div className="planner-players">
          {matrixPlayers.map((player) => (
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
              {player}
            </label>
          ))}
        </div>
        <p className="attendee-count">{selectedPlayers.length} of {matrixPlayers.length} players attending</p>
      </section>

      {selectedPlayers.length > 0 && (
        <section className="maps-section" aria-labelledby="maps-heading">
          <h3 id="maps-heading">Available Maps</h3>
          <p>Maps owned by attending players, grouped by category.</p>
          {Object.entries(mapsByCategory).map(([category, maps]) =>
            maps.length > 0 ? (
              <div key={category} className="map-category">
                <h4>{category}</h4>
                <ul className="map-list">
                  {maps.map((map) => (
                    <li key={map.name}>
                      <strong>{map.name}</strong>
                      <span className="map-owners">({map.owners.filter((o) => selectedPlayers.includes(o)).join(', ')})</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null
          )}
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

        {suggestedMatchups.length > 0 ? (
          <div className="suggestions">
            <strong>Suggested Matchups</strong>
            {matchupsWithMaps.map(({ firstPlayer, secondPlayer, lastPlayed, map }, index) => {
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
                  <div className="suggestion-map-actions">
                    {map ? (
                      <>
                        <span className="suggestion-map">🗺️ {map.name} ({map.category})</span>
                        <button
                          type="button"
                          className="spin-btn-small"
                          onClick={() => openWheel(matchupKey)}
                          disabled={spinningMatchup !== null && spinningMatchup !== matchupKey}
                        >
                          Re-spin
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="spin-btn-small"
                        onClick={() => openWheel(matchupKey)}
                        disabled={spinningMatchup !== null && spinningMatchup !== matchupKey}
                      >
                        🎡 Spin for Map
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="no-suggestions">Select at least two players to generate matchups.</p>
        )}
      </section>
      <MapWheel
        maps={availableMaps}
        isOpen={spinningMatchup !== null}
        onClose={() => setSpinningMatchup(null)}
        onSelect={handleMapSelect}
      />
    </div>
  )
}

export default NextMeeting