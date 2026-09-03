import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/auth'
import {
  addOwnedTeam,
  deleteTeamImage,
  fetchOwnedTeams,
  fetchProfile,
  fetchTeamOptions,
  removeOwnedTeam,
  uploadAvatar,
  uploadTeamImages,
  type OwnedTeam,
  type PlayerProfile,
  type ProfileImage,
} from '../services/profile'
import type { KillTeamRow } from '../types/database'

function Profile({ isActive }: { isActive: boolean }) {
  const { player, session } = useAuth()
  const [profile, setProfile] = useState<PlayerProfile>({ avatarPath: null, avatarUrl: null })
  const [teams, setTeams] = useState<OwnedTeam[]>([])
  const [teamOptions, setTeamOptions] = useState<KillTeamRow[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const availableTeams = useMemo(() => teamOptions.filter((team) => !teams.some((ownedTeam) => ownedTeam.id === team.id)), [teamOptions, teams])

  useEffect(() => {
    if (!isActive || !player) return
    Promise.all([fetchProfile(player.id), fetchOwnedTeams(player.id), fetchTeamOptions()])
      .then(([nextProfile, nextTeams, nextTeamOptions]) => {
        setError(null)
        setProfile(nextProfile)
        setTeams(nextTeams)
        setTeamOptions(nextTeamOptions)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load profile.'))
      .finally(() => setIsLoading(false))
  }, [isActive, player])

  const handleAvatarUpload = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file || !player || !session?.user.id) return
    setBusyAction('avatar')
    setError(null)
    try {
      setProfile(await uploadAvatar(player.id, session.user.id, profile.avatarPath, file))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload profile photo.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleAddTeam = async () => {
    if (!player || !selectedTeamId) return
    setBusyAction('add-team')
    setError(null)
    try {
      await addOwnedTeam(player.id, selectedTeamId)
      const team = teamOptions.find((option) => option.id === selectedTeamId)
      if (team) setTeams((current) => [...current, { id: team.id, name: team.name, images: [] }])
      setSelectedTeamId('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add team.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleRemoveTeam = async (team: OwnedTeam) => {
    if (!player) return
    setBusyAction(`remove-${team.id}`)
    setError(null)
    try {
      await removeOwnedTeam(player.id, team)
      setTeams((current) => current.filter((ownedTeam) => ownedTeam.id !== team.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove team.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleTeamImageUpload = async (teamId: string, files: FileList | null) => {
    if (!player || !files) return
    setBusyAction(`upload-${teamId}`)
    setError(null)
    try {
      const images = await uploadTeamImages(player.id, teamId, Array.from(files))
      setTeams((current) => current.map((team) => team.id === teamId ? { ...team, images: [...team.images, ...images] } : team))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload team photos.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleDeleteImage = async (teamId: string, image: ProfileImage) => {
    setBusyAction(`delete-${image.id}`)
    setError(null)
    try {
      await deleteTeamImage(image)
      setTeams((current) => current.map((team) => team.id === teamId ? { ...team, images: team.images.filter((teamImage) => teamImage.id !== image.id) } : team))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete team photo.')
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div hidden={!isActive}>
      <section className="intro" aria-labelledby="profile-heading">
        <div>
          <h2 id="profile-heading">Profile</h2>
          <p className="intro-copy">Your collection, your photos, your profile.</p>
        </div>
      </section>

      {!player && <div className="empty-state"><strong>Claim your player first</strong><span>Ask an admin for a claim link to manage your profile and teams.</span></div>}
      {player && (
        <>
          <section className="profile-summary" aria-label="Profile photo">
            {profile.avatarUrl ? <img className="profile-avatar" src={profile.avatarUrl} alt={`${player.name}'s profile`} /> : <div className="profile-avatar profile-avatar-placeholder" aria-hidden="true">{player.name.slice(0, 1)}</div>}
            <div>
              <h3>{player.name}</h3>
              <label className="profile-upload">
                {busyAction === 'avatar' ? 'Uploading…' : profile.avatarUrl ? 'Replace profile photo' : 'Upload profile photo'}
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busyAction !== null} onChange={(event) => handleAvatarUpload(event.target.files)} />
              </label>
            </div>
          </section>

          {error && <p className="account-error">{error}</p>}
          {isLoading ? <p className="profile-status">Loading profile…</p> : (
            <section className="profile-teams" aria-labelledby="profile-teams-heading">
              <div className="profile-teams-heading">
                <h3 id="profile-teams-heading">My teams</h3>
                {availableTeams.length > 0 && (
                  <div className="profile-add-team">
                    <select aria-label="Team to add" value={selectedTeamId} onChange={(event) => setSelectedTeamId(event.target.value)} disabled={busyAction !== null}>
                      <option value="">Select team</option>
                      {availableTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                    </select>
                    <button type="button" onClick={handleAddTeam} disabled={!selectedTeamId || busyAction !== null}>{busyAction === 'add-team' ? 'Adding…' : 'Add team'}</button>
                  </div>
                )}
              </div>
              {teams.length === 0 ? <div className="empty-state"><strong>No teams yet</strong><span>Add a team from collection above.</span></div> : (
                <div className="profile-team-list">
                  {teams.map((team) => (
                    <article className="profile-team-card" key={team.id}>
                      <header><h4>{team.name}</h4><button type="button" onClick={() => handleRemoveTeam(team)} disabled={busyAction !== null}>{busyAction === `remove-${team.id}` ? 'Removing…' : 'Remove team'}</button></header>
                      <label className="profile-upload">
                        {busyAction === `upload-${team.id}` ? 'Uploading…' : 'Add team photos'}
                        <input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busyAction !== null} onChange={(event) => handleTeamImageUpload(team.id, event.target.files)} />
                      </label>
                      {team.images.length > 0 && <div className="profile-team-images">{team.images.map((image, index) => <figure key={image.id}><img src={image.url} alt={`${team.name} photo ${index + 1}`} /><button type="button" onClick={() => handleDeleteImage(team.id, image)} disabled={busyAction !== null}>{busyAction === `delete-${image.id}` ? 'Deleting…' : 'Delete'}</button></figure>)}</div>}
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}

export default Profile
