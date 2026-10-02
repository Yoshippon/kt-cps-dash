import { useEffect, useMemo, useState, type DragEvent } from 'react'
import { useAuth } from '../lib/auth'
import {
  TIERS,
  createTierList,
  fetchTierListPlacements,
  fetchTierListTeams,
  fetchTierLists,
  saveTierListPlacements,
  type Tier,
  type TierListPlacement,
  type TierListSummary,
  type TierListTeam,
} from '../services/tierLists'

const emptyPlacements = (): TierListPlacement[] => []

const toPlacements = (byTier: Record<Tier, string[]>): TierListPlacement[] =>
  TIERS.flatMap((tier) => byTier[tier].map((teamId, position) => ({ teamId, tier, position })))

function TierLists({ isActive }: { isActive: boolean }) {
  const { isAdmin, isLoggedIn, player } = useAuth()
  const [tierLists, setTierLists] = useState<TierListSummary[]>([])
  const [selectedList, setSelectedList] = useState<TierListSummary | null>(null)
  const [teams, setTeams] = useState<TierListTeam[]>([])
  const [placements, setPlacements] = useState<TierListPlacement[]>(emptyPlacements)
  const [name, setName] = useState('')
  const [includesNonClassified, setIncludesNonClassified] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isNewList = selectedList === null
  const canEdit = isNewList ? Boolean(player) : Boolean(player && (isAdmin || selectedList.owner_id === player.id))
  const activeIncludesNonClassified = selectedList?.includes_non_classified ?? includesNonClassified

  useEffect(() => {
    if (!isActive) return

    let isCurrent = true
    const load = async () => {
      try {
        const [lists, initialTeams] = await Promise.all([
          fetchTierLists(),
          fetchTierListTeams(false),
        ])
        if (!isCurrent) return
        setTierLists(lists)
        if (lists.length > 0) {
          setSelectedList(lists[0])
          setName(lists[0].name)
          setIncludesNonClassified(lists[0].includes_non_classified)
        } else {
          setTeams(initialTeams)
        }
      } catch (err) {
        if (isCurrent) setError(err instanceof Error ? err.message : 'Failed to load tier lists.')
      } finally {
        if (isCurrent) setIsLoading(false)
      }
    }

    void load()
    return () => { isCurrent = false }
  }, [isActive])

  useEffect(() => {
    if (!isActive || !selectedList) return

    let isCurrent = true
    const load = async () => {
      try {
        const [nextPlacements, nextTeams] = await Promise.all([
          fetchTierListPlacements(selectedList.id),
          fetchTierListTeams(true),
        ])
        if (!isCurrent) return
        setPlacements(nextPlacements)
        setTeams(nextTeams)
      } catch (err) {
        if (isCurrent) setError(err instanceof Error ? err.message : 'Failed to load tier list.')
      } finally {
        if (isCurrent) setIsLoading(false)
      }
    }

    void load()
    return () => { isCurrent = false }
  }, [isActive, selectedList])

  const placementByTier = useMemo(() => {
    const result: Record<Tier, string[]> = { S: [], A: [], B: [], C: [], D: [] }
    placements
      .slice()
      .sort((first, second) => first.position - second.position)
      .forEach((placement) => result[placement.tier].push(placement.teamId))
    return result
  }, [placements])

  const placedTeamIds = useMemo(() => new Set(placements.map((placement) => placement.teamId)), [placements])
  const visibleTeams = useMemo(
    () => teams.filter((team) => activeIncludesNonClassified || team.isClassified || placedTeamIds.has(team.id)),
    [activeIncludesNonClassified, placedTeamIds, teams],
  )
  const teamById = useMemo(() => new Map(visibleTeams.map((team) => [team.id, team])), [visibleTeams])
  const unrankedTeams = useMemo(
    () => visibleTeams.filter((team) => !placedTeamIds.has(team.id)),
    [placedTeamIds, visibleTeams],
  )

  const loadNewListTeams = async (includeNonClassified: boolean) => {
    setIsLoading(true)
    setError(null)
    try {
      setTeams(await fetchTierListTeams(includeNonClassified))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load teams.')
    } finally {
      setIsLoading(false)
    }
  }

  const startNewList = () => {
    setError(null)
    setSelectedList(null)
    setName('')
    setIncludesNonClassified(false)
    setPlacements(emptyPlacements())
    void loadNewListTeams(false)
  }

  const selectList = (listId: string) => {
    const list = tierLists.find((item) => item.id === listId)
    if (!list) return
    setIsLoading(true)
    setError(null)
    setSelectedList(list)
    setName(list.name)
    setIncludesNonClassified(list.includes_non_classified)
  }

  const moveTeam = (teamId: string, tier: Tier | null, index?: number) => {
    if (!canEdit) return

    setPlacements((current) => {
      const next: Record<Tier, string[]> = { S: [], A: [], B: [], C: [], D: [] }
      current.forEach((placement) => {
        if (placement.teamId !== teamId) next[placement.tier].push(placement.teamId)
      })
      if (tier) next[tier].splice(Math.max(0, Math.min(index ?? next[tier].length, next[tier].length)), 0, teamId)
      return toPlacements(next)
    })
  }

  const handleDrop = (event: DragEvent<HTMLElement>, tier: Tier | null, index?: number) => {
    event.preventDefault()
    const teamId = event.dataTransfer.getData('text/plain')
    if (teamId) moveTeam(teamId, tier, index)
  }

  const handleSave = async () => {
    if (!canEdit || isSaving) return

    setIsSaving(true)
    setError(null)
    try {
      let list = selectedList
      if (!list) {
        const created = await createTierList(name, includesNonClassified)
        list = { ...created, ownerName: player?.name ?? 'Unknown player' }
        setTierLists((current) => [list!, ...current])
        setSelectedList(list)
        setName(created.name)
      }

      await saveTierListPlacements(list.id, placements)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save tier list.')
    } finally {
      setIsSaving(false)
    }
  }

  const renderTeam = (team: TierListTeam, tier: Tier | null, index?: number) => (
    <div
      className="tier-team"
      draggable={canEdit}
      key={team.id}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', team.id)
      }}
      onDragOver={(event) => {
        if (canEdit) event.preventDefault()
      }}
      onDrop={(event) => {
        event.stopPropagation()
        handleDrop(event, tier, index)
      }}
      title={team.name}
    >
      <span className="match-team-avatar tier-team-avatar">
        {team.logoUrl
          ? <img src={team.logoUrl} alt={team.name} />
          : <span className="tier-team-avatar-placeholder" aria-label={team.name}>{team.name.slice(0, 2)}</span>}
      </span>
      <small>{team.name}</small>
    </div>
  )

  return (
    <div hidden={!isActive}>
      <section className="tab-summary" aria-label="Tier list statistics">
        <div className="stats" aria-label="Tier list statistics">
          <div><strong>{tierLists.length}</strong><span>saved lists</span></div>
          <div><strong>{visibleTeams.length}</strong><span>teams shown</span></div>
        </div>
      </section>

      <section className="tier-list-controls" aria-label="Tier list controls">
        <label>
          View tier list
          <select value={selectedList?.id ?? ''} onChange={(event) => selectList(event.target.value)}>
            {tierLists.length === 0 && <option value="">No saved lists</option>}
            {tierLists.map((list) => <option key={list.id} value={list.id}>{list.name} - {list.ownerName}</option>)}
          </select>
        </label>
        {isLoggedIn && <button type="button" onClick={startNewList}>New tier list</button>}
      </section>

      {!player && isLoggedIn && <p className="tier-list-note">Claim a player profile before creating a tier list.</p>}
      {error && <p className="account-error">{error}</p>}
      {isLoading ? <p className="profile-status">Loading tier list...</p> : (
        isNewList && !canEdit ? (
          <div className="empty-state"><strong>No tier lists yet</strong><span>Sign in and claim a player profile to create first list.</span></div>
        ) : <>
          {isNewList && canEdit && (
            <section className="tier-list-setup" aria-label="New tier list settings">
              <label>
                Name
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder={`${player?.name ?? 'Player'} - ${new Date().toISOString().slice(0, 10)}`} />
              </label>
              <label className="tier-list-checkbox">
                <input
                  type="checkbox"
                  checked={includesNonClassified}
                  onChange={(event) => {
                    const checked = event.target.checked
                    setIncludesNonClassified(checked)
                    setPlacements(emptyPlacements())
                    void loadNewListTeams(checked)
                  }}
                />
                Include non-classified teams
              </label>
            </section>
          )}

          {selectedList && (
            <p className="tier-list-note">
              Created by {selectedList.ownerName}. {selectedList.includes_non_classified ? 'All teams included.' : 'Classified teams only.'}
            </p>
          )}

          <section className="tier-board" aria-label="Kill team tier board">
            {TIERS.map((tier) => (
              <div className={`tier-row tier-row-${tier.toLowerCase()}`} key={tier}>
                <strong>{tier}</strong>
                <div className="tier-row-teams" onDragOver={(event) => { if (canEdit) event.preventDefault() }} onDrop={(event) => handleDrop(event, tier)}>
                  {placementByTier[tier].map((teamId, index) => {
                    const team = teamById.get(teamId)
                    return team ? renderTeam(team, tier, index) : null
                  })}
                </div>
              </div>
            ))}
          </section>

          {canEdit && (
            <section className="tier-unranked" aria-labelledby="tier-unranked-heading" onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(event, null)}>
              <div><h3 id="tier-unranked-heading">Unranked teams</h3><span>Drag teams into a tier</span></div>
              <div className="tier-team-tray">
                {unrankedTeams.map((team) => renderTeam(team, null))}
              </div>
            </section>
          )}

          {canEdit && <div className="tier-list-actions"><button type="button" onClick={() => void handleSave()} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save tier list'}</button></div>}
        </>
      )}
    </div>
  )
}

export default TierLists
