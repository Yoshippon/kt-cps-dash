import { hasSupabaseConfig, supabase } from '../lib/supabase'
import type { MatchRow } from '../types/database'
import { fetchMatchImages, MEDIA_BUCKET, type MatchImage } from './matchImages'

export type MatchRecord = {
  id?: string
  matchId: string | null
  date: string
  map: string
  teamOne: string
  teamTwo: string
  player1: string
  player2: string
  player1AvatarUrl?: string
  player2AvatarUrl?: string
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
  critOp?: string | null
  images: MatchImage[]
}

export type MatchFormOptions = {
  maps: string[]
  teams: string[]
  players: string[]
  critOps: string[]
  tacOps: TacOpOption[]
}

export type TacOpOption = {
  name: string
  archetype: string
}

export async function fetchMatches(): Promise<MatchRecord[]> {
  if (!hasSupabaseConfig) return []

  const [
    { data: matchRows, error: matchError },
    { data: mapRows, error: mapError },
    { data: playerRows, error: playerError },
    { data: profileRows, error: profileError },
    { data: teamRows, error: teamError },
    { data: critOpRows, error: critOpError },
    images,
  ] = await Promise.all([
    supabase.from('matches').select('id, match_id, date, map_id, team_one_id, team_two_id, player_one_id, player_two_id, is_tied, is_homebrew, is_player_one_skip, is_player_two_skip, player_one_score, player_two_score, player_one_primary, player_two_primary, player_one_tac, player_two_tac, crit_op_id').order('date', { ascending: false }),
    supabase.from('maps').select('id, name'),
    supabase.from('players').select('id, name'),
    supabase.from('player_profiles').select('player_id, avatar_path'),
    supabase.from('teams').select('id, name'),
    supabase.from('crit_ops').select('id, name'),
    fetchMatchImages(),
  ])

  if (matchError || mapError || playerError || profileError || teamError || critOpError) throw matchError ?? mapError ?? playerError ?? profileError ?? teamError ?? critOpError

  const mapRowsAny = Array.isArray(mapRows) ? (mapRows as any[]) : []
  const playerRowsAny = Array.isArray(playerRows) ? (playerRows as any[]) : []
  const profileRowsAny = Array.isArray(profileRows) ? (profileRows as { player_id: string; avatar_path: string | null }[]) : []
  const teamRowsAny = Array.isArray(teamRows) ? (teamRows as any[]) : []
  const critOpRowsAny = Array.isArray(critOpRows) ? (critOpRows as any[]) : []
  const rows = Array.isArray(matchRows) ? (matchRows as any[]) : []

  const mapIdByName = new Map(mapRowsAny.map((row) => [row.id, row.name]))
  const playerIdByName = new Map(playerRowsAny.map((row) => [row.id, row.name]))
  const playerAvatarUrlById = new Map(profileRowsAny
    .filter((profile) => profile.avatar_path)
    .map((profile) => [profile.player_id, supabase.storage.from(MEDIA_BUCKET).getPublicUrl(profile.avatar_path!).data.publicUrl]))
  const teamIdByName = new Map(teamRowsAny.map((row) => [row.id, row.name]))
  const critOpIdByName = new Map(critOpRowsAny.map((row) => [row.id, row.name]))
  const imagesByMatchId = new Map<string, MatchImage[]>()
  images.forEach((image) => {
    const matchImages = imagesByMatchId.get(image.matchId) ?? []
    matchImages.push(image)
    imagesByMatchId.set(image.matchId, matchImages)
  })

  return rows.map((row: any) => ({
    id: row.id,
    matchId: row.match_id ?? null,
    date: row.date,
    map: row.map_id ? mapIdByName.get(row.map_id) ?? 'Unknown map' : 'Unknown map',
    teamOne: row.team_one_id ? teamIdByName.get(row.team_one_id) ?? 'Unknown team' : 'Unknown team',
    teamTwo: row.team_two_id ? teamIdByName.get(row.team_two_id) ?? 'Unknown team' : 'Unknown team',
    player1: row.player_one_id ? playerIdByName.get(row.player_one_id) ?? 'Unknown player' : 'Unknown player',
    player2: row.player_two_id ? playerIdByName.get(row.player_two_id) ?? 'Unknown player' : 'Unknown player',
    player1AvatarUrl: row.player_one_id ? playerAvatarUrlById.get(row.player_one_id) : undefined,
    player2AvatarUrl: row.player_two_id ? playerAvatarUrlById.get(row.player_two_id) : undefined,
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
    critOp: row.crit_op_id ? critOpIdByName.get(row.crit_op_id) ?? null : null,
    images: imagesByMatchId.get(row.id) ?? [],
  }))
}

