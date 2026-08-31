import { hasSupabaseConfig, supabase } from '../lib/supabase'
import type { MapVoteSummaryRow, MeetingRow } from '../types/database'

export type MapVoteMeeting = {
  id: string
  meetingDate: string
  closesAt: string
  attendanceCount: number
  voteLimit: number
  mapCount: number
  attendeePlayerNames: string[]
  unavailablePlayerNames: string[]
  attendee: boolean
  attendanceResponse: boolean
  selectedMapIds: string[]
  maps: MapVoteSummaryRow[]
}

function requireSupabase() {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }
}

export async function fetchMapVoteMeeting(voterId: string): Promise<MapVoteMeeting> {
  requireSupabase()

  const { data: meetingData, error: meetingError } = await supabase.rpc('ensure_next_meeting')
  if (meetingError) throw meetingError
  const meeting = meetingData as MeetingRow | null
  if (!meeting) throw new Error('Supabase did not return an active meeting.')

  const [
    { data: summaryData, error: summaryError },
    { data: voterState, error: voterStateError },
  ] = await Promise.all([
    supabase.rpc('get_map_vote_summary', { p_meeting_id: meeting.id }),
    supabase.rpc('get_my_map_vote_state', { p_meeting_id: meeting.id, p_voter_id: voterId }),
  ])

  if (summaryError || voterStateError) throw summaryError ?? voterStateError

  const maps = (summaryData as MapVoteSummaryRow[] | null) ?? []
  const currentVoterState = Array.isArray(voterState)
    ? voterState[0]
    : null
  return {
    id: meeting.id,
    meetingDate: meeting.meeting_date,
    closesAt: meeting.closes_at,
    attendanceCount: maps[0]?.attendance_count ?? 0,
    voteLimit: maps[0]?.vote_limit ?? 2,
    mapCount: maps[0]?.map_count ?? 0,
    attendeePlayerNames: maps[0]?.attendee_player_names ?? [],
    unavailablePlayerNames: maps[0]?.unavailable_player_names ?? [],
    attendee: currentVoterState?.attendee ?? false,
    attendanceResponse: currentVoterState?.responded ?? false,
    selectedMapIds: currentVoterState?.selected_map_ids ?? [],
    maps,
  }
}

export async function setMapVoteAttendance(meetingId: string, voterId: string, attending: boolean) {
  requireSupabase()
  const { error } = await supabase.rpc('set_meeting_attendance', {
    p_meeting_id: meetingId,
    p_voter_id: voterId,
    p_attending: attending,
  })
  if (error) throw error
}

export async function replaceMapVotes(meetingId: string, voterId: string, mapIds: string[]) {
  requireSupabase()
  const { error } = await supabase.rpc('replace_map_votes', {
    p_meeting_id: meetingId,
    p_voter_id: voterId,
    p_map_ids: mapIds,
  })
  if (error) throw error
}
