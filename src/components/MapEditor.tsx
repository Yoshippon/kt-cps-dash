import { useCallback, useEffect, useMemo, useState } from 'react'
import BoardCanvas from './map-editor/BoardCanvas'
import MapToolbar from './map-editor/MapToolbar'
import ObjectiveProperties from './map-editor/ObjectiveProperties'
import TerrainLibrary from './map-editor/TerrainLibrary'
import TerrainProperties from './map-editor/TerrainProperties'
import {
  createDefaultDeploymentZones,
  duplicateTerrainInstance,
  findObjectivePlacement,
  fitBoardToViewport,
  getBoardDimensions,
  getExampleObjectivePositions,
  INTERACTION_DISTANCE_IN,
  MAX_ZOOM,
  MIN_ZOOM,
  normalizeObjectivePosition,
  normalizeRotation,
  normalizeTerrainPosition,
  OBJECTIVE_DIAMETER_MM,
  transformObjectivesForOrientation,
  transformTerrainForOrientation,
  reorderTerrainInstances,
  zoomViewportAtPoint,
} from '../map/boardGeometry'
import { getTerrainDefinition } from '../map/terrainDefinitions'
import type { BoardOrientation, BoardPoint, MapDocument, ObjectiveMarker, TerrainDefinition, TerrainInstance, Viewport } from '../map/mapTypes'

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
    terrain: [],
  })
  const [gridVisible, setGridVisible] = useState(true)
  const [centerGuidesVisible, setCenterGuidesVisible] = useState(true)
  const [deploymentZonesVisible, setDeploymentZonesVisible] = useState(true)
  const [interactionRangesVisible, setInteractionRangesVisible] = useState(true)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [snapIncrement, setSnapIncrement] = useState(.5)
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(null)
  const [selectedTerrainId, setSelectedTerrainId] = useState<string | null>(null)
  const [terrainLibraryCollapsed, setTerrainLibraryCollapsed] = useState(false)
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
    setCanvasSize((current) => current.width === width && current.height === height ? current : { width, height })
    setViewport((current) => canvasSize.width === 0 || canvasSize.height === 0
      ? fitBoardToViewport(document.board, width, height)
      : current)
  }, [canvasSize.height, canvasSize.width, document.board])

  const handleOrientationChange = (orientation: BoardOrientation) => {
    const nextBoard = { ...getBoardDimensions(orientation), orientation }
    setDocument((current) => ({
      ...current,
      board: nextBoard,
      deploymentZones: createDefaultDeploymentZones(nextBoard),
      objectives: transformObjectivesForOrientation(current.objectives, current.board, nextBoard),
      terrain: transformTerrainForOrientation(current.terrain, current.board, nextBoard),
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
  const selectedTerrain = document.terrain.find((terrain) => terrain.id === selectedTerrainId) ?? null
  const selectedTerrainDefinition = selectedTerrain ? getTerrainDefinition(selectedTerrain.definitionId) : undefined

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

  const updateTerrainPosition = useCallback((terrainId: string, position: BoardPoint) => {
    setDocument((current) => ({
      ...current,
      terrain: current.terrain.map((terrain) => {
        if (terrain.id !== terrainId || terrain.locked) return terrain
        const definition = getTerrainDefinition(terrain.definitionId)
        return definition
          ? { ...terrain, ...normalizeTerrainPosition(position, current.board, definition, terrain.rotation, snapEnabled ? snapIncrement : null) }
          : terrain
      }),
    }))
  }, [snapEnabled, snapIncrement])

  const addTerrain = (definition: TerrainDefinition) => {
    const position = normalizeTerrainPosition(
      { x: board.width / 2, y: board.height / 2 },
      board,
      definition,
      0,
      snapEnabled ? snapIncrement : null,
    )
    const terrain: TerrainInstance = {
      id: crypto.randomUUID(),
      definitionId: definition.id,
      x: position.x,
      y: position.y,
      rotation: 0,
      locked: false,
    }
    setDocument((current) => ({ ...current, terrain: [...current.terrain, terrain] }))
    setSelectedTerrainId(terrain.id)
    setSelectedObjectiveId(null)
  }

  const updateSelectedTerrainPosition = (axis: 'x' | 'y', value: number) => {
    if (!selectedTerrain || !Number.isFinite(value)) return
    updateTerrainPosition(selectedTerrain.id, { ...selectedTerrain, [axis]: value })
  }

  const updateSelectedTerrainRotation = (rotation: number) => {
    if (!selectedTerrain || selectedTerrain.locked || !Number.isFinite(rotation)) return
    setDocument((current) => ({
      ...current,
      terrain: current.terrain.map((terrain) => {
        if (terrain.id !== selectedTerrain.id) return terrain
        const definition = getTerrainDefinition(terrain.definitionId)
        const nextRotation = normalizeRotation(rotation)
        return definition
          ? { ...terrain, rotation: nextRotation, ...normalizeTerrainPosition(terrain, current.board, definition, nextRotation, null) }
          : terrain
      }),
    }))
  }

  const rotateSelectedTerrain = useCallback((delta: number) => {
    if (!selectedTerrainId) return
    setDocument((current) => ({
      ...current,
      terrain: current.terrain.map((terrain) => {
        if (terrain.id !== selectedTerrainId || terrain.locked) return terrain
        const definition = getTerrainDefinition(terrain.definitionId)
        const rotation = normalizeRotation(terrain.rotation + delta)
        return definition
          ? { ...terrain, rotation, ...normalizeTerrainPosition(terrain, current.board, definition, rotation, null) }
          : terrain
      }),
    }))
  }, [selectedTerrainId])

  const deleteSelectedTerrain = useCallback(() => {
    if (!selectedTerrainId || selectedTerrain?.locked) return
    setDocument((current) => ({ ...current, terrain: current.terrain.filter((terrain) => terrain.id !== selectedTerrainId) }))
    setSelectedTerrainId(null)
  }, [selectedTerrain?.locked, selectedTerrainId])

  const duplicateSelectedTerrain = () => {
    if (!selectedTerrain || !selectedTerrainDefinition) return
    const duplicate = duplicateTerrainInstance(
      selectedTerrain,
      crypto.randomUUID(),
      board,
      selectedTerrainDefinition,
      snapEnabled ? snapIncrement : null,
    )
    setDocument((current) => ({ ...current, terrain: [...current.terrain, duplicate] }))
    setSelectedTerrainId(duplicate.id)
  }

  const toggleSelectedTerrainLock = () => {
    if (!selectedTerrainId) return
    setDocument((current) => ({
      ...current,
      terrain: current.terrain.map((terrain) => terrain.id === selectedTerrainId ? { ...terrain, locked: !terrain.locked } : terrain),
    }))
  }

  const moveSelectedTerrainLayer = (operation: 'forward' | 'backward' | 'front' | 'back') => {
    if (!selectedTerrainId) return
    setDocument((current) => {
      return { ...current, terrain: reorderTerrainInstances(current.terrain, selectedTerrainId, operation) }
    })
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement
        || event.target instanceof HTMLSelectElement
        || event.target instanceof HTMLTextAreaElement
      ) return
      if (event.key === 'Escape') {
        setSelectedObjectiveId(null)
        setSelectedTerrainId(null)
      } else if (event.key.toLowerCase() === 'r' && selectedTerrain) {
        rotateSelectedTerrain(event.shiftKey ? -90 : 90)
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedTerrain) deleteSelectedTerrain()
        else deleteSelectedObjective()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteSelectedObjective, deleteSelectedTerrain, rotateSelectedTerrain, selectedTerrain])

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
        <TerrainLibrary
          collapsed={terrainLibraryCollapsed}
          onCollapsedChange={setTerrainLibraryCollapsed}
          onAddTerrain={addTerrain}
        />
        <div className="map-board-stage">
          <BoardCanvas
          board={board}
          gridVisible={gridVisible}
          centerGuidesVisible={centerGuidesVisible}
          deploymentZones={document.deploymentZones}
          deploymentZonesVisible={deploymentZonesVisible}
          objectives={document.objectives}
          terrain={document.terrain}
          selectedObjectiveId={selectedObjectiveId}
          selectedTerrainId={selectedTerrainId}
          interactionRangesVisible={interactionRangesVisible}
          viewport={viewport}
          minScale={fittedViewport.scale * MIN_ZOOM}
          maxScale={fittedViewport.scale * MAX_ZOOM}
          onViewportChange={setViewport}
          onCanvasResize={handleCanvasResize}
          onPointerBoardPosition={setPointerPosition}
          onObjectiveSelect={(objectiveId) => {
            setSelectedObjectiveId(objectiveId)
            if (objectiveId) setSelectedTerrainId(null)
          }}
          onObjectiveMove={updateObjectivePosition}
          onTerrainSelect={(terrainId) => {
            setSelectedTerrainId(terrainId)
            if (terrainId) setSelectedObjectiveId(null)
          }}
          onTerrainMove={updateTerrainPosition}
        />
        </div>
      </div>
      {selectedTerrain && selectedTerrainDefinition ? (
        <TerrainProperties
          terrain={selectedTerrain}
          definition={selectedTerrainDefinition}
          onPositionChange={updateSelectedTerrainPosition}
          onRotationChange={updateSelectedTerrainRotation}
          onRotate={rotateSelectedTerrain}
          onDuplicate={duplicateSelectedTerrain}
          onDelete={deleteSelectedTerrain}
          onLockToggle={toggleSelectedTerrainLock}
          onMoveLayer={moveSelectedTerrainLayer}
        />
      ) : selectedObjective && (
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
