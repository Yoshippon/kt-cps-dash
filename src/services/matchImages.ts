import { hasSupabaseConfig, supabase } from '../lib/supabase'
import type { MatchImageRow } from '../types/database'

export const MEDIA_BUCKET = 'media'
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export type MatchImage = {
  id: string
  matchId: string
  storagePath: string
  caption: string | null
  sortOrder: number
  url: string
}

const toMatchImage = (row: MatchImageRow): MatchImage => ({
  id: row.id,
  matchId: row.match_id,
  storagePath: row.storage_path,
  caption: row.caption,
  sortOrder: row.sort_order,
  url: supabase.storage.from(MEDIA_BUCKET).getPublicUrl(row.storage_path).data.publicUrl,
})

function validateImage(file: File) {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new Error(`${file.name} must be a JPEG, PNG, or WebP image.`)
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(`${file.name} exceeds 10 MB.`)
  }
}

function extensionForImage(file: File) {
  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/png') return 'png'
  return 'webp'
}

export async function fetchMatchImages(): Promise<MatchImage[]> {
  if (!hasSupabaseConfig) return []

  const { data, error } = await supabase
    .from('match_images')
    .select('id, match_id, storage_path, caption, sort_order')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error

  return ((data as MatchImageRow[] | null) ?? []).map(toMatchImage)
}

export async function uploadMatchImages(matchId: string, files: File[], uploadedBy: string): Promise<MatchImage[]> {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }
  if (files.length === 0) return []

  files.forEach(validateImage)
  const uploadedImages: MatchImage[] = []

  for (const file of files) {
    const storagePath = `matches/${matchId}/${crypto.randomUUID()}.${extensionForImage(file)}`
    const { error: uploadError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(storagePath, file, { cacheControl: '3600', contentType: file.type, upsert: false })

    if (uploadError) throw uploadError

    const { data, error: insertError } = await supabase
      .from('match_images')
      .insert({ match_id: matchId, storage_path: storagePath, uploaded_by: uploadedBy })
      .select('id, match_id, storage_path, caption, sort_order')
      .single()

    if (insertError) {
      const { error: removeError } = await supabase.storage.from(MEDIA_BUCKET).remove([storagePath])
      if (removeError) throw new Error(`${insertError.message} Image cleanup also failed: ${removeError.message}`)
      throw insertError
    }

    uploadedImages.push(toMatchImage(data as MatchImageRow))
  }

  return uploadedImages
}

export async function deleteMatchImage(image: MatchImage) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }

  const { error: storageError } = await supabase.storage.from(MEDIA_BUCKET).remove([image.storagePath])
  if (storageError) throw storageError

  const { error: databaseError } = await supabase.from('match_images').delete().eq('id', image.id)
  if (databaseError) throw databaseError
}
