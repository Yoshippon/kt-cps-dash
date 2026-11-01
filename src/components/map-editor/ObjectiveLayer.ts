import { getObjectiveRadiusIn } from '../../map/boardGeometry'
import type { BoardPoint, ObjectiveMarker, Viewport } from '../../map/mapTypes'

export const drawObjectives = (
  context: CanvasRenderingContext2D,
  objectives: ObjectiveMarker[],
  viewport: Viewport,
  selectedObjectiveId: string | null,
  interactionRangesVisible: boolean,
) => {
  objectives.forEach((objective) => {
    const x = viewport.offsetX + objective.x * viewport.scale
    const y = viewport.offsetY + objective.y * viewport.scale
    const markerRadius = getObjectiveRadiusIn(objective.diameterMm)
    const interactionRadius = markerRadius + objective.interactionRangeIn

    if (interactionRangesVisible) {
      context.beginPath()
      context.arc(x, y, interactionRadius * viewport.scale, 0, Math.PI * 2)
      context.fillStyle = 'rgba(221, 93, 50, .13)'
      context.fill()
      context.save()
      context.setLineDash([5, 4])
      context.strokeStyle = 'rgba(221, 93, 50, .8)'
      context.lineWidth = 1.5
      context.stroke()
      context.restore()
    }

    if (objective.id === selectedObjectiveId) {
      context.beginPath()
      context.arc(x, y, (markerRadius * viewport.scale) + 5, 0, Math.PI * 2)
      context.strokeStyle = '#1e2426'
      context.lineWidth = 2
      context.stroke()
    }

    context.beginPath()
    context.arc(x, y, markerRadius * viewport.scale, 0, Math.PI * 2)
    context.fillStyle = '#1e2426'
    context.fill()
    context.strokeStyle = '#dd5d32'
    context.lineWidth = 2
    context.stroke()
    context.fillStyle = '#f5f3ee'
    context.font = `700 ${Math.max(10, Math.min(16, viewport.scale * .5))}px 'DM Mono', monospace`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(String(objective.number), x, y + .5)
  })
}

export const getObjectiveAtPoint = (
  point: BoardPoint,
  objectives: ObjectiveMarker[],
): ObjectiveMarker | null => {
  for (let index = objectives.length - 1; index >= 0; index -= 1) {
    const objective = objectives[index]
    if (Math.hypot(point.x - objective.x, point.y - objective.y) <= getObjectiveRadiusIn(objective.diameterMm)) return objective
  }
  return null
}
