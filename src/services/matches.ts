import { hasSupabaseConfig, supabase } from '../lib/supabase'
import type { MatchRow } from '../types/database'

export type MatchRecord = {
  id?: string
  date: string
  map: string
  teamOne: string
  teamTwo: string
  player1: string
  player2: string
  isTied: boolean
  isHomebrew: boolean
  isPlayer1Skip: boolean
  isPlayer2Skip: boolean
}

const mapRowToMatch = (row: MatchRow): MatchRecord => ({
  id: row.id,
  date: row.date,
  map: row.map,
  teamOne: row.team_one,
  teamTwo: row.team_two,
  player1: row.player_one,
  player2: row.player_two,
  isTied: row.is_tied,
  isHomebrew: row.is_homebrew,
  isPlayer1Skip: row.is_player_one_skip,
  isPlayer2Skip: row.is_player_two_skip,
})

export async function fetchMatches(): Promise<MatchRecord[]> {
  if (!hasSupabaseConfig) return []

  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .order('date', { ascending: false })

  if (error) throw error

  const rows = Array.isArray(data) ? (data as MatchRow[]) : []
  return rows.map(mapRowToMatch)
}

export async function createMatch(match: MatchRecord): Promise<MatchRecord> {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }

  const payload: Record<string, unknown> = {
    date: match.date,
    map: match.map,
    team_one: match.teamOne,
    team_two: match.teamTwo,
    player_one: match.player1,
    player_two: match.player2,
    is_tied: match.isTied,
    is_homebrew: match.isHomebrew,
    is_player_one_skip: match.isPlayer1Skip,
    is_player_two_skip: match.isPlayer2Skip,
  }

  const { data, error } = await supabase
    .from('matches')
    .insert(payload as any)
    .select()
    .single()

  if (error) throw error

  const row = data as MatchRow | null
  if (!row) {
    throw new Error('No match was returned from Supabase after insert.')
  }

  return mapRowToMatch(row)
}
