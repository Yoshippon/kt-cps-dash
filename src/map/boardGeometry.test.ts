import { describe, expect, it } from 'vitest'
import {
  clampObjectivePosition,
  clampTerrainPosition,
  duplicateTerrainInstance,
  boardToScreen,
  canModifyTerrain,
  createDefaultDeploymentZones,
  getBoardDimensions,
  INTERACTION_DISTANCE_IN,
  OBJECTIVE_OUTER_RADIUS_IN,
  OBJECTIVE_RADIUS_IN,
  normalizeObjectivePosition,
  normalizeRotation,
  reorderTerrainInstances,
  rotatePointClockwise,
  screenToBoard,
  snapToIncrement,
  transformObjectivesForOrientation,
  transformTerrainForOrientation,
} from './boardGeometry'
import type { ObjectiveMarker, TerrainDefinition, TerrainInstance } from './mapTypes'

const landscapeBoard = { ...getBoardDimensions('landscape'), orientation: 'landscape' as const }
const portraitBoard = { ...getBoardDimensions('portrait'), orientation: 'portrait' as const }
const terrainDefinition: TerrainDefinition = {
  id: 'test-terrain',
  name: 'Test Terrain',
  environmentId: 'generic',
  widthIn: 6,
  heightIn: 2,
  footprint: { type: 'rectangle' },
  category: 'Test',
  color: '#000000',
}
const terrainInstance: TerrainInstance = {
  id: 'terrain-1',
  definitionId: terrainDefinition.id,
  x: 5,
  y: 5,
  rotation: 0,
  locked: false,
}

describe('objective geometry', () => {
  it('converts the 40 mm objective diameter to inches and includes the edge interaction range', () => {
    expect(OBJECTIVE_RADIUS_IN).toBeCloseTo(40 / 2 / 25.4)
    expect(OBJECTIVE_OUTER_RADIUS_IN).toBeCloseTo(OBJECTIVE_RADIUS_IN + INTERACTION_DISTANCE_IN)
  })

  describe('terrain geometry', () => {
    it('clamps rotated terrain using its rotated footprint', () => {
      const position = clampTerrainPosition({ x: 1, y: 1 }, landscapeBoard, terrainDefinition, 90)
      expect(position.x).toBeCloseTo(1)
      expect(position.y).toBe(3)
    })

    it('normalizes rotations and restores terrain through orientation changes', () => {
      expect(normalizeRotation(-90)).toBe(270)
      const portraitTerrain = transformTerrainForOrientation([terrainInstance], landscapeBoard, portraitBoard)
      expect(transformTerrainForOrientation(portraitTerrain, portraitBoard, landscapeBoard)).toEqual([terrainInstance])
    })

    it('duplicates unlocked terrain with an offset and keeps locked terrain immutable', () => {
      expect(duplicateTerrainInstance(terrainInstance, 'terrain-2', landscapeBoard, terrainDefinition, .5)).toMatchObject({
        id: 'terrain-2',
        x: 6,
        y: 6,
        locked: false,
      })
      expect(canModifyTerrain({ ...terrainInstance, locked: true })).toBe(false)
    })

    it('reorders terrain by visible stacking order', () => {
      const second = { ...terrainInstance, id: 'terrain-2' }
      const third = { ...terrainInstance, id: 'terrain-3' }
      expect(reorderTerrainInstances([terrainInstance, second, third], 'terrain-1', 'front').map((terrain) => terrain.id))
        .toEqual(['terrain-2', 'terrain-3', 'terrain-1'])
    })
  })

  it('clamps the central marker inside the board', () => {
    expect(clampObjectivePosition({ x: -4, y: 30 }, landscapeBoard)).toEqual({
      x: OBJECTIVE_RADIUS_IN,
      y: landscapeBoard.height - OBJECTIVE_RADIUS_IN,
    })
  })

  it('snaps before clamping objective coordinates', () => {
    expect(snapToIncrement(5.24, .25)).toBe(5.25)
    expect(normalizeObjectivePosition({ x: 5.24, y: 7.26 }, landscapeBoard, .5)).toEqual({ x: 5, y: 7.5 })
  })
})

describe('deployment zones', () => {
  it('creates full-width 3 inch landscape deployment zones', () => {
    const zones = createDefaultDeploymentZones(landscapeBoard)
    expect(zones).toHaveLength(2)
    expect(zones[0].polygon).toEqual([{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 3 }, { x: 0, y: 3 }])
    expect(zones[1].polygon).toEqual([{ x: 0, y: 19 }, { x: 30, y: 19 }, { x: 30, y: 22 }, { x: 0, y: 22 }])
  })

  it('creates full-width 6 inch portrait deployment zones', () => {
    const zones = createDefaultDeploymentZones(portraitBoard)
    expect(zones[0].polygon[2]).toEqual({ x: 22, y: 6 })
    expect(zones[1].polygon[0]).toEqual({ x: 0, y: 24 })
  })
})

describe('board transformations', () => {
  it('keeps board and screen coordinates inverse under pan and zoom', () => {
    const viewport = { scale: 24, offsetX: 120, offsetY: 80 }
    const boardPoint = { x: 15, y: 11 }
    expect(screenToBoard(boardToScreen(boardPoint, viewport), viewport)).toEqual(boardPoint)
  })

  it('rotates landscape objectives clockwise and restores them on reverse orientation', () => {
    const objective: ObjectiveMarker = {
      id: 'objective-1',
      number: 1,
      x: 5,
      y: 15,
      diameterMm: 40,
      interactionRangeIn: 1,
    }
    expect(rotatePointClockwise(objective, landscapeBoard)).toEqual({ x: 7, y: 5 })
    const portraitObjectives = transformObjectivesForOrientation([objective], landscapeBoard, portraitBoard)
    expect(transformObjectivesForOrientation(portraitObjectives, portraitBoard, landscapeBoard)).toEqual([objective])
  })
})
