import type { ObjectiveMarker } from '../../map/mapTypes'

type ObjectivePropertiesProps = {
  objective: ObjectiveMarker
  onPositionChange: (axis: 'x' | 'y', value: number) => void
  onDelete: () => void
}

function ObjectiveProperties({ objective, onPositionChange, onDelete }: ObjectivePropertiesProps) {
  return (
    <aside className="objective-properties" aria-label={`Objective ${objective.number} properties`}>
      <strong>Objective {objective.number}</strong>
      <label>
        X position (in)
        <input
          type="number"
          value={objective.x}
          step="0.01"
          onChange={(event) => onPositionChange('x', event.target.valueAsNumber)}
        />
      </label>
      <label>
        Y position (in)
        <input
          type="number"
          value={objective.y}
          step="0.01"
          onChange={(event) => onPositionChange('y', event.target.valueAsNumber)}
        />
      </label>
      <button type="button" onClick={onDelete}>Delete objective</button>
    </aside>
  )
}

export default ObjectiveProperties
