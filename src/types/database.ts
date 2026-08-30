export type MatchRow = {
  id: string
  match_id: string
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
  crit_op_id: string | null
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

export type CritOpRow = {
  id: string
  number: number
  name: string
  approved_ops_pack_id: string | null
  description: string | null
  created_at: string
  updated_at: string
}

export type ApprovedOpsPackRow = {
  id: string
  year: number
  name: string
  created_at: string
  updated_at: string
}

export type PlayerRow = {
  id: string
  name: string
  user_id: string | null
  is_admin: boolean
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
      players: {
        Row: PlayerRow
        Insert: Omit<PlayerRow, 'id' | 'created_at' | 'updated_at' | 'is_admin' | 'user_id'> & Partial<Pick<PlayerRow, 'is_admin' | 'user_id'>>
        Update: Partial<Omit<PlayerRow, 'id' | 'created_at' | 'updated_at'>>
      }
      maps: {
        Row: MapRow
        Insert: Omit<MapRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<MapRow, 'id' | 'created_at' | 'updated_at'>>
      }
      crit_ops: {
        Row: CritOpRow
        Insert: Omit<CritOpRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<CritOpRow, 'id' | 'created_at' | 'updated_at'>>
      }
      approved_ops_packs: {
        Row: ApprovedOpsPackRow
        Insert: Omit<ApprovedOpsPackRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ApprovedOpsPackRow, 'id' | 'created_at' | 'updated_at'>>
      }
    }
    Views: Record<string, never>
    Functions: {
      generate_claim_token: {
        Args: { p_player_id: string }
        Returns: string
      }
      claim_player: {
        Args: { p_token: string }
        Returns: PlayerRow
      }
    }
    Enums: Record<string, never>
  }
}
