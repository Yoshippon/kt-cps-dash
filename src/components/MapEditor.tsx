import { useCallback, useEffect, useMemo, useState } from 'react'
import BoardCanvas from './map-editor/BoardCanvas'
import MapToolbar from './map-editor/MapToolbar'
import ObjectiveProperties from './map-editor/ObjectiveProperties'
import {
  createDefaultDeploymentZones,
  findObjectivePlacement,
  fitBoardToViewport,
  getBoardDimensions,
  getExampleObjectivePositions,
  INTERACTION_DISTANCE_IN,
  MAX_ZOOM,
  MIN_ZOOM,
  normalizeObjectivePosition,
  OBJECTIVE_DIAMETER_MM,
  transformObjectivesForOrientation,
  zoomViewportAtPoint,
} from '../map/boardGeometry'
import type { BoardOrientation, BoardPoint, MapDocument, ObjectiveMarker, Viewport } from '../map/mapTypes'

const INITIAL_VIEWPORT: Viewport = { scale: 1, offsetX: 0, offsetY: 0 }

function MapEditor({ isActive }: { isActive: boolean }) {
  const [document, setDocument] = useState<MapDocument>({
    id: 'new-map',
    name: 'Untitled battlefield',
    version: 1,
    board: { ...getBoardDimensions('landscape'), orientation: 'landscape' },
    objects: [],
    deploymentZones: createDefaultDeploymentZones({ ...getBoardDimensions('landscape'), orientation: 'landscape' }),
    objectives: [],
  })
  const [gridVisible, setGridVisible] = useState(true)
  const [centerGuidesVisible, setCenterGuidesVisible] = useState(true)
  const [deploymentZonesVisible, setDeploymentZonesVisible] = useState(true)
  const [interactionRangesVisible, setInteractionRangesVisible] = useState(true)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [snapIncrement, setSnapIncrement] = useState(.5)
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(null)
  const [viewport, setViewport] = useState(INITIAL_VIEWPORT)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const [pointerPosition, setPointerPosition] = useState<BoardPoint | null>(null)
  const board = document.board
  const fittedViewport = useMemo(() => fitBoardToViewport(board, canvasSize.width, canvasSize.height), [board, canvasSize])
  const zoom = canvasSize.width > 0 && canvasSize.height > 0 ? viewport.scale / fittedViewport.scale : 1

  const fitBoard = useCallback((nextBoard = board, nextCanvasSize = canvasSize) => {
    if (nextCanvasSize.width === 0 || nextCanvasSize.height === 0) return
    setViewport(fitBoardToViewport(nextBoard, nextCanvasSize.width, nextCanvasSize.height))
  }, [board, canvasSize])

  const handleCanvasResize = useCallback((width: number, height: number) => {
    setCanvasSize({ width, height })
    setViewport(fitBoardToViewport(document.board, width, height))
  }, [document.board])

  const handleOrientationChange = (orientation: BoardOrientation) => {
    const nextBoard = { ...getBoardDimensions(orientation), orientation }
    setDocument((current) => ({
      ...current,
      board: nextBoard,
      deploymentZones: createDefaultDeploymentZones(nextBoard),
      objectives: transformObjectivesForOrientation(current.objectives, current.board, nextBoard),
    }))
    fitBoard(nextBoard)
  }

  const zoomAtCanvasCenter = (factor: number) => {
    setViewport((current) => zoomViewportAtPoint(current, {
      x: canvasSize.width / 2,
      y: canvasSize.height / 2,
    }, factor, fittedViewport.scale * MIN_ZOOM, fittedViewport.scale * MAX_ZOOM))
  }

  const dimensionLabel = useMemo(() => `${board.width}" × ${board.height}"`, [board.height, board.width])
  const selectedObjective = document.objectives.find((objective) => objective.id === selectedObjectiveId) ?? null

  const updateObjectivePosition = useCallback((objectiveId: string, position: BoardPoint) => {
    setDocument((current) => ({
      ...current,
      objectives: current.objectives.map((objective) => (
        objective.id === objectiveId
          ? {
              ...objective,
              ...normalizeObjectivePosition(position, current.board, snapEnabled ? snapIncrement : null),
            }
          : objective
      )),
    }))
  }, [snapEnabled, snapIncrement])

  const updateSelectedObjectivePosition = (axis: 'x' | 'y', value: number) => {
    if (!selectedObjective || !Number.isFinite(value)) return
    updateObjectivePosition(selectedObjective.id, { ...selectedObjective, [axis]: value })
  }

  const addObjective = () => {
    const number = Math.max(0, ...document.objectives.map((objective) => objective.number)) + 1
    const position = findObjectivePlacement(
      document.objectives,
      board,
      snapEnabled ? snapIncrement : null,
    )
    const objective: ObjectiveMarker = {
      id: crypto.randomUUID(),
      number,
      x: position.x,
      y: position.y,
      diameterMm: OBJECTIVE_DIAMETER_MM,
      interactionRangeIn: INTERACTION_DISTANCE_IN,
    }
    setDocument((current) => ({ ...current, objectives: [...current.objectives, objective] }))
    setSelectedObjectiveId(objective.id)
  }

  const resetObjectives = () => {
    if (document.objectives.length > 0 && !window.confirm('Replace all objectives with the example layout?')) return
    const objectives = getExampleObjectivePositions(board.orientation).map((position, index): ObjectiveMarker => ({
      id: crypto.randomUUID(),
      number: index + 1,
      x: position.x,
      y: position.y,
      diameterMm: OBJECTIVE_DIAMETER_MM,
      interactionRangeIn: INTERACTION_DISTANCE_IN,
    }))
    setDocument((current) => ({ ...current, objectives }))
    setSelectedObjectiveId(objectives[0]?.id ?? null)
  }

  const deleteSelectedObjective = useCallback(() => {
    if (!selectedObjectiveId) return
    setDocument((current) => ({
      ...current,
      objectives: current.objectives.filter((objective) => objective.id !== selectedObjectiveId),
    }))
    setSelectedObjectiveId(null)
  }, [selectedObjectiveId])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        (event.key !== 'Delete' && event.key !== 'Backspace')
        || event.target instanceof HTMLInputElement
        || event.target instanceof HTMLSelectElement
        || event.target instanceof HTMLTextAreaElement
      ) return
      deleteSelectedObjective()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteSelectedObjective])

  if (!isActive) return null

  return (
    <section className="map-editor" aria-labelledby="map-editor-heading">
      <MapToolbar
        orientation={board.orientation}
        gridVisible={gridVisible}
        centerGuidesVisible={centerGuidesVisible}
        deploymentZonesVisible={deploymentZonesVisible}
        interactionRangesVisible={interactionRangesVisible}
        snapEnabled={snapEnabled}
        snapIncrement={snapIncrement}
        zoom={zoom}
        onOrientationChange={handleOrientationChange}
        onGridVisibleChange={setGridVisible}
        onCenterGuidesVisibleChange={setCenterGuidesVisible}
        onDeploymentZonesVisibleChange={setDeploymentZonesVisible}
        onInteractionRangesVisibleChange={setInteractionRangesVisible}
        onSnapEnabledChange={setSnapEnabled}
        onSnapIncrementChange={setSnapIncrement}
        onAddObjective={addObjective}
        onResetObjectives={resetObjectives}
        onZoomIn={() => zoomAtCanvasCenter(1.2)}
        onZoomOut={() => zoomAtCanvasCenter(1 / 1.2)}
        onFitToScreen={() => fitBoard()}
      />
      <div className="map-editor-workspace">
        <BoardCanvas
          board={board}
          gridVisible={gridVisible}
          centerGuidesVisible={centerGuidesVisible}
          deploymentZones={document.deploymentZones}
          deploymentZonesVisible={deploymentZonesVisible}
          objectives={document.objectives}
          selectedObjectiveId={selectedObjectiveId}
          interactionRangesVisible={interactionRangesVisible}
          viewport={viewport}
          minScale={fittedViewport.scale * MIN_ZOOM}
          maxScale={fittedViewport.scale * MAX_ZOOM}
          onViewportChange={setViewport}
          onCanvasResize={handleCanvasResize}
          onPointerBoardPosition={setPointerPosition}
          onObjectiveSelect={setSelectedObjectiveId}
          onObjectiveMove={updateObjectivePosition}
        />
      </div>
      {selectedObjective && (
        <ObjectiveProperties
          objective={selectedObjective}
          onPositionChange={updateSelectedObjectivePosition}
          onDelete={deleteSelectedObjective}
        />
      )}
      <footer className="map-editor-status">
        <span>Board {dimensionLabel}</span>
        <span>{gridVisible ? '1 in grid visible' : 'Grid hidden'}</span>
        <span>{pointerPosition ? `Cursor ${pointerPosition.x}", ${pointerPosition.y}"` : 'Cursor outside board'}</span>
        <span>{Math.round(zoom * 100)}% zoom</span>
      </footer>
    </section>
  )
}

export default MapEditor
