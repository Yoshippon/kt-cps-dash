import type { BoardDimensions, BoardOrientation, BoardPoint, DeploymentZone, ObjectiveMarker, Viewport } from './mapTypes'

export const BOARD_DIMENSIONS: Record<BoardOrientation, BoardDimensions> = {
  landscape: { width: 30, height: 22 },
  portrait: { width: 22, height: 30 },
}

export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 4
export const MM_PER_INCH = 25.4
export const OBJECTIVE_DIAMETER_MM = 40
export const OBJECTIVE_RADIUS_IN = (OBJECTIVE_DIAMETER_MM / 2) / MM_PER_INCH
export const INTERACTION_DISTANCE_IN = 1
export const OBJECTIVE_OUTER_RADIUS_IN = OBJECTIVE_RADIUS_IN + INTERACTION_DISTANCE_IN

export const getObjectiveRadiusIn = (diameterMm = OBJECTIVE_DIAMETER_MM) => (diameterMm / 2) / MM_PER_INCH

const DEPLOYMENT_DEPTHS: Record<BoardOrientation, number> = {
  landscape: 3,
  portrait: 6,
}

export const getBoardDimensions = (orientation: BoardOrientation): BoardDimensions => BOARD_DIMENSIONS[orientation]

export const inchesToPixels = (value: number, scale: number) => value * scale

export const pixelsToInches = (value: number, scale: number) => value / scale

export const boardToScreen = (point: BoardPoint, viewport: Viewport): BoardPoint => ({
  x: viewport.offsetX + inchesToPixels(point.x, viewport.scale),
  y: viewport.offsetY + inchesToPixels(point.y, viewport.scale),
})

export const screenToBoard = (point: BoardPoint, viewport: Viewport): BoardPoint => ({
  x: pixelsToInches(point.x - viewport.offsetX, viewport.scale),
  y: pixelsToInches(point.y - viewport.offsetY, viewport.scale),
})

export const fitBoardToViewport = (
  board: BoardDimensions,
  viewportWidth: number,
  viewportHeight: number,
  padding = 40,
): Viewport => {
  const availableWidth = Math.max(1, viewportWidth - padding * 2)
  const availableHeight = Math.max(1, viewportHeight - padding * 2)
  const scale = Math.min(availableWidth / board.width, availableHeight / board.height)

  return {
    scale,
    offsetX: (viewportWidth - inchesToPixels(board.width, scale)) / 2,
    offsetY: (viewportHeight - inchesToPixels(board.height, scale)) / 2,
  }
}

export const zoomViewportAtPoint = (
  viewport: Viewport,
  screenPoint: BoardPoint,
  factor: number,
  minScale = MIN_ZOOM,
  maxScale = MAX_ZOOM,
): Viewport => {
  const scale = Math.min(maxScale, Math.max(minScale, viewport.scale * factor))
  const boardPoint = screenToBoard(screenPoint, viewport)

  return {
    scale,
    offsetX: screenPoint.x - inchesToPixels(boardPoint.x, scale),
    offsetY: screenPoint.y - inchesToPixels(boardPoint.y, scale),
  }
}

export const panViewport = (viewport: Viewport, delta: BoardPoint): Viewport => ({
  ...viewport,
  offsetX: viewport.offsetX + delta.x,
  offsetY: viewport.offsetY + delta.y,
})

export const isPointOnBoard = (point: BoardPoint, board: BoardDimensions) => (
  point.x >= 0 && point.x <= board.width && point.y >= 0 && point.y <= board.height
)

export const getDeploymentDepth = (orientation: BoardOrientation) => DEPLOYMENT_DEPTHS[orientation]