export async function fetchMatchFormOptions(): Promise<MatchFormOptions> {
  if (!hasSupabaseConfig) return { maps: [], teams: [], players: [], critOps: [], tacOps: [] }

  const [
    { data: mapRows, error: mapError },
    { data: teamRows, error: teamError },
    { data: playerRows, error: playerError },
    { data: latestOpsPack, error: opsPackError },
  ] = await Promise.all([
    supabase.from('maps').select('name').order('name', { ascending: true }),
    supabase.from('teams').select('name').order('name', { ascending: true }),
    supabase.from('players').select('name').order('name', { ascending: true }),
    supabase.from('approved_ops_packs').select('id').order('year', { ascending: false }).limit(1).maybeSingle(),
  ])

  if (mapError || teamError || playerError || opsPackError) throw mapError ?? teamError ?? playerError ?? opsPackError

  const formOptions = {
    maps: (mapRows as any[] ?? []).map((row) => row.name),
    teams: (teamRows as any[] ?? []).map((row) => row.name),
    players: (playerRows as any[] ?? []).map((row) => row.name),
  }

  const latestOpsPackRow = latestOpsPack as { id: string } | null
  if (!latestOpsPackRow) return { ...formOptions, critOps: [], tacOps: [] }

  const [
    { data: critOpRows, error: critOpError },
    { data: tacOpRows, error: tacOpError },
  ] = await Promise.all([
    supabase
      .from('crit_ops')
      .select('name')
      .or(`approved_ops_pack_id.is.null,approved_ops_pack_id.eq.${latestOpsPackRow.id}`)
      .order('number', { ascending: true }),
    supabase
      .from('tac_ops')
      .select('name, archetype:tac_op_archetypes(name)')
      .eq('approved_ops_pack_id', latestOpsPackRow.id)
      .order('number', { ascending: true }),
  ])

  if (critOpError || tacOpError) throw critOpError ?? tacOpError

  return {
    ...formOptions,
    critOps: (critOpRows as any[] ?? []).map((row) => row.name),
    tacOps: (tacOpRows as any[] ?? []).map((row) => ({
      name: row.name,
      archetype: row.archetype?.name ?? 'Other',
    })),
  }
}

export async function createMatch(match: MatchRecord): Promise<MatchRecord> {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }

  const playerOneName = match.player1.trim()
  const playerTwoName = match.player2.trim()
  if (!playerOneName || !playerTwoName) {
    throw new Error('Both players are required.')
  }

  const [
    { data: mapRow, error: mapError },
    { data: teamRows, error: teamError },
    { data: playerRows, error: playerError },
    { data: critOpRow, error: critOpError },
  ] = await Promise.all([
    supabase.from('maps').select('id, name').eq('name', match.map).maybeSingle(),
    supabase.from('teams').select('id, name'),
    supabase.from('players').select('id, name'),
    match.critOp
      ? supabase.from('crit_ops').select('id, name').eq('name', match.critOp).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (mapError || teamError || playerError || critOpError) {
    throw mapError ?? teamError ?? playerError ?? critOpError
  }

  const teamRowsAny = Array.isArray(teamRows) ? (teamRows as any[]) : []
  const playerRowsAny = Array.isArray(playerRows) ? (playerRows as any[]) : []

  const mapId = (mapRow as any)?.id
  const critOpId = (critOpRow as any)?.id ?? null
  const teamIdByName = new Map(teamRowsAny.map((row) => [row.name, row.id]))
  const playerRowByName = new Map(playerRowsAny.map((row) => [row.name.toLocaleLowerCase(), row]))
  const missingPlayerNames = [...new Set([playerOneName, playerTwoName].filter((name) => !playerRowByName.has(name.toLocaleLowerCase())))]

  const createdPlayers = await Promise.all(missingPlayerNames.map(async (name) => {
    const { data, error } = await supabase
      .from('players')
      .insert({ name })
      .select('id, name')
      .single()

    if (error) throw error
    return data as { id: string; name: string }
  }))
  createdPlayers.forEach((createdPlayer) => playerRowByName.set(createdPlayer.name.toLocaleLowerCase(), createdPlayer))

  const playerOne = playerRowByName.get(playerOneName.toLocaleLowerCase())
  const playerTwo = playerRowByName.get(playerTwoName.toLocaleLowerCase())

  const payload: Record<string, unknown> = {
    match_id: match.matchId ?? `match-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: match.date,
    map_id: mapId,
    team_one_id: teamIdByName.get(match.teamOne) ?? null,
    team_two_id: teamIdByName.get(match.teamTwo) ?? null,
    player_one_id: playerOne?.id ?? null,
    player_two_id: playerTwo?.id ?? null,
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
    crit_op_id: critOpId,
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

  return {
    ...match,
    id: row.id,
    matchId: row.match_id,
    player1: playerOne?.name ?? playerOneName,
    player2: playerTwo?.name ?? playerTwoName,
    images: [],
  }
}

export async function updateMatch(match: MatchRecord): Promise<MatchRecord> {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }
  if (!match.id) {
    throw new Error('Cannot update a match without an id.')
  }

  const [
    { data: mapRow },
    { data: teamRows },
    { data: playerRows },
    { data: critOpRow },
  ] = await Promise.all([
    supabase.from('maps').select('id, name').eq('name', match.map).maybeSingle(),
    supabase.from('teams').select('id, name'),
    supabase.from('players').select('id, name'),
    match.critOp
      ? supabase.from('crit_ops').select('id, name').eq('name', match.critOp).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  const teamRowsAny = Array.isArray(teamRows) ? (teamRows as any[]) : []
  const playerRowsAny = Array.isArray(playerRows) ? (playerRows as any[]) : []
  const teamIdByName = new Map(teamRowsAny.map((row) => [row.name, row.id]))
  const playerIdByName = new Map(playerRowsAny.map((row) => [row.name, row.id]))

  const mapId = (mapRow as any)?.id
  const critOpId = (critOpRow as any)?.id ?? null

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
    crit_op_id: critOpId,
  }

  if (!mapId || !payload.player_one_id || !payload.player_two_id) {
    throw new Error('Match references unresolved map or player IDs.')
  }

  const { error } = await (supabase.from('matches') as any)
    .update(payload)
    .eq('id', match.id)

  if (error) throw error

  return match
}
