import { useEffect, useState } from 'react'
import { formatDate } from '../utils/date'
import { fetchMatches, fetchMatchFormOptions, updateMatch, type MatchFormOptions, type MatchRecord } from '../services/matches'
import MatchEditModal from './MatchEditModal'

function Ledger({ isActive }: { isActive: boolean }) {
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [playerFilter, setPlayerFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [mapFilter, setMapFilter] = useState('')
  const [MATCHES, setMatches] = useState<MatchRecord[]>([])
  const [formOptions, setFormOptions] = useState<MatchFormOptions>({ maps: [], teams: [], players: [], critOps: [] })
  const [editingMatch, setEditingMatch] = useState<MatchRecord | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    fetchMatches().then(setMatches).catch(() => setMatches([]))
    fetchMatchFormOptions().then(setFormOptions).catch(() => {})
  }, [])

  const handleSave = async (draft: MatchRecord) => {
    setIsSaving(true)
    setSaveError(null)
    try {
      await updateMatch(draft)
      setMatches((current) => current.map((match) => (match.id === draft.id ? draft : match)))
      setEditingMatch(null)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save match.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = (match: MatchRecord) => {
    if (!match.id) return

    setEditingMatch(match)
    setSaveError(null)
    fetchMatchFormOptions()
      .then(setFormOptions)
      .catch((err) => setSaveError(err instanceof Error ? err.message : 'Failed to load match options.'))
  }

  const filteredMatches = MATCHES.filter((match) => {
    const includesPlayer = !playerFilter || match.player1 === playerFilter || match.player2 === playerFilter
    const includesTeam = !teamFilter || match.teamOne === teamFilter || match.teamTwo === teamFilter
    const includesMap = !mapFilter || match.map === mapFilter
    return includesPlayer && includesTeam && includesMap
  })
  const sortedMatches = [...filteredMatches].sort((firstMatch, secondMatch) => secondMatch.date.localeCompare(firstMatch.date))
  const matchGroups = sortedMatches.reduce<Array<{ date: string; matches: typeof MATCHES }>>((groups, match) => {
    const currentGroup = groups.at(-1)
    if (currentGroup?.date === match.date) currentGroup.matches.push(match)
    else groups.push({ date: match.date, matches: [match] })
    return groups
  }, [])
  const playerCount = new Set(filteredMatches.flatMap((match) => [match.player1, match.player2])).size
  const hasFilters = Boolean(playerFilter || teamFilter || mapFilter)
  const allPlayers = [...new Set(MATCHES.flatMap((match) => [match.player1, match.player2]))].sort()
  const teams = [...new Set(MATCHES.flatMap((match) => [match.teamOne, match.teamTwo]))].sort()
  const maps = [...new Set(MATCHES.map((match) => match.map))].sort()
  const clearFilters = () => {
    setPlayerFilter('')
    setTeamFilter('')
    setMapFilter('')
  }

  return (
    <div hidden={!isActive}>
      <section className="intro" aria-labelledby="matches-heading">
        <div><h2 id="matches-heading">Matches</h2></div>
        <div className="stats" aria-label="Match statistics"><div><strong>{MATCHES.length}</strong><span>games logged</span></div><div><strong>{MATCHES.filter((match) => match.isTied).length}</strong><span>draws</span></div><div><strong>{playerCount}</strong><span>players</span></div></div>
      </section>
      <div className="toolbar"><span>{sortedMatches.length} {sortedMatches.length === 1 ? 'match' : 'matches'}{hasFilters ? ' found' : ''}</span><button type="button" className="filter-button" aria-expanded={isFilterOpen} aria-controls="match-filters" onClick={() => setIsFilterOpen((isOpen) => !isOpen)}>{hasFilters ? 'Filters applied' : 'All records'} <span aria-hidden="true">{isFilterOpen ? '⌃' : '⌄'}</span></button></div>
      {isFilterOpen && <div className="filter-panel" id="match-filters">
        <label>Player<select value={playerFilter} onChange={(event) => setPlayerFilter(event.target.value)}><option value="">All players</option>{allPlayers.map((player) => <option key={player} value={player}>{player}</option>)}</select></label>
        <label>Team<select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}><option value="">All teams</option>{teams.map((team) => <option key={team} value={team}>{team}</option>)}</select></label>
        <label>Map<select value={mapFilter} onChange={(event) => setMapFilter(event.target.value)}><option value="">All maps</option>{maps.map((map) => <option key={map} value={map}>{map}</option>)}</select></label>
        {hasFilters && <button type="button" className="clear-filters" onClick={clearFilters}>Clear filters</button>}
      </div>}
      <section className="match-list" aria-label="All matches">
        {matchGroups.length > 0 ? matchGroups.map((group) => <div className="date-block" key={group.date}><header className="date-header"><time dateTime={group.date}>{formatDate(group.date)}</time><span>{group.matches.length} {group.matches.length === 1 ? 'game' : 'games'}</span></header><div className="date-matches">{group.matches.map((match, index) => <article className="match-row" role="button" tabIndex={0} key={`${match.date}-${match.player1}-${match.player2}-${index}`} onClick={() => handleEdit(match)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') handleEdit(match) }}><div className="players"><strong>{match.player1}</strong><span>vs</span><strong>{match.player2}</strong></div><div className="teams"><span>{match.teamOne}</span><span>{match.teamTwo}</span></div><div className="match-meta"><span className="map">{match.map}</span>{match.isHomebrew && <span className="homebrew">Homebrew</span>}</div></article>)}</div></div>) : <div className="empty-state"><strong>No matches found</strong><span>Try changing or clearing your filters.</span></div>}
      </section>
      {editingMatch && (
        <MatchEditModal
          match={editingMatch}
          options={formOptions}
          isSaving={isSaving}
          error={saveError}
          onCancel={() => { setEditingMatch(null); setSaveError(null) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

export default Ledger
