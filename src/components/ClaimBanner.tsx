import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'

/**
 * Renders when the URL contains ?claim=<token>. Walks the visitor through
 * signing in (if needed) and then claiming the player row the token points
 * to, so they own the match history already recorded under that player.
 */
function ClaimBanner() {
  const { loading, isLoggedIn, signInWithEmail, claimWithToken } = useAuth()
  const [token, setToken] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [phase, setPhase] = useState<'idle' | 'sending' | 'sent' | 'claiming' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [claimedName, setClaimedName] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const claimToken = params.get('claim')
    if (claimToken) setToken(claimToken)
  }, [])

  useEffect(() => {
    if (!token || !isLoggedIn || loading || phase === 'done' || phase === 'claiming') return

    setPhase('claiming')
    claimWithToken(token)
      .then((claimed) => {
        setClaimedName(claimed.name)
        setPhase('done')
        const url = new URL(window.location.href)
        url.searchParams.delete('claim')
        window.history.replaceState({}, '', url.toString())
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to claim player.')
        setPhase('error')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isLoggedIn, loading])

  if (!token || loading) return null

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault()
    setPhase('sending')
    setError(null)
    try {
      await signInWithEmail(email, `?claim=${token}`)
      setPhase('sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send login link.')
      setPhase('error')
    }
  }

  return (
    <div className="claim-banner" role="status">
      {phase === 'done' && <p>You now own <strong>{claimedName}</strong>'s match history. Welcome!</p>}
      {phase === 'claiming' && <p>Claiming your player profile…</p>}
      {phase === 'error' && <p className="account-error">{error}</p>}
      {!isLoggedIn && phase !== 'sent' && phase !== 'error' && (
        <form onSubmit={handleSend}>
          <p>Sign in to claim this player and take ownership of their match history.</p>
          <label>
            Email
            <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
          </label>
          <button type="submit" disabled={phase === 'sending'}>{phase === 'sending' ? 'Sending…' : 'Send login link'}</button>
        </form>
      )}
      {phase === 'sent' && <p>Check your email for a login link to finish claiming this player.</p>}
    </div>
  )
}

export default ClaimBanner
