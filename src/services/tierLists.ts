import { hasSupabaseConfig, supabase } from '../lib/supabase'
import { MEDIA_BUCKET } from './matchImages'
import type { TierListEntryRow, TierListRow } from '../types/database'

export const TIERS = ['S', 'A', 'B', 'C', 'D'] as const
export type Tier = typeof TIERS[number]
export type TierLabels = Record<Tier, string>
export const DEFAULT_TIER_LABELS: TierLabels = { S: 'S', A: 'A', B: 'B', C: 'C', D: 'D' }
export const AUTOMATIC_TIER_LIST_ID = 'community-win-rate'
export const AUTOMATIC_TIER_LABELS: TierLabels = {
  S: 'S (80-100%)',
  A: 'A (60-80%)',
  B: 'B (40-60%)',
  C: 'C (20-40%)',
  D: 'D (0-20%)',
}

export type TierListSummary = TierListRow & {
  ownerName: string
}

export type TierListTeam = {
  id: string
  name: string
  logoUrl: string | null
  isClassified: boolean
  games?: number
  wins?: number
  draws?: number
  losses?: number
  winRate?: number
}

export type TierListPlacement = {
  teamId: string
  tier: Tier
  position: number
}

export type AutomaticTierList = {
  teams: TierListTeam[]
  placements: TierListPlacement[]
}

const requireSupabase = () => {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }
}

const logoUrl = (path: string | null) => path
  ? supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl
  : null

export async function fetchTierLists(): Promise<TierListSummary[]> {
  if (!hasSupabaseConfig) return []

  const [{ data: listRows, error: listError }, { data: playerRows, error: playerError }] = await Promise.all([
    supabase.from('tier_lists').select('id, owner_id, name, includes_non_classified, tier_labels, created_at, updated_at').order('created_at', { ascending: false }),
    supabase.from('players').select('id, name'),
  ])
  if (listError || playerError) throw listError ?? playerError

  const ownerNameById = new Map(((playerRows as { id: string; name: string }[] | null) ?? [])
    .map((player) => [player.id, player.name]))

  return ((listRows as TierListRow[] | null) ?? []).map((list) => ({
    ...list,
    ownerName: ownerNameById.get(list.owner_id) ?? 'Unknown player',
  }))
}

export async function fetchTierListPlacements(tierListId: string): Promise<TierListPlacement[]> {
  requireSupabase()
  const { data, error } = await supabase
    .from('tier_list_entries')
    .select('tier_list_id, team_id, tier, position')
    .eq('tier_list_id', tierListId)
    .order('tier', { ascending: true })
    .order('position', { ascending: true })
  if (error) throw error

  return ((data as TierListEntryRow[] | null) ?? []).map((entry) => ({
    teamId: entry.team_id,
    tier: entry.tier,
    position: entry.position,
  }))
}

export async function fetchTierListTeams(includesNonClassified: boolean): Promise<TierListTeam[]> {
  requireSupabase()
  let query = supabase
    .from('kill_teams')
    .select('id, name, logo_path, is_classified, is_homebrew')
    .eq('is_homebrew', false)
    .order('name', { ascending: true })

  if (!includesNonClassified) query = query.eq('is_classified', true)

  const { data, error } = await query
  if (error) throw error

  return ((data as Array<{ id: string; name: string; logo_path: string | null; is_classified: boolean; is_homebrew: boolean }> | null) ?? [])
    .map((team) => ({
      id: team.id,
      name: team.name,
      logoUrl: logoUrl(team.logo_path),
      isClassified: team.is_classified,
    }))
}

const tierForWinRate = (winRate: number): Tier => {
  if (winRate >= 80) return 'S'
  if (winRate >= 60) return 'A'
  if (winRate >= 40) return 'B'
  if (winRate >= 20) return 'C'
  return 'D'
}

export async function fetchAutomaticTierList(): Promise<AutomaticTierList> {
  requireSupabase()

  const [{ data: teamRows, error: teamError }, { data: matchRows, error: matchError }] = await Promise.all([
    supabase
      .from('kill_teams')
      .select('id, name, logo_path, is_classified, is_homebrew')
      .order('name', { ascending: true }),
    (supabase.from('matches') as any)
      .select('team_one_id, team_two_id, is_tied, is_homebrew'),
  ])
  if (teamError || matchError) throw teamError ?? matchError

  type TeamRow = { id: string; name: string; logo_path: string | null; is_classified: boolean; is_homebrew: boolean }
  type MatchRow = { team_one_id: string | null; team_two_id: string | null; is_tied: boolean; is_homebrew: boolean }
  const teamsById = new Map(((teamRows as TeamRow[] | null) ?? []).map((team) => [team.id, team]))
  const statsByTeamId = new Map<string, { games: number; wins: number; draws: number; losses: number }>()

  for (const match of (matchRows as MatchRow[] | null) ?? []) {
    if (match.is_homebrew || !match.team_one_id || !match.team_two_id || match.team_one_id === match.team_two_id) continue
    if (!teamsById.has(match.team_one_id) || !teamsById.has(match.team_two_id)) continue

    const first = statsByTeamId.get(match.team_one_id) ?? { games: 0, wins: 0, draws: 0, losses: 0 }
    const second = statsByTeamId.get(match.team_two_id) ?? { games: 0, wins: 0, draws: 0, losses: 0 }
    first.games += 1
    second.games += 1
    if (match.is_tied) {
      first.draws += 1
      second.draws += 1
    } else {
      first.wins += 1
      second.losses += 1
    }
    statsByTeamId.set(match.team_one_id, first)
    statsByTeamId.set(match.team_two_id, second)
  }

  const rankedTeams = [...statsByTeamId.entries()].map(([teamId, stats]) => {
    const team = teamsById.get(teamId)!
    const winRate = (stats.wins + stats.draws * .5) / stats.games * 100
    return {
      id: team.id,
      name: team.name,
      logoUrl: logoUrl(team.logo_path),
      isClassified: team.is_classified,
      ...stats,
      winRate,
      tier: tierForWinRate(winRate),
    }
  }).sort((first, second) => (
    TIERS.indexOf(first.tier) - TIERS.indexOf(second.tier)
    || second.winRate - first.winRate
    || second.games - first.games
    || first.name.localeCompare(second.name)
  ))

  const positionsByTier: Record<Tier, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 }
  return {
    teams: rankedTeams,
    placements: rankedTeams.map((team) => ({
      teamId: team.id,
      tier: team.tier,
      position: positionsByTier[team.tier]++,
    })),
  }
}

export async function createTierList(name: string, includesNonClassified: boolean): Promise<TierListRow> {
  requireSupabase()
  const { data, error } = await supabase.rpc('create_tier_list', {
    p_name: name.trim() || null,
    p_includes_non_classified: includesNonClassified,
  })
  if (error) throw error
  if (!data) throw new Error('No tier list was returned after creation.')
  return data as TierListRow
}

export async function saveTierList(tierListId: string, placements: TierListPlacement[], tierLabels: TierLabels) {
  requireSupabase()
  const { error } = await supabase.rpc('save_tier_list', {
    p_tier_list_id: tierListId,
    p_entries: placements.map((placement) => ({
      team_id: placement.teamId,
      tier: placement.tier,
      position: placement.position,
    })),
    p_tier_labels: tierLabels,
  })
  if (error) throw error
}
