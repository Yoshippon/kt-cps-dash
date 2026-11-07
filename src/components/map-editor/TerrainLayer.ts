import { getTerrainDefinition } from '../../map/terrainDefinitions'
import { normalizeRotation } from '../../map/boardGeometry'
import type { BoardPoint, TerrainInstance, Viewport } from '../../map/mapTypes'

export const drawTerrain = (
  context: CanvasRenderingContext2D,
  terrain: TerrainInstance[],
  viewport: Viewport,
  selectedTerrainId: string | null,
) => {
  terrain.forEach((instance) => {
    const definition = getTerrainDefinition(instance.definitionId)
    if (!definition) return
    const x = viewport.offsetX + instance.x * viewport.scale
    const y = viewport.offsetY + instance.y * viewport.scale
    const width = definition.widthIn * viewport.scale
    const height = definition.heightIn * viewport.scale
    context.save()
    context.translate(x, y)
    context.rotate(normalizeRotation(instance.rotation) * Math.PI / 180)
    context.fillStyle = definition.color
    context.fillRect(-width / 2, -height / 2, width, height)
    context.strokeStyle = '#1e2426'
    context.lineWidth = 1.5
    context.strokeRect(-width / 2, -height / 2, width, height)
    context.fillStyle = 'rgba(255, 255, 255, .18)'
    context.fillRect(-width / 2 + 3, -height / 2 + 3, width - 6, Math.min(7, height - 6))
    if (instance.id === selectedTerrainId) {
      context.setLineDash([5, 3])
      context.strokeStyle = instance.locked ? '#1e2426' : '#dd5d32'
      context.lineWidth = 3
      context.strokeRect(-width / 2 - 4, -height / 2 - 4, width + 8, height + 8)
      context.setLineDash([])
      if (instance.locked) {
        context.fillStyle = '#1e2426'
        context.font = "700 9px 'DM Mono', monospace"
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillText('LOCK', 0, 0)
      }
    }
    context.restore()
  })
}

export const getTerrainAtPoint = (point: BoardPoint, terrain: TerrainInstance[]): TerrainInstance | null => {
  for (let index = terrain.length - 1; index >= 0; index -= 1) {
    const instance = terrain[index]
    const definition = getTerrainDefinition(instance.definitionId)
    if (!definition) continue
    const radians = -normalizeRotation(instance.rotation) * Math.PI / 180
    const deltaX = point.x - instance.x
    const deltaY = point.y - instance.y
    const localX = deltaX * Math.cos(radians) - deltaY * Math.sin(radians)
    const localY = deltaX * Math.sin(radians) + deltaY * Math.cos(radians)
    if (Math.abs(localX) <= definition.widthIn / 2 && Math.abs(localY) <= definition.heightIn / 2) return instance
  }
  return null
}
