import { useEffect, useState } from 'react'
import type { MatchFormOptions, MatchRecord } from '../services/matches'

interface MatchEditModalProps {
  match: MatchRecord
  options: MatchFormOptions
  isSaving: boolean
  error: string | null
  onCancel: () => void
  onSave: (match: MatchRecord) => void
}

function MatchEditModal({ match, options, isSaving, error, onCancel, onSave }: MatchEditModalProps) {
  const [draft, setDraft] = useState<MatchRecord>(match)

  useEffect(() => {
    setDraft(match)
  }, [match])

  const setField = <K extends keyof MatchRecord>(key: K, value: MatchRecord[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const toScore = (value: string) => (value === '' ? null : Number(value))

  return (
    <div className="wheel-overlay" role="dialog" aria-modal="true" aria-labelledby="match-edit-heading">
      <div className="wheel-modal match-edit-modal">
        <button type="button" className="wheel-close" aria-label="Close" onClick={onCancel} disabled={isSaving}>&times;</button>
        <h3 id="match-edit-heading">Edit match</h3>
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
            <input type="text" value={draft.player1Tac ?? ''} onChange={(event) => setField('player1Tac', event.target.value || null)} />
          </label>
          <label>Player 2 tac op
            <input type="text" value={draft.player2Tac ?? ''} onChange={(event) => setField('player2Tac', event.target.value || null)} />
          </label>
        </div>

        {error && <p className="match-edit-error">{error}</p>}

        <div className="wheel-dialog-actions">
          <button type="button" className="wheel-dialog-secondary" onClick={onCancel} disabled={isSaving}>Cancel</button>
          <button type="button" className="wheel-dialog-primary" onClick={() => onSave(draft)} disabled={isSaving}>{isSaving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>
    </div>
  )
}

export default MatchEditModal
