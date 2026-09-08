import { hasSupabaseConfig, supabase } from '../lib/supabase'
import { MEDIA_BUCKET } from './matchImages'
import type { KillTeamRow, PlayerProfileRow, PlayerRow, PlayerTeamImageRow } from '../types/database'

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const TEAM_LOGO_FILES: Record<string, string> = {
  'Angels of Death': 'angels_of_death.png',
  Battleclade: 'battleclade.png',
  'Blades of Khaine': 'blades_of_khaine.png',
  Blooded: 'blooded.png',
  'Brood Brothers': 'brood_brothers.png',
  'Canoptek Circle': 'canoptek_circle.png',
  'Celestial Insidiants': 'celestian_insidiants.png',
  'Chaos Cult': 'chaos_cult.png',
  'Corsair Voidscarred': 'corsair_voidscarred.png',
  'Death Korps': 'death_korps.png',
  Deathwatch: 'deathwatch.png',
  'Elucidian Starstriders': 'elucidian_starstriders.png',
  'Exaction Squad': 'exaction_squad.png',
  Exodites: 'exodite_dragon_masters.png',
  'Farstalker Kinband': 'farstalker_kinband.png',
  'Fellgor Ravagers': 'fellgor_ravagers.png',
  'Gellerpox Infected': 'gellerpox_infected.png',
  Goremongers: 'goremongers.png',
  'Hand of the Archon': 'hand_of_the_archon.png',
  'Hearthkyn Salvagers': 'hearthkyn_salvagers.png',
  'Hernkyn Yaegirs': 'hernkyn_yaegirs.png',
  'Hierotek Circle': 'hierotek_circle.png',
  'Hunter Clade': 'hunter_clade.png',
  'Imperial Navy Breachers': 'imperial_navy_breachers.png',
  'Inquisitorial Agents': 'inquisitorial_agents.png',
  Kasrkin: 'kasrkin.png',
  Kommandos: 'kommandos.png',
  Legionaries: 'legionaries.png',
  Mandrakes: 'mandrakes.png',
  Murderwing: 'murderwing.png',
  'Nemesis Claw': 'nemesis_claw.png',
  Novitiates: 'novitiates.png',
  Pathfinders: 'pathfinders.png',
  'Phobos Strike Team': 'phobos_strike_team.png',
  'Plague Marines': 'plague_marines.png',
  Ratlings: 'ratlings.png',
  Raveners: 'raveners.png',
  Sanctifiers: 'sanctifiers.png',
  'Scout Squad': 'scout_squad.png',
  Spectres: 'spectre_squad.png',
  'Strike Force Variel': 'angels_of_death.png',
  'Tempestus Aquilons': 'tempestus_aquilons.png',
  'Vespid Stingwings': 'vespid_stingwings.png',
  'Void-dancer Troupe': 'void_dancer_troupe.png',
  Warpcoven: 'warpcoven.png',
  'Wolf Scouts': 'wolf_scouts.png',
  'Wrecka Crew': 'wrecka_krew.png',
  Wyrmblade: 'wyrmblade.png',
  'XV26 Stealth Battlesuits': 'xv26_stealth_battlesuits.png',
}

export type ProfileImage = {
  id: string
  storagePath: string
  url: string
}

export type OwnedTeam = {
  id: string
  name: string
  images: ProfileImage[]
}

export type PlayerProfile = {
  avatarPath: string | null
  avatarUrl: string | null
}

export type TeamLogoImport = {
  uploaded: number
  missing: string[]
}

const publicUrl = (storagePath: string) => supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath).data.publicUrl

const extensionForImage = (file: File) => {
  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/png') return 'png'
  return 'webp'
}

const validateImage = (file: File) => {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) throw new Error(`${file.name} must be a JPEG, PNG, or WebP image.`)
  if (file.size > MAX_IMAGE_SIZE_BYTES) throw new Error(`${file.name} exceeds 10 MB.`)
}

const requireSupabase = () => {
  if (!hasSupabaseConfig) throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
}

export async function fetchProfile(playerId: string): Promise<PlayerProfile> {
  requireSupabase()

  const { data, error } = await supabase.from('player_profiles').select('avatar_path').eq('player_id', playerId).maybeSingle()
  if (error) throw error

  const profile = data as Pick<PlayerProfileRow, 'avatar_path'> | null
  return { avatarPath: profile?.avatar_path ?? null, avatarUrl: profile?.avatar_path ? publicUrl(profile.avatar_path) : null }
}

export async function fetchPlayer(playerId: string): Promise<PlayerRow | null> {
  requireSupabase()

  const { data, error } = await supabase.from('players').select('id, name, user_id, is_admin, created_at, updated_at').eq('id', playerId).maybeSingle()
  if (error) throw error
  return data as PlayerRow | null
}

export async function uploadAvatar(playerId: string, userId: string, previousAvatarPath: string | null, file: File): Promise<PlayerProfile> {
  requireSupabase()
  validateImage(file)

  const storagePath = `profiles/${userId}/${crypto.randomUUID()}.${extensionForImage(file)}`
  const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(storagePath, file, { cacheControl: '3600', contentType: file.type, upsert: false })
  if (uploadError) throw uploadError

  const { error: profileError } = await supabase.from('player_profiles').upsert({ player_id: playerId, avatar_path: storagePath })
  if (profileError) {
    const { error: removeError } = await supabase.storage.from(MEDIA_BUCKET).remove([storagePath])
    if (removeError) throw new Error(`${profileError.message} Image cleanup also failed: ${removeError.message}`)
    throw profileError
  }

  if (previousAvatarPath) {
    const { error: removeError } = await supabase.storage.from(MEDIA_BUCKET).remove([previousAvatarPath])
    if (removeError) throw removeError
  }

  return { avatarPath: storagePath, avatarUrl: publicUrl(storagePath) }
}

