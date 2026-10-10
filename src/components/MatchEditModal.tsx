import { useEffect, useState } from 'react'
import { formatCritOp, getTacOpArchetypeClass, type MatchFormOptions, type MatchRecord, type TacOpOption, type TeamOption } from '../services/matches'
import type { MatchImage } from '../services/matchImages'

const teamFactionClasses: Record<string, string> = {
  Imperium: 'imperium',
  Chaos: 'chaos',
  Xenos: 'xenos',
  Homebrew: 'homebrew',
}

const teamFactionOrder = ['Imperium', 'Chaos', 'Xenos', 'Homebrew']

const getTeamFactionGroup = (faction: string | null) => teamFactionOrder.includes(faction ?? '') ? faction! : 'Homebrew'

interface MatchEditModalProps {
  match: MatchRecord
  mode: 'create' | 'edit'
  options: MatchFormOptions
  isSaving: boolean
  error: string | null
  isUpdatingImages: boolean
  imageError: string | null
  onCancel: () => void
  onSave: (match: MatchRecord, imageFiles: File[]) => void
  onCreatePlayer: (name: string) => Promise<void>
  onUploadImages: (files: File[]) => void
  onDeleteImage: (image: MatchImage) => void
  onReorderImages: (images: MatchImage[]) => void
}

function TeamSelect({ value, teams, onChange }: { value: string; teams: TeamOption[]; onChange: (value: string) => void }) {
  const groupedTeams = teams.reduce<Record<string, TeamOption[]>>((groups, team) => {
    const faction = getTeamFactionGroup(team.faction)
    ;(groups[faction] ??= []).push(team)
    return groups
  }, {})
  const selectedTeam = teams.find((team) => team.name === value)
  const selectedClass = selectedTeam ? `team-select-${teamFactionClasses[getTeamFactionGroup(selectedTeam.faction)]}` : ''

  return (
    <select className={`team-select ${selectedClass}`} value={value} onChange={(event) => onChange(event.target.value)}>
      {value && !selectedTeam && <option value={value}>{value}</option>}
      {teamFactionOrder.map((faction) => {
        const options = groupedTeams[faction] ?? []
        const factionClass = `team-select-${teamFactionClasses[faction]}`
        return options.length > 0 && <optgroup key={faction} className={factionClass} label={faction}>{options.map((team) => <option className={factionClass} key={team.name} value={team.name}>{team.name}</option>)}</optgroup>
      })}
    </select>
  )
}

function TacOpSelect({ value, tacOps, onChange }: { value: string | null | undefined; tacOps: TacOpOption[]; onChange: (value: string | null) => void }) {
  const groupedTacOps = tacOps.reduce<Record<string, TacOpOption[]>>((groups, tacOp) => {
    ;(groups[tacOp.archetype] ??= []).push(tacOp)
    return groups
  }, {})
  const selectedTacOp = tacOps.find((tacOp) => tacOp.name === value)
  const selectedClass = selectedTacOp ? getTacOpArchetypeClass(selectedTacOp.archetype) : ''
  const isSavedTacOp = Boolean(value && !selectedTacOp)

  return (
    <select className={`tac-op-select ${selectedClass}`} value={value ?? ''} onChange={(event) => onChange(event.target.value || null)}>
      <option value="">None</option>
      {isSavedTacOp && <option value={value ?? ''}>{value}</option>}
      {Object.entries(groupedTacOps).map(([archetype, options]) => {
        const archetypeClass = getTacOpArchetypeClass(archetype)
        return <optgroup key={archetype} className={archetypeClass} label={archetype}>{options.map((tacOp) => <option className={archetypeClass} key={tacOp.name} value={tacOp.name}>{tacOp.name}</option>)}</optgroup>
      })}
    </select>
  )
}

