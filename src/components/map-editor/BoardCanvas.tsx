import { memo, useCallback, useEffect, useRef } from 'react'
import {
  boardToScreen,
  isPointOnBoard,
  panViewport,
  screenToBoard,
  zoomViewportAtPoint,
} from '../../map/boardGeometry'
import { drawDeploymentZoneBoundaries, drawDeploymentZoneFills } from './DeploymentZoneLayer'
import { drawObjectives, getObjectiveAtPoint } from './ObjectiveLayer'
import type { BoardDimensions, BoardPoint, DeploymentZone, ObjectiveMarker, Viewport } from '../../map/mapTypes'

type BoardCanvasProps = {
  board: BoardDimensions
  gridVisible: boolean
  centerGuidesVisible: boolean
  deploymentZones: DeploymentZone[]
  deploymentZonesVisible: boolean
  objectives: ObjectiveMarker[]
  selectedObjectiveId: string | null
  interactionRangesVisible: boolean
  viewport: Viewport
  minScale: number
  maxScale: number
  onViewportChange: (viewport: Viewport) => void
  onCanvasResize: (width: number, height: number) => void
  onPointerBoardPosition: (position: BoardPoint | null) => void
  onObjectiveSelect: (objectiveId: string | null) => void
  onObjectiveMove: (objectiveId: string, position: BoardPoint) => void
}

const getCanvasPoint = (event: PointerEvent | WheelEvent, canvas: HTMLCanvasElement): BoardPoint => {
  const bounds = canvas.getBoundingClientRect()
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
}

