import type { TerrainDefinition, TerrainInstance } from '../../map/mapTypes'

type TerrainPropertiesProps = {
  terrain: TerrainInstance
  definition: TerrainDefinition
  onPositionChange: (axis: 'x' | 'y', value: number) => void
  onRotationChange: (rotation: number) => void
  onRotate: (delta: number) => void
  onDuplicate: () => void
  onDelete: () => void
  onLockToggle: () => void
  onMoveLayer: (operation: 'forward' | 'backward' | 'front' | 'back') => void
}

function TerrainProperties({
  terrain,
  definition,
  onPositionChange,
  onRotationChange,
  onRotate,
  onDuplicate,
  onDelete,
  onLockToggle,
  onMoveLayer,
}: TerrainPropertiesProps) {
  return (
    <aside className="terrain-properties" aria-label={`${definition.name} properties`}>
      <div>
        <strong>{definition.name}</strong>
        <span>{definition.environmentId} · {definition.widthIn}" × {definition.heightIn}"</span>
      </div>
      <label>X position (in)<input type="number" value={terrain.x} step=".01" onChange={(event) => onPositionChange('x', event.target.valueAsNumber)} /></label>
      <label>Y position (in)<input type="number" value={terrain.y} step=".01" onChange={(event) => onPositionChange('y', event.target.valueAsNumber)} /></label>
      <label>Rotation<input type="number" value={terrain.rotation} step="15" onChange={(event) => onRotationChange(event.target.valueAsNumber)} /></label>
      <div className="terrain-property-actions">
        <button type="button" onClick={() => onRotate(-90)} disabled={terrain.locked}>↶ 90°</button>
        <button type="button" onClick={() => onRotate(90)} disabled={terrain.locked}>↷ 90°</button>
        <button type="button" onClick={onDuplicate}>Duplicate</button>
        <button type="button" onClick={onLockToggle}>{terrain.locked ? 'Unlock' : 'Lock'}</button>
        <button type="button" onClick={onDelete} disabled={terrain.locked}>Delete</button>
      </div>
      <div className="terrain-property-actions terrain-layer-actions">
        <button type="button" onClick={() => onMoveLayer('back')}>Back</button>
        <button type="button" onClick={() => onMoveLayer('backward')}>− Layer</button>
        <button type="button" onClick={() => onMoveLayer('forward')}>+ Layer</button>
        <button type="button" onClick={() => onMoveLayer('front')}>Front</button>
      </div>
    </aside>
  )
}

export default TerrainProperties
