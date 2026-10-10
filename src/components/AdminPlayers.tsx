import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { PlayerRow } from '../types/database'
import { fetchMatches, type MatchRecord } from '../services/matches'
import { TEAM_EMOJIS } from '../teamEmojis'

function isFriday(date: string) {
  return new Date(`${date}T12:00:00`).getDay() === 5
}

function formatDiscordResults(date: string, matches: MatchRecord[]) {
  const formatTeam = (name: string) => `${name}${TEAM_EMOJIS[name] ? ` ${TEAM_EMOJIS[name]}` : ''}`
  const mapWidth = Math.max(...matches.map((match) => match.map.length))
  const teamWidth = Math.max(...matches.map((match) => formatTeam(match.teamOne).length))
  const formattedDate = new Date(`${date}T12:00:00`).toLocaleDateString('en-GB')
  const results = matches.map((match) => (
    `${match.map.padEnd(mapWidth)} - ${formatTeam(match.teamOne).padEnd(teamWidth)} vs ${formatTeam(match.teamTwo)}`
  ))

  return [`${formattedDate} - Jogos`, ...results].join('\n')
}

function AdminPlayers({ isActive }: { isActive: boolean }) {
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [matches, setMatches] = useState<MatchRecord[]>([])
  const [selectedFriday, setSelectedFriday] = useState('')
  const [linkByPlayer, setLinkByPlayer] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [isCopyingResults, setIsCopyingResults] = useState(false)
  const [resultsCopied, setResultsCopied] = useState(false)

  useEffect(() => {
    if (!isActive) return
    supabase.from('players').select('*').order('name', { ascending: true }).then(({ data, error: fetchError }) => {
      if (fetchError) setError(fetchError.message)
      else setPlayers((data as PlayerRow[]) ?? [])
    })
    fetchMatches()
      .then((fetchedMatches) => {
        setMatches(fetchedMatches)
        const latestFriday = [...new Set(fetchedMatches.map((match) => match.date).filter(isFriday))]
          .sort()
          .at(-1) ?? ''
        setSelectedFriday((current) => current || latestFriday)
      })
      .catch((fetchError) => setError(fetchError instanceof Error ? fetchError.message : 'Failed to load match results.'))
  }, [isActive])

  const handleGenerateLink = async (player: PlayerRow) => {
    setBusyId(player.id)
    setError(null)
    try {
      const { data, error: rpcError } = await (supabase.rpc as any)('generate_claim_token', { p_player_id: player.id })
      if (rpcError) throw rpcError
      const link = `${window.location.origin}${window.location.pathname}?claim=${data}`
      setLinkByPlayer((current) => ({ ...current, [player.id]: link }))
      await navigator.clipboard?.writeText(link).catch(() => {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate claim link.')
    } finally {
      setBusyId(null)
    }
  }

  const fridays = [...new Set(matches.map((match) => match.date).filter(isFriday))].sort().reverse()
  const selectedMatches = matches.filter((match) => match.date === selectedFriday)

  const handleCopyResults = async () => {
    if (!selectedFriday || selectedMatches.length === 0) return

    setIsCopyingResults(true)
    setResultsCopied(false)
    setError(null)
    try {
      await navigator.clipboard.writeText(formatDiscordResults(selectedFriday, selectedMatches))
      setResultsCopied(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not copy game results.')
    } finally {
      setIsCopyingResults(false)
    }
  }

  return (
    <div hidden={!isActive}>
      {error && <p className="account-error">{error}</p>}
      <section className="admin-discord-results" aria-labelledby="discord-results-heading">
        <div>
          <p className="section-kicker">Discord</p>
          <h2 id="discord-results-heading">Game results</h2>
        </div>
        <label>
          Friday
          <select value={selectedFriday} onChange={(event) => {
            setSelectedFriday(event.target.value)
            setResultsCopied(false)
          }} disabled={fridays.length === 0}>
            {fridays.map((friday) => <option key={friday} value={friday}>{new Date(`${friday}T12:00:00`).toLocaleDateString('en-GB')}</option>)}
          </select>
        </label>
        <button type="button" onClick={handleCopyResults} disabled={!selectedFriday || selectedMatches.length === 0 || isCopyingResults}>
          {isCopyingResults ? 'Copying…' : resultsCopied ? 'Copied' : 'Copy results'}
        </button>
        {fridays.length === 0 && <p>No Friday game results found.</p>}
      </section>
      <section className="admin-players-table-wrap">
        <table className="admin-players-table">
          <thead>
            <tr>
              <th scope="col">Player</th>
              <th scope="col">Status</th>
              <th scope="col">Claim link</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.id}>
                <th scope="row">{player.name}</th>
                <td>{player.user_id ? 'Claimed' : 'Unclaimed'}</td>
                <td>
                  {!player.user_id && (
                    <button type="button" disabled={busyId === player.id} onClick={() => handleGenerateLink(player)}>
                      {busyId === player.id ? 'Generating…' : 'Copy claim link'}
                    </button>
                  )}
                  {linkByPlayer[player.id] && <input readOnly value={linkByPlayer[player.id]} onFocus={(event) => event.target.select()} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

export default AdminPlayers