function BoardCanvas({
  board,
  gridVisible,
  centerGuidesVisible,
  deploymentZones,
  deploymentZonesVisible,
  objectives,
  selectedObjectiveId,
  interactionRangesVisible,
  viewport,
  minScale,
  maxScale,
  onViewportChange,
  onCanvasResize,
  onPointerBoardPosition,
  onObjectiveSelect,
  onObjectiveMove,
}: BoardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewportRef = useRef(viewport)
  const onViewportChangeRef = useRef(onViewportChange)
  const spaceHeldRef = useRef(false)
  const panRef = useRef<{ pointerId: number; point: BoardPoint } | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const pendingViewportRef = useRef<Viewport | null>(null)
  const pointerPositionKeyRef = useRef<string | null>(null)
  const objectiveDragRef = useRef<{ pointerId: number; objectiveId: string } | null>(null)
  const onObjectiveMoveRef = useRef(onObjectiveMove)
  const pendingObjectiveMoveRef = useRef<{ objectiveId: string; position: BoardPoint } | null>(null)

  useEffect(() => {
    viewportRef.current = viewport
  }, [viewport])

  useEffect(() => {
    onViewportChangeRef.current = onViewportChange
  }, [onViewportChange])

  useEffect(() => {
    onObjectiveMoveRef.current = onObjectiveMove
  }, [onObjectiveMove])

  const queueViewportChange = useCallback((nextViewport: Viewport) => {
    viewportRef.current = nextViewport
    pendingViewportRef.current = nextViewport
    if (animationFrameRef.current !== null) return

    animationFrameRef.current = requestAnimationFrame(() => {
      animationFrameRef.current = null
      if (pendingViewportRef.current) onViewportChangeRef.current(pendingViewportRef.current)
      pendingViewportRef.current = null
    })
  }, [])

  const queueObjectiveMove = useCallback((objectiveId: string, position: BoardPoint) => {
    pendingObjectiveMoveRef.current = { objectiveId, position }
    if (animationFrameRef.current !== null) return

    animationFrameRef.current = requestAnimationFrame(() => {
      animationFrameRef.current = null
      const move = pendingObjectiveMoveRef.current
      if (move) onObjectiveMoveRef.current(move.objectiveId, move.position)
      pendingObjectiveMoveRef.current = null
    })
  }, [])

  useEffect(() => () => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeObserver = new ResizeObserver(() => {
      const { width, height } = canvas.getBoundingClientRect()
      if (width > 0 && height > 0) onCanvasResize(width, height)
    })
    resizeObserver.observe(canvas)
    return () => resizeObserver.disconnect()
  }, [onCanvasResize])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)) {
        spaceHeldRef.current = true
      }
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') spaceHeldRef.current = false
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1
      queueViewportChange(zoomViewportAtPoint(
        viewportRef.current,
        getCanvasPoint(event, canvas),
        factor,
        minScale,
        maxScale,
      ))
    }
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [maxScale, minScale, queueViewportChange])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const bounds = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(bounds.width * dpr)
    canvas.height = Math.round(bounds.height * dpr)

    const context = canvas.getContext('2d')
    if (!context) return
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, bounds.width, bounds.height)

    const topLeft = boardToScreen({ x: 0, y: 0 }, viewport)
    const boardWidth = board.width * viewport.scale
    const boardHeight = board.height * viewport.scale

    context.fillStyle = '#d9d8ce'
    context.fillRect(topLeft.x, topLeft.y, boardWidth, boardHeight)

    context.save()
    context.beginPath()
    context.rect(topLeft.x, topLeft.y, boardWidth, boardHeight)
    context.clip()

    if (deploymentZonesVisible) drawDeploymentZoneFills(context, deploymentZones, viewport)

    if (gridVisible) {
      for (let x = 0; x <= board.width; x += 1) {
        const screenX = topLeft.x + x * viewport.scale
        context.beginPath()
        context.moveTo(screenX, topLeft.y)
        context.lineTo(screenX, topLeft.y + boardHeight)
        context.strokeStyle = 'rgba(30, 36, 38, .18)'
        context.lineWidth = 1
        context.stroke()
      }
      for (let y = 0; y <= board.height; y += 1) {
        const screenY = topLeft.y + y * viewport.scale
        context.beginPath()
        context.moveTo(topLeft.x, screenY)
        context.lineTo(topLeft.x + boardWidth, screenY)
        context.strokeStyle = 'rgba(30, 36, 38, .18)'
        context.lineWidth = 1
        context.stroke()
      }
    }
    context.restore()

    if (centerGuidesVisible) {
      const centerX = topLeft.x + boardWidth / 2
      const centerY = topLeft.y + boardHeight / 2
      context.save()
      context.setLineDash([6, 5])
      context.strokeStyle = '#dd5d32'
      context.globalAlpha = .8
      context.lineWidth = 1
      context.beginPath()
      context.moveTo(centerX, topLeft.y)
      context.lineTo(centerX, topLeft.y + boardHeight)
      context.moveTo(topLeft.x, centerY)
      context.lineTo(topLeft.x + boardWidth, centerY)
      context.stroke()
      context.restore()
    }

    if (deploymentZonesVisible) drawDeploymentZoneBoundaries(context, deploymentZones, viewport)
    drawObjectives(context, objectives, viewport, selectedObjectiveId, interactionRangesVisible)

    context.strokeStyle = '#1e2426'
    context.lineWidth = 1.5
    context.strokeRect(topLeft.x, topLeft.y, boardWidth, boardHeight)

    const contextualMeasurements = (axis: 'x' | 'y', boardSize: number) => {
      const zoneMeasurements = deploymentZones
        .flatMap((zone) => zone.polygon.map((point) => point[axis]))
        .filter((value) => value > 0 && value < boardSize)
      return [...new Set([0, boardSize / 2, boardSize, ...zoneMeasurements])].sort((first, second) => first - second)
    }
    context.fillStyle = '#697173'
    context.font = "10px 'DM Mono', monospace"
    context.textBaseline = 'middle'
    context.textAlign = 'center'
    contextualMeasurements('x', board.width).forEach((value) => {
      context.fillText(`${value}"`, topLeft.x + value * viewport.scale, topLeft.y - 12)
    })
    context.textAlign = 'right'
    contextualMeasurements('y', board.height).forEach((value) => {
      context.fillText(`${value}"`, topLeft.x - 10, topLeft.y + value * viewport.scale)
    })
  }, [
    board,
    centerGuidesVisible,
    deploymentZones,
    deploymentZonesVisible,
    gridVisible,
    interactionRangesVisible,
    objectives,
    selectedObjectiveId,
    viewport,
  ])

  const publishPointerPosition = (screenPoint: BoardPoint) => {
    const position = screenToBoard(screenPoint, viewportRef.current)
    const roundedPosition = isPointOnBoard(position, board)
      ? { x: Math.round(position.x * 10) / 10, y: Math.round(position.y * 10) / 10 }
      : null
    const key = roundedPosition ? `${roundedPosition.x},${roundedPosition.y}` : 'outside'
    if (key === pointerPositionKeyRef.current) return
    pointerPositionKeyRef.current = key
    onPointerBoardPosition(roundedPosition)
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const isPan = event.button === 1 || (event.button === 0 && spaceHeldRef.current)
    const point = getCanvasPoint(event.nativeEvent, event.currentTarget)
    if (isPan) {
      event.preventDefault()
      panRef.current = { pointerId: event.pointerId, point }
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }

    if (event.button !== 0) return
    const objective = getObjectiveAtPoint(screenToBoard(point, viewportRef.current), objectives)
    onObjectiveSelect(objective?.id ?? null)
    if (!objective) return
    objectiveDragRef.current = { pointerId: event.pointerId, objectiveId: objective.id }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(event.nativeEvent, event.currentTarget)
    publishPointerPosition(point)
    const objectiveDrag = objectiveDragRef.current
    if (objectiveDrag?.pointerId === event.pointerId) {
      queueObjectiveMove(objectiveDrag.objectiveId, screenToBoard(point, viewportRef.current))
      return
    }
    const pan = panRef.current
    if (!pan || pan.pointerId !== event.pointerId) return
    queueViewportChange(panViewport(viewportRef.current, { x: point.x - pan.point.x, y: point.y - pan.point.y }))
    pan.point = point
  }

  const stopInteraction = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const isPanning = panRef.current?.pointerId === event.pointerId
    const isDraggingObjective = objectiveDragRef.current?.pointerId === event.pointerId
    if (!isPanning && !isDraggingObjective) return
    panRef.current = null
    objectiveDragRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const clearPointerPosition = () => {
    pointerPositionKeyRef.current = 'outside'
    onPointerBoardPosition(null)
  }

  return (
    <canvas
      ref={canvasRef}
      className="map-board-canvas"
      aria-label="Kill Team battlefield canvas. Use mouse wheel to zoom, then middle mouse button or Space and left mouse button to pan."
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerLeave={clearPointerPosition}
      onPointerUp={stopInteraction}
      onPointerCancel={stopInteraction}
    />
  )
}

export default memo(BoardCanvas)
