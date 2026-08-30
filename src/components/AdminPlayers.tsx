import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { PlayerRow } from '../types/database'

function AdminPlayers({ isActive }: { isActive: boolean }) {
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [linkByPlayer, setLinkByPlayer] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    if (!isActive) return
    supabase.from('players').select('*').order('name', { ascending: true }).then(({ data, error: fetchError }) => {
      if (fetchError) setError(fetchError.message)
      else setPlayers((data as PlayerRow[]) ?? [])
    })
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

  return (
    <div hidden={!isActive}>
      <section className="intro" aria-labelledby="admin-players-heading">
        <div>
          <h2 id="admin-players-heading">Players</h2>
          <p className="intro-copy">Generate a claim link for a player and send it to them (WhatsApp, email, etc). Opening it lets them sign in and take ownership of that player's match history.</p>
        </div>
      </section>
      {error && <p className="account-error">{error}</p>}
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
