import { useMemo, useState } from 'react'
import { TERRAIN_ENVIRONMENTS } from '../../map/terrainDefinitions'
import type { TerrainDefinition } from '../../map/mapTypes'

type TerrainLibraryProps = {
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  onAddTerrain: (definition: TerrainDefinition) => void
}

function TerrainLibrary({ collapsed, onCollapsedChange, onAddTerrain }: TerrainLibraryProps) {
  const [environmentId, setEnvironmentId] = useState('generic')
  const [search, setSearch] = useState('')
  const definitions = useMemo(() => (
    TERRAIN_ENVIRONMENTS
      .filter((environment) => environment.id === environmentId)
      .flatMap((environment) => environment.definitions)
      .filter((definition) => definition.name.toLowerCase().includes(search.trim().toLowerCase()))
  ), [environmentId, search])

  if (collapsed) {
    return (
      <button type="button" className="terrain-library-expand" onClick={() => onCollapsedChange(false)}>
        Terrain
      </button>
    )
  }

  return (
    <aside className="terrain-library" aria-label="Terrain library">
      <header>
        <strong>Terrain library</strong>
        <button type="button" onClick={() => onCollapsedChange(true)}>Close</button>
      </header>
      <label>
        Environment
        <select value={environmentId} onChange={(event) => setEnvironmentId(event.target.value)}>
          {TERRAIN_ENVIRONMENTS.map((environment) => <option key={environment.id} value={environment.id}>{environment.name}</option>)}
        </select>
      </label>
      <label>
        Search pieces
        <input value={search} onChange={(event) => setSearch(event.target.value)} />
      </label>
      <div className="terrain-library-items">
        {definitions.map((definition) => (
          <button key={definition.id} type="button" className="terrain-library-item" onClick={() => onAddTerrain(definition)}>
            <span style={{ backgroundColor: definition.color }} aria-hidden="true" />
            <strong>{definition.name}</strong>
            <small>{definition.widthIn}" × {definition.heightIn}" · {definition.category}</small>
          </button>
        ))}
      </div>
    </aside>
  )
}

export default TerrainLibrary
