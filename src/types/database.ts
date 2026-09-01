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

export type MatchImageRow = {
  id: string
  match_id: string
  storage_path: string
  caption: string | null
  sort_order: number
  uploaded_by: string | null
  created_at: string
}

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

export type PlayerProfileRow = {
  player_id: string
  avatar_path: string | null
  created_at: string
  updated_at: string
}

export type TeamRow = {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export type PlayerTeamOwnershipRow = {
  player_id: string
  team_id: string
}

export type PlayerMapOwnershipRow = {
  player_id: string
  map_id: string
}

export type PlayerTeamImageRow = {
  id: string
  player_id: string
  team_id: string
  storage_path: string
  caption: string | null
  sort_order: number
  created_at: string
}

export type MeetingRow = {
  id: string
  meeting_date: string
  opens_at: string
  closes_at: string
  created_at: string
}

export type MeetingAttendeeRow = {
  meeting_id: string
  voter_id: string
  voter_kind: 'anonymous' | 'registered'
  player_id: string | null
  is_attending: boolean
  created_at: string
}

export type MapVoteRow = {
  meeting_id: string
  voter_id: string
  map_id: string
  rank: number
  voter_kind: 'anonymous' | 'registered'
  player_id: string | null
  created_at: string
}

export type MapVoteSummaryRow = {
  map_id: string
  map_name: string
  total_votes: number
  registered_votes: number
  anonymous_votes: number
  voter_names: string[]
  attendee_player_names: string[]
  unavailable_player_names: string[]
  unavailable_player_ids: string[]
  attendance_count: number
  vote_limit: number
  map_count: number
}

export type Database = {
  public: {
    Tables: {
      matches: {
        Row: MatchRow
        Insert: MatchInsert
        Update: MatchUpdate
        Relationships: []
      }
      match_images: {
        Row: MatchImageRow
        Insert: Omit<MatchImageRow, 'id' | 'created_at' | 'caption' | 'sort_order' | 'uploaded_by'> & Partial<Pick<MatchImageRow, 'caption' | 'sort_order' | 'uploaded_by'>>
        Update: Partial<Omit<MatchImageRow, 'id' | 'created_at' | 'match_id' | 'storage_path' | 'uploaded_by'>>
        Relationships: []
      }
      players: {
        Row: PlayerRow
        Insert: Omit<PlayerRow, 'id' | 'created_at' | 'updated_at' | 'is_admin' | 'user_id'> & Partial<Pick<PlayerRow, 'is_admin' | 'user_id'>>
        Update: Partial<Omit<PlayerRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      player_profiles: {
        Row: PlayerProfileRow
        Insert: Omit<PlayerProfileRow, 'created_at' | 'updated_at'> & Partial<Pick<PlayerProfileRow, 'avatar_path'>>
        Update: Partial<Omit<PlayerProfileRow, 'player_id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      maps: {
        Row: MapRow
        Insert: Omit<MapRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<MapRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      teams: {
        Row: TeamRow
        Insert: Omit<TeamRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<TeamRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      player_team_ownership: {
        Row: PlayerTeamOwnershipRow
        Insert: PlayerTeamOwnershipRow
        Update: never
        Relationships: []
      }
      player_map_ownership: {
        Row: PlayerMapOwnershipRow
        Insert: PlayerMapOwnershipRow
        Update: never
        Relationships: []
      }
      player_team_images: {
        Row: PlayerTeamImageRow
        Insert: Omit<PlayerTeamImageRow, 'id' | 'created_at' | 'caption' | 'sort_order'> & Partial<Pick<PlayerTeamImageRow, 'caption' | 'sort_order'>>
        Update: Partial<Omit<PlayerTeamImageRow, 'id' | 'created_at' | 'player_id' | 'team_id' | 'storage_path'>>
        Relationships: []
      }
      meetings: {
        Row: MeetingRow
        Insert: Omit<MeetingRow, 'id' | 'created_at'>
        Update: Partial<Omit<MeetingRow, 'id' | 'created_at' | 'meeting_date'>>
        Relationships: []
      }
      meeting_attendees: {
        Row: MeetingAttendeeRow
        Insert: Omit<MeetingAttendeeRow, 'voter_kind' | 'player_id' | 'created_at'>
        Update: never
        Relationships: []
      }
      map_votes: {
        Row: MapVoteRow
        Insert: Omit<MapVoteRow, 'voter_kind' | 'player_id' | 'created_at'>
        Update: never
        Relationships: []
      }
      crit_ops: {
        Row: CritOpRow
        Insert: Omit<CritOpRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<CritOpRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      approved_ops_packs: {
        Row: ApprovedOpsPackRow
        Insert: Omit<ApprovedOpsPackRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ApprovedOpsPackRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
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
      ensure_next_meeting: {
        Args: Record<string, never>
        Returns: MeetingRow
      }
      get_map_vote_summary: {
        Args: { p_meeting_id: string }
        Returns: MapVoteSummaryRow[]
      }
      replace_map_votes: {
        Args: { p_meeting_id: string; p_map_ids: string[]; p_voter_id: string }
        Returns: undefined
      }
      get_my_map_vote_state: {
        Args: { p_meeting_id: string; p_voter_id: string }
        Returns: { attendee: boolean; responded: boolean; selected_map_ids: string[] }[]
      }
      set_meeting_attendance: {
        Args: { p_meeting_id: string; p_attending: boolean; p_voter_id: string }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
  }
}
