import type { TerrainDefinition } from './mapTypes'

export interface TerrainEnvironment {
  id: string
  name: string
  definitions: TerrainDefinition[]
}

export const TERRAIN_ENVIRONMENTS: TerrainEnvironment[] = [
  {
    id: 'generic',
    name: 'Generic Terrain',
    definitions: [
      { id: 'small-barricade', name: 'Small Barricade', environmentId: 'generic', widthIn: 4, heightIn: 1, footprint: { type: 'rectangle' }, category: 'Barricade', color: '#596b70' },
      { id: 'long-barricade', name: 'Long Barricade', environmentId: 'generic', widthIn: 8, heightIn: 1, footprint: { type: 'rectangle' }, category: 'Barricade', color: '#4d7c8b' },
      { id: 'square-platform', name: 'Square Platform', environmentId: 'generic', widthIn: 4, heightIn: 4, footprint: { type: 'rectangle' }, category: 'Platform', color: '#75806b' },
      { id: 'rectangular-platform', name: 'Rectangular Platform', environmentId: 'generic', widthIn: 6, heightIn: 3, footprint: { type: 'rectangle' }, category: 'Platform', color: '#8a795f' },
      { id: 'l-shaped-ruin', name: 'L-shaped Ruin', environmentId: 'generic', widthIn: 5, heightIn: 5, footprint: { type: 'rectangle' }, category: 'Ruin', color: '#855f54' },
      { id: 'scatter-terrain', name: 'Scatter Terrain', environmentId: 'generic', widthIn: 2, heightIn: 2, footprint: { type: 'rectangle' }, category: 'Scatter', color: '#746c80' },
      { id: 'large-structure', name: 'Large Structure', environmentId: 'generic', widthIn: 8, heightIn: 5, footprint: { type: 'rectangle' }, category: 'Structure', color: '#68736c' },
    ],
  },
]

export const TERRAIN_DEFINITIONS = TERRAIN_ENVIRONMENTS.flatMap((environment) => environment.definitions)

export const getTerrainDefinition = (definitionId: string) => TERRAIN_DEFINITIONS.find((definition) => definition.id === definitionId)
