import { useState } from 'react'
import { useAuth } from '../lib/auth'

function AccountMenu() {
  const { loading, isLoggedIn, isAdmin, player, session, signInWithEmail, signOut } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  if (loading) return null

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault()
    setStatus('sending')
    setError(null)
    try {
      await signInWithEmail(email)
      setStatus('sent')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Failed to send login link.')
    }
  }

  if (isLoggedIn) {
    return (
      <div className="account-menu">
        <span className="account-label">
          {player ? player.name : session?.user.email}
          {isAdmin && <span className="admin-badge">admin</span>}
        </span>
        <button type="button" className="account-signout" onClick={() => signOut()}>Sign out</button>
      </div>
    )
  }

  return (
    <div className="account-menu">
      <button
        type="button"
        className="account-signin"
        title="Already have matches listed? Ask an admin for your claim invitation before signing in. Do not create a separate account."
        onClick={() => setIsOpen((open) => !open)}
      >
        Sign in
      </button>
      <span className="account-signin-hint">Have match history? Ask admin for claim invite first.</span>
      {isOpen && (
        <div className="account-popover">
          {status === 'sent' ? (
            <p>Check your email for a login link.</p>
          ) : (
            <form onSubmit={handleSend}>
              <label>
                Email
                <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
              </label>
              <button type="submit" disabled={status === 'sending'}>{status === 'sending' ? 'Sending…' : 'Send login link'}</button>
              {status === 'error' && <p className="account-error">{error}</p>}
            </form>
          )}
        </div>
      )}
    </div>
  )
}

export default AccountMenu
