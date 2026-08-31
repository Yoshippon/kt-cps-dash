import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useAuth } from '../lib/auth'
import { hasSupabaseConfig } from '../lib/supabase'
import { fetchMapVoteMeeting, replaceMapVotes, setMapVoteAttendance, type MapVoteMeeting } from '../services/mapVotes'

type MapVotingProps = {
  onAttendanceChange: (playerNames: string[], attendeeCount: number) => void
  onWinningMapsChange: (mapNames: string[]) => void
}

type VoteMapStyle = CSSProperties & { '--vote-share': string }

function MapVoting({ onAttendanceChange, onWinningMapsChange }: MapVotingProps) {
  const { loading: authLoading, session, isAdmin, isLoggedIn } = useAuth()
  const [guestVoterId] = useState(() => {
    const storageKey = 'kt-cps-map-vote-guest-id'
    const existingId = window.localStorage.getItem(storageKey)
    if (existingId) return existingId
    const newId = crypto.randomUUID()
    window.localStorage.setItem(storageKey, newId)
    return newId
  })
  const [meeting, setMeeting] = useState<MapVoteMeeting | null>(null)
  const [selectedMapIds, setSelectedMapIds] = useState<string[]>([])
  const [includeAnonymous, setIncludeAnonymous] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadMeeting = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const nextMeeting = await fetchMapVoteMeeting(session?.user.id ?? guestVoterId)
      setMeeting(nextMeeting)
      setSelectedMapIds(nextMeeting.selectedMapIds)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load map voting.')
    } finally {
      setLoading(false)
    }
  }, [guestVoterId, session])

  useEffect(() => {
    if (!hasSupabaseConfig || authLoading) {
      if (!authLoading) setLoading(false)
      return
    }
    void loadMeeting()
  }, [authLoading, loadMeeting])

  const rankedMaps = useMemo(() => meeting?.maps.map((map) => ({
    ...map,
    displayedVotes: includeAnonymous ? map.total_votes : map.registered_votes,
  })).sort((first, second) => second.displayedVotes - first.displayedVotes || first.map_name.localeCompare(second.map_name)) ?? [], [includeAnonymous, meeting])
  const highestVoteCount = Math.max(0, ...rankedMaps.map((map) => map.displayedVotes))
  const votesRemaining = meeting ? Math.max(0, meeting.voteLimit - selectedMapIds.length) : 0

  useEffect(() => {
    if (!meeting) return
    onAttendanceChange(meeting.attendeePlayerNames, meeting.attendanceCount)
    onWinningMapsChange(
      rankedMaps
        .filter((map) => map.displayedVotes > 0)
        .slice(0, meeting.mapCount)
        .map((map) => map.map_name)
    )
  }, [meeting, onAttendanceChange, onWinningMapsChange, rankedMaps])

  const toggleAttendance = async () => {
    if (!meeting) return
    setSaving(true)
    setError(null)
    try {
      await setMapVoteAttendance(meeting.id, session?.user.id ?? guestVoterId, !meeting.attendee)
      await loadMeeting()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update attendance.')
    } finally {
      setSaving(false)
    }
  }

  const toggleMap = async (mapId: string) => {
    if (!meeting) return
    if (!meeting.attendee) {
      setSelectedMapIds([mapId])
      setSaving(true)
      setError(null)
      try {
        await setMapVoteAttendance(meeting.id, session?.user.id ?? guestVoterId, true)
        await replaceMapVotes(meeting.id, session?.user.id ?? guestVoterId, [mapId])
        await loadMeeting()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not confirm attendance and save map vote.')
      } finally {
        setSaving(false)
      }
      return
    }

    const nextMapIds = selectedMapIds.includes(mapId)
      ? selectedMapIds.filter((id) => id !== mapId)
      : selectedMapIds.length < meeting.voteLimit
        ? [...selectedMapIds, mapId]
        : selectedMapIds
    if (nextMapIds === selectedMapIds) return

    setSelectedMapIds(nextMapIds)
    setSaving(true)
    setError(null)
    try {
      await replaceMapVotes(meeting.id, session?.user.id ?? guestVoterId, nextMapIds)
      await loadMeeting()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save votes.')
    } finally {
      setSaving(false)
    }
  }

  if (!hasSupabaseConfig) return null

  return (
    <section className="map-voting" aria-labelledby="map-voting-heading">
      <header className="section-heading">
        <div>
          <h3 id="map-voting-heading">Map Vote</h3>
          <p>Vote for maps for Friday.</p>
        </div>
        {isAdmin && (
          <label className="vote-filter">
            <input type="checkbox" checked={includeAnonymous} onChange={(event) => setIncludeAnonymous(event.target.checked)} />
            Include guest votes
          </label>
        )}
      </header>
      {loading && !meeting && <p className="vote-status">Loading map vote…</p>}
      {error && <p className="vote-error">{error}</p>}
      {meeting && (
        <>
          <div className="vote-summary">
            <span><strong>{meeting.attendanceCount}</strong> playing Friday</span>
            <span><strong>{meeting.voteLimit}</strong> map choices each</span>
          </div>
          <div className="vote-remaining" aria-label={`${votesRemaining} votes remaining`}>
            <span><strong>{votesRemaining}</strong> votes remaining</span>
            <div className="vote-progress" role="progressbar" aria-valuemin={0} aria-valuemax={meeting.voteLimit} aria-valuenow={selectedMapIds.length}>
              <span style={{ width: `${(selectedMapIds.length / meeting.voteLimit) * 100}%` }} />
            </div>
          </div>
          {isLoggedIn && (
            <button type="button" className="attendance-button" onClick={() => void toggleAttendance()} disabled={saving}>
              {meeting.attendee ? 'I am not playing Friday' : 'I am playing Friday'}
            </button>
          )}
          <p className="vote-hint">
            {meeting.attendee
              ? `Choose up to ${meeting.voteLimit} maps. Choices save instantly.`
              : 'Choose a map to confirm you are playing Friday.'}
          </p>
          <div className="vote-map-list">
            {rankedMaps.map((map) => {
              const rank = selectedMapIds.indexOf(map.map_id)
              const voteShare = highestVoteCount === 0 ? 0 : (map.displayedVotes / highestVoteCount) * 100
              return (
                <button
                  type="button"
                  key={map.map_id}
                  className={rank >= 0 ? 'vote-map selected' : 'vote-map'}
                  onClick={() => void toggleMap(map.map_id)}
                  disabled={saving}
                  aria-pressed={rank >= 0}
                  style={{ '--vote-share': `${voteShare}%` } as VoteMapStyle}
                >
                  <span>{rank >= 0 ? `${rank + 1}. ` : ''}{map.map_name}</span>
                  <small>{map.displayedVotes} vote{map.displayedVotes === 1 ? '' : 's'}</small>
                  <span className="vote-map-voters">{map.voter_names.length > 0 ? map.voter_names.join(', ') : 'No votes yet'}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}

export default MapVoting