function PlayerField({ label, placeholder, value, players, onChange }: { label: string; placeholder: string; value: string; players: string[]; onChange: (value: string) => void }) {
  return (
    <label>{label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{placeholder}</option>
        {value && !players.includes(value) && <option value={value}>{value}</option>}
        {players.map((name) => <option key={name} value={name}>{name}</option>)}
      </select>
    </label>
  )
}

function MatchEditModal({ match, mode, options, isSaving, error, isUpdatingImages, imageError, onCancel, onSave, onCreatePlayer, onUploadImages, onDeleteImage, onReorderImages }: MatchEditModalProps) {
  const [draft, setDraft] = useState<MatchRecord>(match)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerError, setNewPlayerError] = useState<string | null>(null)
  const [isCreatingPlayer, setIsCreatingPlayer] = useState(false)
  const [pendingImageFiles, setPendingImageFiles] = useState<File[]>([])
  const [draggedImageId, setDraggedImageId] = useState<string | null>(null)

  useEffect(() => {
    setDraft(match)
    setPendingImageFiles([])
    setDraggedImageId(null)
  }, [match])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`

    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
    }
  }, [])

  const setField = <K extends keyof MatchRecord>(key: K, value: MatchRecord[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const getTeamTacOps = (teamName: string) => {
    const archetypes = options.teams.find((team) => team.name === teamName)?.tacOpArchetypes ?? []
    return archetypes.length > 0
      ? options.tacOps.filter((tacOp) => archetypes.includes(tacOp.archetype))
      : options.tacOps
  }

  const setTeam = (teamKey: 'teamOne' | 'teamTwo', tacOpKey: 'player1Tac' | 'player2Tac', teamName: string) => {
    setDraft((current) => {
      const availableTacOps = getTeamTacOps(teamName)
      const currentTacOp = current[tacOpKey]
      const tacOpIsAvailable = availableTacOps.some((tacOp) => tacOp.name === currentTacOp)

      return {
        ...current,
        [teamKey]: teamName,
        [tacOpKey]: tacOpIsAvailable ? currentTacOp : null,
      }
    })
  }

  const toScore = (value: string) => (value === '' ? null : Number(value))

  const handleCreatePlayer = async () => {
    setIsCreatingPlayer(true)
    setNewPlayerError(null)
    try {
      await onCreatePlayer(newPlayerName)
      setNewPlayerName('')
    } catch (err) {
      setNewPlayerError(err instanceof Error ? err.message : 'Failed to create player.')
    } finally {
      setIsCreatingPlayer(false)
    }
  }

  return (
    <div className="wheel-overlay" role="dialog" aria-modal="true" aria-labelledby="match-edit-heading">
      <div className="wheel-modal match-edit-modal">
        <header className="match-edit-header">
          <h3 id="match-edit-heading">{mode === 'create' ? 'Add match' : 'Edit match'}</h3>
          <button type="button" className="wheel-close" aria-label="Close" onClick={onCancel} disabled={isSaving}>&times;</button>
        </header>
        <div className="match-edit-body">
          <div className="match-edit-grid">
          <label>Date
            <input type="date" value={draft.date} onChange={(event) => setField('date', event.target.value)} />
          </label>
          <label>Map
            <select value={draft.map} onChange={(event) => setField('map', event.target.value)}>
              {!options.maps.includes(draft.map) && <option value={draft.map}>{draft.map}</option>}
              {options.maps.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label>Crit op
            <select value={draft.critOp ?? ''} onChange={(event) => setField('critOp', event.target.value || null)}>
              <option value="">None</option>
              {draft.critOp && !options.critOps.some((critOp) => critOp.name === draft.critOp) && <option value={draft.critOp}>{draft.critOp}</option>}
              {options.critOps.map((critOp) => <option key={critOp.name} value={critOp.name}>{formatCritOp(critOp.name, critOp.number)}</option>)}
            </select>
          </label>

          <PlayerField label="Player 1 (winner)" placeholder="Select winner" value={draft.player1} players={options.players} onChange={(value) => setField('player1', value)} />
          <PlayerField label="Player 2" placeholder="Select opponent" value={draft.player2} players={options.players} onChange={(value) => setField('player2', value)} />

          <label>Team 1
            <TeamSelect value={draft.teamOne} teams={options.teams} onChange={(value) => setTeam('teamOne', 'player1Tac', value)} />
          </label>
          <label>Team 2
            <TeamSelect value={draft.teamTwo} teams={options.teams} onChange={(value) => setTeam('teamTwo', 'player2Tac', value)} />
          </label>

          <label>Player 1 score
            <input type="number" value={draft.player1Score ?? ''} onChange={(event) => setField('player1Score', toScore(event.target.value))} />
          </label>
          <label>Player 2 score
            <input type="number" value={draft.player2Score ?? ''} onChange={(event) => setField('player2Score', toScore(event.target.value))} />
          </label>

          <label>Player 1 tac op
            <TacOpSelect value={draft.player1Tac} tacOps={getTeamTacOps(draft.teamOne)} onChange={(value) => setField('player1Tac', value)} />
          </label>
          <label>Player 2 tac op
            <TacOpSelect value={draft.player2Tac} tacOps={getTeamTacOps(draft.teamTwo)} onChange={(value) => setField('player2Tac', value)} />
          </label>
          </div>

          <details className="new-player" onToggle={(event) => {
            if (event.currentTarget.open) setNewPlayerError(null)
          }}>
            <summary>Adding a new player?</summary>
            <div>
              <label>Player name
                <input value={newPlayerName} onChange={(event) => setNewPlayerName(event.target.value)} />
              </label>
              <button type="button" onClick={handleCreatePlayer} disabled={isCreatingPlayer}>
                {isCreatingPlayer ? 'Adding…' : 'Add player'}
              </button>
            </div>
            {newPlayerError && <p className="match-edit-error">{newPlayerError}</p>}
          </details>

          <section className="match-options" aria-labelledby="match-options-heading">
            <h4 id="match-options-heading">Match options</h4>
            <div className="match-options-list">
              <label className="match-option">
                <input type="checkbox" checked={draft.isTied} onChange={(event) => setField('isTied', event.target.checked)} />
                <span><strong>Draw</strong><small>Use when match ends without a winner.</small></span>
              </label>
              <label className="match-option">
                <input type="checkbox" checked={draft.isHomebrew} onChange={(event) => setField('isHomebrew', event.target.checked)} />
                <span><strong>Homebrew</strong><small>Use if any teams or rules are homebrewed.</small></span>
              </label>
              <label className="match-option">
                <input type="checkbox" checked={draft.isPlayer1Skip} onChange={(event) => setField('isPlayer1Skip', event.target.checked)} />
                <span><strong>Player 1 skip</strong><small>Use for a tutorial or when teaching a new player. Player 1 streak will not increase.</small></span>
              </label>
              <label className="match-option">
                <input type="checkbox" checked={draft.isPlayer2Skip} onChange={(event) => setField('isPlayer2Skip', event.target.checked)} />
                <span><strong>Player 2 skip</strong><small>Use for a tutorial or when teaching a new player. Player 2 streak will not increase.</small></span>
              </label>
            </div>
          </section>

          {mode === 'create' && <section className="match-image-editor" aria-labelledby="match-images-heading">
            <div><h4 id="match-images-heading">Match images</h4><p>JPEG, PNG, or WebP. Maximum 10 MB each.</p></div>
            <label className="match-image-upload">Add images
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setPendingImageFiles(Array.from(event.target.files ?? []))} />
            </label>
            {pendingImageFiles.length > 0 && <p className="match-image-status">{pendingImageFiles.length} image{pendingImageFiles.length === 1 ? '' : 's'} ready to upload.</p>}
          </section>}

          {mode === 'edit' && <section className="match-image-editor" aria-labelledby="match-images-heading">
            <div><h4 id="match-images-heading">Match images</h4><p>Drag images to reorder. First image is match preview. JPEG, PNG, or WebP. Maximum 10 MB each.</p></div>
            <label className="match-image-upload">Add images
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={isUpdatingImages} onChange={(event) => {
                const files = Array.from(event.target.files ?? [])
                if (files.length > 0) onUploadImages(files)
                event.target.value = ''
              }} />
            </label>
            {draft.images.length > 0 && <div className="match-image-editor-list">{draft.images.map((image, index) => <figure
              className={draggedImageId === image.id ? 'match-image-editor-item dragging' : 'match-image-editor-item'}
              draggable={!isUpdatingImages}
              key={image.id}
              onDragEnd={() => setDraggedImageId(null)}
              onDragOver={(event) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
              }}
              onDragStart={(event) => {
                setDraggedImageId(image.id)
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', image.id)
              }}
              onDrop={(event) => {
                event.preventDefault()
                const sourceId = event.dataTransfer.getData('text/plain') || draggedImageId
                if (!sourceId || sourceId === image.id) return
                const sourceIndex = draft.images.findIndex((item) => item.id === sourceId)
                if (sourceIndex < 0) return
                const reorderedImages = [...draft.images]
                const [sourceImage] = reorderedImages.splice(sourceIndex, 1)
                const targetIndex = reorderedImages.findIndex((item) => item.id === image.id)
                reorderedImages.splice(targetIndex, 0, sourceImage)
                onReorderImages(reorderedImages)
              }}
            ><img src={image.url} alt={image.caption ?? `Match photo ${index + 1}`} /><button type="button" onClick={() => onDeleteImage(image)} disabled={isUpdatingImages}>Remove</button></figure>)}</div>}
            {isUpdatingImages && <p className="match-image-status">Updating images…</p>}
            {imageError && <p className="match-edit-error">{imageError}</p>}
          </section>}

          {error && <p className="match-edit-error">{error}</p>}

          <div className="wheel-dialog-actions">
            <button type="button" className="wheel-dialog-secondary" onClick={onCancel} disabled={isSaving}>Cancel</button>
            <button type="button" className="wheel-dialog-primary" onClick={() => onSave(draft, pendingImageFiles)} disabled={isSaving}>{isSaving ? 'Saving…' : mode === 'create' ? 'Create match' : 'Save changes'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MatchEditModal
