import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { hasSupabaseConfig, supabase } from './supabase'
import type { PlayerRow } from '../types/database'

type AuthContextValue = {
  loading: boolean
  session: Session | null
  /** The players row linked to the signed-in account, if any has been claimed. */
  player: PlayerRow | null
  isLoggedIn: boolean
  isGuest: boolean
  isAdmin: boolean
  signInWithEmail: (email: string, redirectExtra?: string) => Promise<void>
  signOut: () => Promise<void>
  claimWithToken: (token: string) => Promise<PlayerRow>
  refreshPlayer: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [player, setPlayer] = useState<PlayerRow | null>(null)
  const isGuest = false

  const loadPlayer = useCallback(async (userId: string | undefined) => {
    if (!hasSupabaseConfig || !userId) {
      setPlayer(null)
      return
    }
    const { data, error: fetchError } = await (supabase.from('players') as any).select('*').eq('user_id', userId).maybeSingle()
    setPlayer((data as PlayerRow) ?? null)
    if (fetchError) setPlayer(null)
  }, [])

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      return loadPlayer(data.session?.user.id)
    }).finally(() => setLoading(false))

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      loadPlayer(nextSession?.user.id)
    })

    return () => subscription.subscription.unsubscribe()
  }, [loadPlayer])

  const signInWithEmail = useCallback(async (email: string, redirectExtra?: string) => {
    if (!hasSupabaseConfig) throw new Error('Supabase is not configured.')
    const redirectTo = `${window.location.origin}${window.location.pathname}${redirectExtra ?? ''}`
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    if (!hasSupabaseConfig) return
    await supabase.auth.signOut()
    setPlayer(null)
  }, [])

  const claimWithToken = useCallback(async (token: string) => {
    if (!hasSupabaseConfig) throw new Error('Supabase is not configured.')
    const { data, error } = await (supabase.rpc as any)('claim_player', { p_token: token })
    if (error) throw error
    const claimed = data as PlayerRow
    setPlayer(claimed)
    return claimed
  }, [])

  const refreshPlayer = useCallback(async () => {
    await loadPlayer(session?.user.id)
  }, [loadPlayer, session])

  const value = useMemo<AuthContextValue>(() => ({
    loading,
    session,
    player,
    isLoggedIn: Boolean(session) && !isGuest,
    isGuest,
    isAdmin: Boolean(player?.is_admin),
    signInWithEmail,
    signOut,
    claimWithToken,
    refreshPlayer,
  }), [loading, session, player, signInWithEmail, signOut, claimWithToken, refreshPlayer])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
