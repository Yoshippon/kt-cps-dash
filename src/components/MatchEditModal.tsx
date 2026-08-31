import { useEffect, useState } from 'react'
import type { MatchFormOptions, MatchRecord, TacOpOption } from '../services/matches'
import type { MatchImage } from '../services/matchImages'

const tacOpArchetypeClasses: Record<string, string> = {
  Recon: 'recon',
  'Seek And Destroy': 'seek-and-destroy',
  Security: 'security',
  Infiltration: 'infiltration',
}

interface MatchEditModalProps {
  match: MatchRecord
  options: MatchFormOptions
  isSaving: boolean
  error: string | null
  isUpdatingImages: boolean
  imageError: string | null
  onCancel: () => void
  onSave: (match: MatchRecord) => void
  onUploadImages: (files: File[]) => void
  onDeleteImage: (image: MatchImage) => void
}

function TacOpSelect({ value, tacOps, onChange }: { value: string | null | undefined; tacOps: TacOpOption[]; onChange: (value: string | null) => void }) {
  const groupedTacOps = tacOps.reduce<Record<string, TacOpOption[]>>((groups, tacOp) => {
    ;(groups[tacOp.archetype] ??= []).push(tacOp)
    return groups
  }, {})
  const selectedTacOp = tacOps.find((tacOp) => tacOp.name === value)
  const selectedClass = selectedTacOp ? `tac-op-${tacOpArchetypeClasses[selectedTacOp.archetype] ?? 'other'}` : ''
  const isSavedTacOp = Boolean(value && !selectedTacOp)

  return (
    <select className={`tac-op-select ${selectedClass}`} value={value ?? ''} onChange={(event) => onChange(event.target.value || null)}>
      <option value="">None</option>
      {isSavedTacOp && <option value={value ?? ''}>{value}</option>}
      {Object.entries(groupedTacOps).map(([archetype, options]) => {
        const archetypeClass = `tac-op-${tacOpArchetypeClasses[archetype] ?? 'other'}`
        return <optgroup key={archetype} className={archetypeClass} label={archetype}>{options.map((tacOp) => <option className={archetypeClass} key={tacOp.name} value={tacOp.name}>{tacOp.name}</option>)}</optgroup>
      })}
    </select>
  )
}

function MatchEditModal({ match, options, isSaving, error, isUpdatingImages, imageError, onCancel, onSave, onUploadImages, onDeleteImage }: MatchEditModalProps) {
  const [draft, setDraft] = useState<MatchRecord>(match)

  useEffect(() => {
    setDraft(match)
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

  const toScore = (value: string) => (value === '' ? null : Number(value))

  return (
    <div className="wheel-overlay" role="dialog" aria-modal="true" aria-labelledby="match-edit-heading">
      <div className="wheel-modal match-edit-modal">
        <header className="match-edit-header">
          <h3 id="match-edit-heading">Edit match</h3>
          <button type="button" className="wheel-close" aria-label="Close" onClick={onCancel} disabled={isSaving}>&times;</button>
        </header>
        <div className="match-edit-body">
          <div className="match-edit-grid">
          <label>Map
            <select value={draft.map} onChange={(event) => setField('map', event.target.value)}>
              {!options.maps.includes(draft.map) && <option value={draft.map}>{draft.map}</option>}
              {options.maps.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label>Crit op
            <select value={draft.critOp ?? ''} onChange={(event) => setField('critOp', event.target.value || null)}>
              <option value="">None</option>
              {draft.critOp && !options.critOps.includes(draft.critOp) && <option value={draft.critOp}>{draft.critOp}</option>}
              {options.critOps.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>

          <label>Player 1
            <select value={draft.player1} onChange={(event) => setField('player1', event.target.value)}>
              {!options.players.includes(draft.player1) && <option value={draft.player1}>{draft.player1}</option>}
              {options.players.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label>Player 2
            <select value={draft.player2} onChange={(event) => setField('player2', event.target.value)}>
              {!options.players.includes(draft.player2) && <option value={draft.player2}>{draft.player2}</option>}
              {options.players.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>

          <label>Team 1
            <select value={draft.teamOne} onChange={(event) => setField('teamOne', event.target.value)}>
              {!options.teams.includes(draft.teamOne) && <option value={draft.teamOne}>{draft.teamOne}</option>}
              {options.teams.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label>Team 2
            <select value={draft.teamTwo} onChange={(event) => setField('teamTwo', event.target.value)}>
              {!options.teams.includes(draft.teamTwo) && <option value={draft.teamTwo}>{draft.teamTwo}</option>}
              {options.teams.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>

          <label>Player 1 score
            <input type="number" value={draft.player1Score ?? ''} onChange={(event) => setField('player1Score', toScore(event.target.value))} />
          </label>
          <label>Player 2 score
            <input type="number" value={draft.player2Score ?? ''} onChange={(event) => setField('player2Score', toScore(event.target.value))} />
          </label>

          <label>Player 1 tac op
            <TacOpSelect value={draft.player1Tac} tacOps={options.tacOps} onChange={(value) => setField('player1Tac', value)} />
          </label>
          <label>Player 2 tac op
            <TacOpSelect value={draft.player2Tac} tacOps={options.tacOps} onChange={(value) => setField('player2Tac', value)} />
          </label>
          </div>

          <section className="match-image-editor" aria-labelledby="match-images-heading">
            <div><h4 id="match-images-heading">Match images</h4><p>JPEG, PNG, or WebP. Maximum 10 MB each.</p></div>
            <label className="match-image-upload">Add images
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={isUpdatingImages} onChange={(event) => {
                const files = Array.from(event.target.files ?? [])
                if (files.length > 0) onUploadImages(files)
                event.target.value = ''
              }} />
            </label>
            {draft.images.length > 0 && <div className="match-image-editor-list">{draft.images.map((image, index) => <figure key={image.id}><img src={image.url} alt={image.caption ?? `Match photo ${index + 1}`} /><button type="button" onClick={() => onDeleteImage(image)} disabled={isUpdatingImages}>Remove</button></figure>)}</div>}
            {isUpdatingImages && <p className="match-image-status">Updating images…</p>}
            {imageError && <p className="match-edit-error">{imageError}</p>}
          </section>

          {error && <p className="match-edit-error">{error}</p>}

          <div className="wheel-dialog-actions">
            <button type="button" className="wheel-dialog-secondary" onClick={onCancel} disabled={isSaving}>Cancel</button>
            <button type="button" className="wheel-dialog-primary" onClick={() => onSave(draft)} disabled={isSaving}>{isSaving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MatchEditModal
