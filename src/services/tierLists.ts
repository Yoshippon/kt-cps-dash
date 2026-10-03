import { hasSupabaseConfig, supabase } from '../lib/supabase'
import { MEDIA_BUCKET } from './matchImages'
import type { TierListEntryRow, TierListRow } from '../types/database'

export const TIERS = ['S', 'A', 'B', 'C', 'D'] as const
export type Tier = typeof TIERS[number]
export type TierLabels = Record<Tier, string>
export const DEFAULT_TIER_LABELS: TierLabels = { S: 'S', A: 'A', B: 'B', C: 'C', D: 'D' }

export type TierListSummary = TierListRow & {
  ownerName: string
}

export type TierListTeam = {
  id: string
  name: string
  logoUrl: string | null
  isClassified: boolean
}

export type TierListPlacement = {
  teamId: string
  tier: Tier
  position: number
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