export async function fetchTeamOptions(): Promise<KillTeamRow[]> {
  requireSupabase()
  const { data, error } = await supabase.from('kill_teams').select('id, name, description, created_at, updated_at').order('name', { ascending: true })
  if (error) throw error
  return (data as KillTeamRow[] | null) ?? []
}

export async function importTeamLogos(): Promise<TeamLogoImport> {
  requireSupabase()

  const { data, error } = await supabase.from('kill_teams').select('id, name')
  if (error) throw error

  const missing: string[] = []
  let uploaded = 0

  for (const team of (data as Pick<KillTeamRow, 'id' | 'name'>[] | null) ?? []) {
    const fileName = TEAM_LOGO_FILES[team.name]
    if (!fileName) {
      missing.push(team.name)
      continue
    }

    const response = await fetch(`/${fileName}`)
    if (!response.ok) throw new Error(`Could not read ${fileName} for ${team.name}.`)

    const storagePath = `team-logos/${team.id}.png`
    const { error: uploadError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(storagePath, await response.blob(), { cacheControl: '3600', contentType: 'image/png', upsert: true })
    if (uploadError) throw uploadError

    const { error: updateError } = await supabase.from('kill_teams').update({ logo_path: storagePath }).eq('id', team.id)
    if (updateError) throw updateError

    uploaded += 1
  }

  return { uploaded, missing }
}

export async function fetchOwnedTeams(playerId: string): Promise<OwnedTeam[]> {
  requireSupabase()

  const [
    { data: ownershipRows, error: ownershipError },
    { data: teamRows, error: teamError },
    { data: imageRows, error: imageError },
  ] = await Promise.all([
    supabase.from('player_team_ownership').select('team_id').eq('player_id', playerId),
    supabase.from('kill_teams').select('id, name'),
    supabase.from('player_team_images').select('id, team_id, storage_path').eq('player_id', playerId).order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
  ])
  if (ownershipError || teamError || imageError) throw ownershipError ?? teamError ?? imageError

  const teamIds = new Set(((ownershipRows as { team_id: string }[] | null) ?? []).map((row) => row.team_id))
  const imagesByTeamId = new Map<string, ProfileImage[]>()
  ;((imageRows as Pick<PlayerTeamImageRow, 'id' | 'team_id' | 'storage_path'>[] | null) ?? []).forEach((image) => {
    const images = imagesByTeamId.get(image.team_id) ?? []
    images.push({ id: image.id, storagePath: image.storage_path, url: publicUrl(image.storage_path) })
    imagesByTeamId.set(image.team_id, images)
  })

  return ((teamRows as Pick<KillTeamRow, 'id' | 'name'>[] | null) ?? [])
    .filter((team) => teamIds.has(team.id))
    .map((team) => ({ ...team, images: imagesByTeamId.get(team.id) ?? [] }))
}

export async function addOwnedTeam(playerId: string, teamId: string) {
  requireSupabase()
  const { error } = await supabase.from('player_team_ownership').insert({ player_id: playerId, team_id: teamId })
  if (error) throw error
}

export async function removeOwnedTeam(playerId: string, team: OwnedTeam) {
  requireSupabase()
  if (team.images.length > 0) {
    const { error: storageError } = await supabase.storage.from(MEDIA_BUCKET).remove(team.images.map((image) => image.storagePath))
    if (storageError) throw storageError
  }
  const { error } = await supabase.from('player_team_ownership').delete().eq('player_id', playerId).eq('team_id', team.id)
  if (error) throw error
}

export async function uploadTeamImages(playerId: string, teamId: string, files: File[]): Promise<ProfileImage[]> {
  requireSupabase()
  if (files.length === 0) return []
  files.forEach(validateImage)

  const images: ProfileImage[] = []
  for (const file of files) {
    const storagePath = `player-teams/${playerId}/${teamId}/${crypto.randomUUID()}.${extensionForImage(file)}`
    const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(storagePath, file, { cacheControl: '3600', contentType: file.type, upsert: false })
    if (uploadError) throw uploadError

    const { data, error: imageError } = await supabase.from('player_team_images')
      .insert({ player_id: playerId, team_id: teamId, storage_path: storagePath })
      .select('id, storage_path')
      .single()
    if (imageError) {
      const { error: removeError } = await supabase.storage.from(MEDIA_BUCKET).remove([storagePath])
      if (removeError) throw new Error(`${imageError.message} Image cleanup also failed: ${removeError.message}`)
      throw imageError
    }

    const image = data as Pick<PlayerTeamImageRow, 'id' | 'storage_path'>
    images.push({ id: image.id, storagePath: image.storage_path, url: publicUrl(image.storage_path) })
  }
  return images
}

export async function deleteTeamImage(image: ProfileImage) {
  requireSupabase()
  const { error: storageError } = await supabase.storage.from(MEDIA_BUCKET).remove([image.storagePath])
  if (storageError) throw storageError
  const { error } = await supabase.from('player_team_images').delete().eq('id', image.id)
  if (error) throw error
}
