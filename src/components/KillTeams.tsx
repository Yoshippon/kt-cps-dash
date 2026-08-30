import { useMemo, useState } from 'react'
import { TEAMS } from '../data'

type SortKey = 'killTeam' | 'fortyKFaction' | 'category' | 'boxName' | 'season' | 'operatives' | 'wounds' | 'apl' | 'killOp' | 'releaseDate'
type SortDirection = 'asc' | 'desc'

type KillTeamRow = {
  killTeam: string
  fortyKFaction: string
  category: string
  boxName: string
  season: number
  operatives: number
  wounds: number
  apl: number
  killOp: number
  releaseDate: string
}

const parseReleaseDate = (value: string) => {
  if (!value) return Number.NEGATIVE_INFINITY

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`).getTime()
  }

  const [monthName, yearString] = value.split('/')
  const monthMap: Record<string, number> = {
    January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
    July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
  }

  const month = monthMap[monthName ?? ''] ?? 0
  const year = Number(yearString ?? '0')
  return new Date(year, month, 1).getTime()
}

const formatReleaseDate = (value: string) => {
  if (!value) return 'Unknown'

  const timestamp = parseReleaseDate(value)
  if (!Number.isFinite(timestamp)) return value

  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(new Date(timestamp))
}

const columnLabels: Record<SortKey, string> = {
  killTeam: 'Team',
  fortyKFaction: 'Faction',
  category: 'Type',
  boxName: 'Box',
  season: 'Season',
  operatives: 'Operatives',
  wounds: 'Wounds',
  apl: 'APL',
  killOp: 'Kill Op',
  releaseDate: 'Release',
}

function KillTeams({ isActive }: { isActive: boolean }) {
  const [sortKey, setSortKey] = useState<SortKey>('season')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [releaseFrom, setReleaseFrom] = useState<string>('')
  const [releaseTo, setReleaseTo] = useState<string>('')

  const rows = useMemo(() => {
    const flatRows = (Array.isArray(TEAMS) ? TEAMS.flatMap((group) => Array.isArray(group) ? group : [group]) : []) as KillTeamRow[]

    const filteredRows = flatRows.filter((team) => {
      const releaseTime = parseReleaseDate(team.releaseDate)
      const fromTime = releaseFrom ? parseReleaseDate(releaseFrom) : null
      const toTime = releaseTo ? parseReleaseDate(releaseTo) : null

      if (fromTime !== null && releaseTime < fromTime) return false
      if (toTime !== null && releaseTime > toTime) return false
      return true
    })

    return [...filteredRows].sort((first, second) => {
      const firstValue = first[sortKey]
      const secondValue = second[sortKey]

      if (sortKey === 'releaseDate') {
        const dateResult = parseReleaseDate(firstValue as string) - parseReleaseDate(secondValue as string)
        return sortDirection === 'asc' ? dateResult : -dateResult
      }

      if (typeof firstValue === 'string' && typeof secondValue === 'string') {
        const result = firstValue.localeCompare(secondValue)
        return sortDirection === 'asc' ? result : -result
      }

      const numericResult = Number(firstValue) - Number(secondValue)
      return sortDirection === 'asc' ? numericResult : -numericResult
    })
  }, [releaseFrom, releaseTo, sortDirection, sortKey])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortKey(key)
    setSortDirection('asc')
  }

  const clearDateFilters = () => {
    setReleaseFrom('')
    setReleaseTo('')
  }

  return (
    <div hidden={!isActive}>
      <section className="intro" aria-labelledby="kill-teams-heading">
        <div>
          <h2 id="kill-teams-heading">Kill Teams</h2>
          <p className="intro-copy">Complete roster of kill teams in the current catalog, with faction, box, and stat ranges.</p>
        </div>
        <div className="stats" aria-label="Kill team statistics">
          <div><strong>{rows.length}</strong><span>teams</span></div>
          <div><strong>{new Set(rows.map((team) => team.fortyKFaction)).size}</strong><span>factions</span></div>
        </div>
      </section>

      <section className="kill-team-controls" aria-label="Kill team filters">
        <label>
          Release after
          <input type="date" value={releaseFrom} onChange={(event) => setReleaseFrom(event.target.value)} />
        </label>
        <label>
          Release before
          <input type="date" value={releaseTo} onChange={(event) => setReleaseTo(event.target.value)} />
        </label>
        {(releaseFrom || releaseTo) && (
          <button type="button" className="kill-team-clear-filter" onClick={clearDateFilters}>Clear filter</button>
        )}
      </section>

      <section className="kill-team-table-wrap" aria-label="Kill team catalog">
        <table className="kill-team-table">
          <thead>
            <tr>
              {(Object.keys(columnLabels) as SortKey[]).map((key) => (
                <th key={key} scope="col">
                  <button type="button" className="kill-team-sort-button" onClick={() => handleSort(key)}>
                    {columnLabels[key]} {sortKey === key ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((team) => (
              <tr key={team.killTeam}>
                <th scope="row">{team.killTeam}</th>
                <td>{team.fortyKFaction}</td>
                <td>{team.category}</td>
                <td>{team.boxName}</td>
                <td>{team.season}</td>
                <td>{team.operatives}</td>
                <td>{team.wounds}</td>
                <td>{team.apl}</td>
                <td>{team.killOp}</td>
                <td>{formatReleaseDate(team.releaseDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

export default KillTeams