export const createDefaultDeploymentZones = (
  board: BoardDimensions & { orientation: BoardOrientation },
): DeploymentZone[] => {
  const depth = getDeploymentDepth(board.orientation)
  return [
    {
      id: 'player-1-deployment',
      player: 1,
      color: 'rgba(77, 124, 139, .25)',
      visible: true,
      polygon: [{ x: 0, y: 0 }, { x: board.width, y: 0 }, { x: board.width, y: depth }, { x: 0, y: depth }],
    },
    {
      id: 'player-2-deployment',
      player: 2,
      color: 'rgba(221, 93, 50, .24)',
      visible: true,
      polygon: [
        { x: 0, y: board.height - depth },
        { x: board.width, y: board.height - depth },
        { x: board.width, y: board.height },
        { x: 0, y: board.height },
      ],
    },
  ]
}

export const snapToIncrement = (value: number, increment: number) => Math.round(value / increment) * increment

export const clampObjectivePosition = (point: BoardPoint, board: BoardDimensions): BoardPoint => ({
  x: Math.min(board.width - OBJECTIVE_RADIUS_IN, Math.max(OBJECTIVE_RADIUS_IN, point.x)),
  y: Math.min(board.height - OBJECTIVE_RADIUS_IN, Math.max(OBJECTIVE_RADIUS_IN, point.y)),
})

export const normalizeObjectivePosition = (
  point: BoardPoint,
  board: BoardDimensions,
  snapIncrement: number | null,
): BoardPoint => {
  const snapped = snapIncrement
    ? { x: snapToIncrement(point.x, snapIncrement), y: snapToIncrement(point.y, snapIncrement) }
    : point
  return clampObjectivePosition(snapped, board)
}

export const findObjectivePlacement = (
  objectives: ObjectiveMarker[],
  board: BoardDimensions,
  snapIncrement: number | null,
): BoardPoint => {
  const increment = snapIncrement ?? .5
  const candidates: BoardPoint[] = []
  for (let y = OBJECTIVE_RADIUS_IN; y <= board.height - OBJECTIVE_RADIUS_IN; y += increment) {
    for (let x = OBJECTIVE_RADIUS_IN; x <= board.width - OBJECTIVE_RADIUS_IN; x += increment) {
      candidates.push(normalizeObjectivePosition({ x, y }, board, snapIncrement))
    }
  }
  candidates.sort((first, second) => (
    Math.hypot(first.x - board.width / 2, first.y - board.height / 2)
    - Math.hypot(second.x - board.width / 2, second.y - board.height / 2)
  ))
  return candidates.find((candidate) => objectives.every((objective) => (
    Math.hypot(candidate.x - objective.x, candidate.y - objective.y) >= OBJECTIVE_RADIUS_IN * 2
  ))) ?? normalizeObjectivePosition({ x: board.width / 2, y: board.height / 2 }, board, snapIncrement)
}

export const rotatePointClockwise = (point: BoardPoint, board: BoardDimensions): BoardPoint => ({
  x: board.height - point.y,
  y: point.x,
})

export const rotatePointCounterClockwise = (point: BoardPoint, board: BoardDimensions): BoardPoint => ({
  x: point.y,
  y: board.width - point.x,
})

export const transformObjectivesForOrientation = (
  objectives: ObjectiveMarker[],
  oldBoard: BoardDimensions & { orientation: BoardOrientation },
  nextBoard: BoardDimensions & { orientation: BoardOrientation },
): ObjectiveMarker[] => {
  if (oldBoard.orientation === nextBoard.orientation) return objectives
  const transform = oldBoard.orientation === 'landscape' ? rotatePointClockwise : rotatePointCounterClockwise
  return objectives.map((objective) => ({ ...objective, ...transform(objective, oldBoard) }))
}

export const getExampleObjectivePositions = (orientation: BoardOrientation): BoardPoint[] => (
  orientation === 'landscape'
    ? [{ x: 5, y: 15 }, { x: 15, y: 11 }, { x: 25, y: 7 }]
    : [{ x: 5, y: 21 }, { x: 11, y: 15 }, { x: 17, y: 9 }]
)
