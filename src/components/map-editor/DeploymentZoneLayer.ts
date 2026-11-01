import { boardToScreen } from '../../map/boardGeometry'
import type { DeploymentZone, Viewport } from '../../map/mapTypes'

export const drawDeploymentZoneFills = (
  context: CanvasRenderingContext2D,
  zones: DeploymentZone[],
  viewport: Viewport,
) => {
  zones.filter((zone) => zone.visible).forEach((zone) => {
    const [firstPoint, ...remainingPoints] = zone.polygon
    if (!firstPoint) return
    const firstScreenPoint = boardToScreen(firstPoint, viewport)
    context.beginPath()
    context.moveTo(firstScreenPoint.x, firstScreenPoint.y)
    remainingPoints.forEach((point) => {
      const screenPoint = boardToScreen(point, viewport)
      context.lineTo(screenPoint.x, screenPoint.y)
    })
    context.closePath()
    context.fillStyle = zone.color
    context.fill()
  })
}

export const drawDeploymentZoneBoundaries = (
  context: CanvasRenderingContext2D,
  zones: DeploymentZone[],
  viewport: Viewport,
) => {
  zones.filter((zone) => zone.visible).forEach((zone) => {
    const [firstPoint, secondPoint] = zone.player === 1
      ? [zone.polygon[2], zone.polygon[3]]
      : [zone.polygon[0], zone.polygon[1]]
    if (!firstPoint || !secondPoint) return
    const firstScreenPoint = boardToScreen(firstPoint, viewport)
    const secondScreenPoint = boardToScreen(secondPoint, viewport)
    context.save()
    context.setLineDash([6, 5])
    context.strokeStyle = zone.player === 1 ? '#4d7c8b' : '#dd5d32'
    context.lineWidth = 2
    context.beginPath()
    context.moveTo(firstScreenPoint.x, firstScreenPoint.y)
    context.lineTo(secondScreenPoint.x, secondScreenPoint.y)
    context.stroke()
    context.restore()
  })
}
