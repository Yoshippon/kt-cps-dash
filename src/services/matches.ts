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
  player1Score?: number | null
  player2Score?: number | null
  player1Primary?: string | null
  player2Primary?: string | null
  player1Tac?: string | null
  player2Tac?: string | null
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
  player1Score: row.player_one_score,
  player2Score: row.player_two_score,
  player1Primary: row.player_one_primary,
  player2Primary: row.player_two_primary,
  player1Tac: row.player_one_tac,
  player2Tac: row.player_two_tac,
})

export async function fetchMatches(): Promise<MatchRecord[]> {
  if (!hasSupabaseConfig) return []

  const [
    { data: matchRows, error: matchError },
    { data: mapRows, error: mapError },
    { data: playerRows, error: playerError },
    { data: teamRows, error: teamError },
  ] = await Promise.all([
    supabase.from('matches').select('id, date, map_id, team_one_id, team_two_id, player_one_id, player_two_id, is_tied, is_homebrew, is_player_one_skip, is_player_two_skip, player_one_score, player_two_score, player_one_primary, player_two_primary, player_one_tac, player_two_tac').order('date', { ascending: false }),
    supabase.from('maps').select('id, name'),
    supabase.from('players').select('id, name'),
    supabase.from('teams').select('id, name'),
  ])

  if (matchError || mapError || playerError || teamError) throw matchError ?? mapError ?? playerError ?? teamError

  const mapRowsAny = Array.isArray(mapRows) ? (mapRows as any[]) : []
  const playerRowsAny = Array.isArray(playerRows) ? (playerRows as any[]) : []
  const teamRowsAny = Array.isArray(teamRows) ? (teamRows as any[]) : []
  const rows = Array.isArray(matchRows) ? (matchRows as any[]) : []

  const mapIdByName = new Map(mapRowsAny.map((row) => [row.id, row.name]))
  const playerIdByName = new Map(playerRowsAny.map((row) => [row.id, row.name]))
  const teamIdByName = new Map(teamRowsAny.map((row) => [row.id, row.name]))

  return rows.map((row: any) => ({
    id: row.id,
    date: row.date,
    map: row.map_id ? mapIdByName.get(row.map_id) ?? 'Unknown map' : 'Unknown map',
    teamOne: row.team_one_id ? teamIdByName.get(row.team_one_id) ?? 'Unknown team' : 'Unknown team',
    teamTwo: row.team_two_id ? teamIdByName.get(row.team_two_id) ?? 'Unknown team' : 'Unknown team',
    player1: row.player_one_id ? playerIdByName.get(row.player_one_id) ?? 'Unknown player' : 'Unknown player',
    player2: row.player_two_id ? playerIdByName.get(row.player_two_id) ?? 'Unknown player' : 'Unknown player',
    isTied: Boolean(row.is_tied),
    isHomebrew: Boolean(row.is_homebrew),
    isPlayer1Skip: Boolean(row.is_player_one_skip),
    isPlayer2Skip: Boolean(row.is_player_two_skip),
    player1Score: row.player_one_score,
    player2Score: row.player_two_score,
    player1Primary: row.player_one_primary,
    player2Primary: row.player_two_primary,
    player1Tac: row.player_one_tac,
    player2Tac: row.player_two_tac,
  }))
}

export async function createMatch(match: MatchRecord): Promise<MatchRecord> {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }

  const [{ data: mapRows }, { data: teamRows }, { data: playerRows }] = await Promise.all([
    supabase.from('maps').select('id, name').eq('name', match.map).maybeSingle(),
    supabase.from('teams').select('id, name'),
    supabase.from('players').select('id, name'),
  ])

  const mapRowsAny = (mapRows as any) ?? null
  const teamRowsAny = Array.isArray(teamRows) ? (teamRows as any[]) : []
  const playerRowsAny = Array.isArray(playerRows) ? (playerRows as any[]) : []

  const mapId = mapRowsAny?.id
  const teamIdByName = new Map(teamRowsAny.map((row) => [row.name, row.id]))
  const playerIdByName = new Map(playerRowsAny.map((row) => [row.name, row.id]))

  const payload: Record<string, unknown> = {
    date: match.date,
    map_id: mapId,
    team_one_id: teamIdByName.get(match.teamOne) ?? null,
    team_two_id: teamIdByName.get(match.teamTwo) ?? null,
    player_one_id: playerIdByName.get(match.player1) ?? null,
    player_two_id: playerIdByName.get(match.player2) ?? null,
    is_tied: match.isTied,
    is_homebrew: match.isHomebrew,
    is_player_one_skip: match.isPlayer1Skip,
    is_player_two_skip: match.isPlayer2Skip,
    player_one_score: match.player1Score ?? null,
    player_two_score: match.player2Score ?? null,
    player_one_primary: match.player1Primary ?? null,
    player_two_primary: match.player2Primary ?? null,
    player_one_tac: match.player1Tac ?? null,
    player_two_tac: match.player2Tac ?? null,
  }

  if (!mapId || !payload.player_one_id || !payload.player_two_id) {
    throw new Error('Match references unresolved map or player IDs.')
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
