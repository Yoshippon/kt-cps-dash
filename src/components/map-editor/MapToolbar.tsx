import type { BoardOrientation } from '../../map/mapTypes'

type MapToolbarProps = {
  orientation: BoardOrientation
  gridVisible: boolean
  centerGuidesVisible: boolean
  deploymentZonesVisible: boolean
  interactionRangesVisible: boolean
  snapEnabled: boolean
  snapIncrement: number
  zoom: number
  onOrientationChange: (orientation: BoardOrientation) => void
  onGridVisibleChange: (visible: boolean) => void
  onCenterGuidesVisibleChange: (visible: boolean) => void
  onDeploymentZonesVisibleChange: (visible: boolean) => void
  onInteractionRangesVisibleChange: (visible: boolean) => void
  onSnapEnabledChange: (enabled: boolean) => void
  onSnapIncrementChange: (increment: number) => void
  onAddObjective: () => void
  onResetObjectives: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onFitToScreen: () => void
}

function MapToolbar({
  orientation,
  gridVisible,
  centerGuidesVisible,
  deploymentZonesVisible,
  interactionRangesVisible,
  snapEnabled,
  snapIncrement,
  zoom,
  onOrientationChange,
  onGridVisibleChange,
  onCenterGuidesVisibleChange,
  onDeploymentZonesVisibleChange,
  onInteractionRangesVisibleChange,
  onSnapEnabledChange,
  onSnapIncrementChange,
  onAddObjective,
  onResetObjectives,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
}: MapToolbarProps) {
  return (
    <header className="map-editor-toolbar">
      <div className="map-editor-title">
        <p className="section-kicker">Battlefield tools</p>
        <h2>Map Editor</h2>
      </div>
      <div className="map-editor-controls">
        <button type="button" className="map-editor-action" onClick={onAddObjective}>Add objective</button>
        <details className="map-editor-menu">
          <summary>Display</summary>
          <div className="map-editor-menu-panel">
            <label className="map-editor-checkbox">
              <input type="checkbox" checked={gridVisible} onChange={(event) => onGridVisibleChange(event.target.checked)} />
              <span>Grid</span>
            </label>
            <label className="map-editor-checkbox">
              <input type="checkbox" checked={centerGuidesVisible} onChange={(event) => onCenterGuidesVisibleChange(event.target.checked)} />
              <span>Center guides</span>
            </label>
            <label className="map-editor-checkbox">
              <input type="checkbox" checked={deploymentZonesVisible} onChange={(event) => onDeploymentZonesVisibleChange(event.target.checked)} />
              <span>Deployment zones</span>
            </label>
            <label className="map-editor-checkbox">
              <input type="checkbox" checked={interactionRangesVisible} onChange={(event) => onInteractionRangesVisibleChange(event.target.checked)} />
              <span>Interaction ranges</span>
            </label>
          </div>
        </details>
        <details className="map-editor-menu">
          <summary>Settings</summary>
          <div className="map-editor-menu-panel">
            <label>
              Orientation
              <select value={orientation} onChange={(event) => onOrientationChange(event.target.value as BoardOrientation)}>
                <option value="landscape">Landscape · 30 × 22 in</option>
                <option value="portrait">Portrait · 22 × 30 in</option>
              </select>
            </label>
            <label className="map-editor-checkbox">
              <input type="checkbox" checked={snapEnabled} onChange={(event) => onSnapEnabledChange(event.target.checked)} />
              <span>Snap</span>
            </label>
            <label>
              Snap increment
              <select value={snapIncrement} disabled={!snapEnabled} onChange={(event) => onSnapIncrementChange(Number(event.target.value))}>
                <option value={0.5}>0.5 in</option>
                <option value={0.25}>0.25 in</option>
              </select>
            </label>
            <button type="button" className="map-editor-menu-action" onClick={onResetObjectives}>Reset objectives</button>
          </div>
        </details>
        <div className="map-editor-zoom-controls" aria-label="View controls">
          <button type="button" onClick={onZoomOut} aria-label="Zoom out">−</button>
          <button type="button" onClick={onZoomIn} aria-label="Zoom in">+</button>
          <button type="button" onClick={onFitToScreen}>Fit board</button>
          <output aria-label="Current zoom">{Math.round(zoom * 100)}%</output>
        </div>
      </div>
    </header>
  )
}

export default MapToolbar
