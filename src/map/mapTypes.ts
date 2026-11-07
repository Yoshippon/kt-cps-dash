export type BoardOrientation = 'landscape' | 'portrait'

export type BoardDimensions = {
  width: number
  height: number
}

export type BoardPoint = {
  x: number
  y: number
}

export type Viewport = {
  scale: number
  offsetX: number
  offsetY: number
}

export interface MapObject {
  id: string
  type: string
}

export interface DeploymentZone {
  id: string
  player: 1 | 2
  color: string
  visible: boolean
  polygon: BoardPoint[]
}

export interface ObjectiveMarker {
  id: string
  number: number
  x: number
  y: number
  diameterMm: 40
  interactionRangeIn: number
}

export interface TerrainFootprint {
  type: 'rectangle' | 'polygon'
  points?: BoardPoint[]
}

export interface TerrainDefinition {
  id: string
  name: string
  environmentId: string
  widthIn: number
  heightIn: number
  footprint: TerrainFootprint
  category: string
  color: string
  imageUrl?: string
}

export interface TerrainInstance {
  id: string
  definitionId: string
  x: number
  y: number
  rotation: number
  locked: boolean
}

export interface MapDocument {
  id: string
  name: string
  version: number
  board: BoardDimensions & {
    orientation: BoardOrientation
  }
  objects: MapObject[]
  deploymentZones: DeploymentZone[]
  objectives: ObjectiveMarker[]
  terrain: TerrainInstance[]
}
