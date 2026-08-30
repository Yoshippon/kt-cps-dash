export type MatchRow = {
  id: string
  date: string
  map: string
  team_one: string
  team_two: string
  player_one: string
  player_two: string
  is_tied: boolean
  is_homebrew: boolean
  is_player_one_skip: boolean
  is_player_two_skip: boolean
  player_one_score: number | null
  player_two_score: number | null
  player_one_primary: string | null
  player_two_primary: string | null
  player_one_tac: string | null
  player_two_tac: string | null
  created_at: string
  updated_at: string
}

export type MatchInsert = Omit<MatchRow, 'id' | 'created_at' | 'updated_at'>
export type MatchUpdate = Partial<MatchInsert>

export type MapRow = {
  id: string
  name: string
  category: string
  created_at: string
  updated_at: string
}

export type Database = {
  public: {
    Tables: {
      matches: {
        Row: MatchRow
        Insert: MatchInsert
        Update: MatchUpdate
      }
      maps: {
        Row: MapRow
        Insert: Omit<MapRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<MapRow, 'id' | 'created_at' | 'updated_at'>>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
