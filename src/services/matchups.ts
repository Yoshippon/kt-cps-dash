import { hasSupabaseConfig, supabase } from '../lib/supabase'

export type OwnedMatchupTeam = {
  name: string
  isHomebrew: boolean
}

export async function fetchPlayerTeamOwnerships(): Promise<Map<string, OwnedMatchupTeam[]>> {
  if (!hasSupabaseConfig) return new Map()

  const [
    { data: playerRows, error: playerError },
    { data: teamRows, error: teamError },
    { data: ownershipRows, error: ownershipError },
  ] = await Promise.all([
    supabase.from('players').select('id, name'),
    supabase.from('kill_teams').select('id, name, is_homebrew'),
    supabase.from('player_team_ownership').select('player_id, team_id'),
  ])

  if (playerError || teamError || ownershipError) throw playerError ?? teamError ?? ownershipError

  const playerNameById = new Map(((playerRows as { id: string; name: string }[] | null) ?? []).map((player) => [player.id, player.name]))
  const teamById = new Map(((teamRows as { id: string; name: string; is_homebrew: boolean }[] | null) ?? []).map((team) => [team.id, {
    name: team.name,
    isHomebrew: team.is_homebrew,
  }]))
  const teamsByPlayer = new Map<string, OwnedMatchupTeam[]>()

  for (const ownership of (ownershipRows as { player_id: string; team_id: string }[] | null) ?? []) {
    const player = playerNameById.get(ownership.player_id)
    const team = teamById.get(ownership.team_id)
    if (!player || !team) continue
    teamsByPlayer.set(player, [...(teamsByPlayer.get(player) ?? []), team])
  }

  teamsByPlayer.forEach((teams, player) => teamsByPlayer.set(player, teams.sort((first, second) => first.name.localeCompare(second.name))))
  return teamsByPlayer
}
