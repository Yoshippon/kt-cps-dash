import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react'
import { useAuth } from '../lib/auth'
import {
  AUTOMATIC_TIER_LABELS,
  AUTOMATIC_TIER_LIST_ID,
  TIERS,
  DEFAULT_TIER_LABELS,
  createTierList,
  fetchAutomaticTierList,
  fetchTierListPlacements,
  fetchTierListTeams,
  fetchTierLists,
  saveTierList,
  type Tier,
  type TierLabels,
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
  const [isAutomaticList, setIsAutomaticList] = useState(true)
  const [hideUnclassifiedTeams, setHideUnclassifiedTeams] = useState(false)
  const [isCompact, setIsCompact] = useState(false)
  const [teams, setTeams] = useState<TierListTeam[]>([])
  const [placements, setPlacements] = useState<TierListPlacement[]>(emptyPlacements)
  const [name, setName] = useState('')
  const [tierLabels, setTierLabels] = useState<TierLabels>(DEFAULT_TIER_LABELS)
  const [editingTier, setEditingTier] = useState<Tier | null>(null)
  const [includesNonClassified, setIncludesNonClassified] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isNewList = !isAutomaticList && selectedList === null
  const canEdit = !isAutomaticList && (isNewList ? Boolean(player) : Boolean(player && selectedList && (isAdmin || selectedList.owner_id === player.id)))
  const activeIncludesNonClassified = isAutomaticList ? false : selectedList?.includes_non_classified ?? includesNonClassified

  const loadAutomaticTierList = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const automaticList = await fetchAutomaticTierList()
      setTeams(automaticList.teams)
      setPlacements(automaticList.placements)
      setTierLabels(AUTOMATIC_TIER_LABELS)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load community win rates.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isActive) return

    let isCurrent = true
    const load = async () => {
      try {
        const [lists, automaticList] = await Promise.all([
          fetchTierLists(),
          fetchAutomaticTierList(),
        ])
        if (!isCurrent) return
        setTierLists(lists)
        setIsAutomaticList(true)
        setSelectedList(null)
        setTierLabels(AUTOMATIC_TIER_LABELS)
        setTeams(automaticList.teams)
        setPlacements(automaticList.placements)
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
    if (!isActive || isAutomaticList || !selectedList) return

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
  }, [isActive, isAutomaticList, selectedList])

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
    () => teams.filter((team) => (
      isAutomaticList
        ? !hideUnclassifiedTeams || team.isClassified
        : activeIncludesNonClassified || team.isClassified || placedTeamIds.has(team.id)
    )),
    [activeIncludesNonClassified, hideUnclassifiedTeams, isAutomaticList, placedTeamIds, teams],
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
    setIsAutomaticList(false)
    setSelectedList(null)
    setName('')
    setTierLabels(DEFAULT_TIER_LABELS)
    setEditingTier(null)
    setIncludesNonClassified(false)
    setPlacements(emptyPlacements())
    void loadNewListTeams(false)
  }

  const selectList = (listId: string) => {
    if (listId === AUTOMATIC_TIER_LIST_ID) {
      setIsAutomaticList(true)
      setSelectedList(null)
      setEditingTier(null)
      void loadAutomaticTierList()
      return
    }
    const list = tierLists.find((item) => item.id === listId)
    if (!list) return
    setIsLoading(true)
    setError(null)
    setIsAutomaticList(false)
    setSelectedList(list)
    setName(list.name)
    setTierLabels(list.tier_labels)
    setEditingTier(null)
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

      await saveTierList(list.id, placements, tierLabels)
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
      {team.winRate !== undefined && (
        <span className="tier-team-stats">
          {team.winRate.toFixed(0)}% · {team.games}G · {team.wins}W {team.draws}D {team.losses}L
        </span>
      )}
    </div>
  )

  return (
    <div hidden={!isActive}>
      <section className="tab-summary" aria-label="Tier list statistics">
        <div className="stats" aria-label="Tier list statistics">
          <div><strong>{tierLists.length}</strong><span>custom lists</span></div>
          <div><strong>{visibleTeams.length}</strong><span>teams shown</span></div>
        </div>
      </section>

      <section className="tier-list-controls" aria-label="Tier list controls">
        <label>
          View tier list
          <select value={isAutomaticList ? AUTOMATIC_TIER_LIST_ID : selectedList?.id ?? ''} onChange={(event) => selectList(event.target.value)}>
            <option value={AUTOMATIC_TIER_LIST_ID}>Community Win Rate (Auto)</option>
            {tierLists.map((list) => <option key={list.id} value={list.id}>{list.name} - {list.ownerName}</option>)}
          </select>
        </label>
        {isAutomaticList && <button type="button" onClick={() => void loadAutomaticTierList()} disabled={isLoading}>Refresh</button>}
        <button type="button" onClick={() => setIsCompact((current) => !current)}>{isCompact ? 'Full view' : 'Compact view'}</button>
        {isAutomaticList && (
          <label className="tier-list-checkbox">
            <input type="checkbox" checked={hideUnclassifiedTeams} onChange={(event) => setHideUnclassifiedTeams(event.target.checked)} />
            Hide unclassified teams
          </label>
        )}
        {isLoggedIn && <button type="button" className="new-tier-list-button" onClick={startNewList}>New tier list</button>}
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

          {isAutomaticList && !isCompact ? (
            <p className="tier-list-note">Community match results. Draws count as 0.5 wins. Teams need at least 1 game.</p>
          ) : selectedList && (
            <p className="tier-list-note">
              Created by {selectedList.ownerName}. {selectedList.includes_non_classified ? 'All teams included.' : 'Classified teams only.'}
            </p>
          )}

          <section className={`tier-board${isAutomaticList ? ' tier-board-automatic' : ''}${isCompact ? ' tier-board-compact' : ''}`} aria-label="Kill team tier board">
            {TIERS.map((tier) => (
              <div className={`tier-row tier-row-${tier.toLowerCase()}`} key={tier}>
                <div className="tier-row-heading">
                  {editingTier === tier ? (
                    <input
                      aria-label={`${tier} tier name`}
                      autoFocus
                      value={tierLabels[tier]}
                      maxLength={40}
                      onChange={(event) => setTierLabels((current) => ({ ...current, [tier]: event.target.value }))}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter') return
                        event.preventDefault()
                        setEditingTier(null)
                        void handleSave()
                      }}
                    />
                  ) : (
                    <strong className={isAutomaticList ? 'automatic-tier-label' : undefined}>
                      {isCompact ? tier : isAutomaticList ? <><span>{tier}</span><span>{tierLabels[tier].replace(/^[SABCD]\s*/, '')}</span></> : tierLabels[tier]}
                    </strong>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      className="tier-label-edit"
                      aria-label={`Edit ${tier} tier name`}
                      title={`Edit ${tier} tier name`}
                      onClick={() => setEditingTier((current) => current === tier ? null : tier)}
                    >
                      <span aria-hidden="true">&#9998;</span>
                    </button>
                  )}
                </div>
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
