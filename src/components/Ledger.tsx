import { useEffect, useMemo, useState } from 'react'
import { formatDate } from '../utils/date'
import { fetchMatches, fetchMatchFormOptions, updateMatch, type MatchFormOptions, type MatchRecord } from '../services/matches'
import { deleteMatchImage, uploadMatchImages, type MatchImage } from '../services/matchImages'
import MatchEditModal from './MatchEditModal'
import { useAuth } from '../lib/auth'

function Ledger({ isActive }: { isActive: boolean }) {
  const { isAdmin, player } = useAuth()
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [playerFilter, setPlayerFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [mapFilter, setMapFilter] = useState('')
  const [MATCHES, setMatches] = useState<MatchRecord[]>([])
  const [formOptions, setFormOptions] = useState<MatchFormOptions>({ maps: [], teams: [], players: [], critOps: [], tacOps: [] })
  const [editingMatch, setEditingMatch] = useState<MatchRecord | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isUpdatingImages, setIsUpdatingImages] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<MatchImage | null>(null)
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null)
  const selectedImages = useMemo(() => {
    if (!selectedImage) return []
    return MATCHES.find((match) => match.images.some((image) => image.id === selectedImage.id))?.images ?? [selectedImage]
  }, [MATCHES, selectedImage])
  const selectedImageIndex = selectedImages.findIndex((image) => image.id === selectedImage?.id)

  useEffect(() => {
    fetchMatches().then(setMatches).catch(() => setMatches([]))
    fetchMatchFormOptions().then(setFormOptions).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedImage) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedImage(null)
        return
      }
      if (selectedImages.length < 2 || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return

      event.preventDefault()
      const offset = event.key === 'ArrowLeft' ? -1 : 1
      const nextIndex = (selectedImageIndex + offset + selectedImages.length) % selectedImages.length
      setSelectedImage(selectedImages[nextIndex])
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedImage, selectedImageIndex, selectedImages])

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

  const canEditMatch = (match: MatchRecord) => isAdmin || Boolean(player && (match.player1 === player.name || match.player2 === player.name))

  const handleEdit = (match: MatchRecord) => {
    if (!match.id || !canEditMatch(match)) return

    setEditingMatch(match)
    setSaveError(null)
    setImageError(null)
    fetchMatchFormOptions()
      .then(setFormOptions)
      .catch((err) => setSaveError(err instanceof Error ? err.message : 'Failed to load match options.'))
  }

  const handleUploadImages = async (files: File[]) => {
    if (!editingMatch?.id || !player?.user_id) return

    setIsUpdatingImages(true)
    setImageError(null)
    try {
      const images = await uploadMatchImages(editingMatch.id, files, player.user_id)
      setMatches((current) => current.map((match) => (
        match.id === editingMatch.id ? { ...match, images: [...match.images, ...images] } : match
      )))
      setEditingMatch((current) => current ? { ...current, images: [...current.images, ...images] } : null)
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Failed to upload images.')
    } finally {
      setIsUpdatingImages(false)
    }
  }

  const handleDeleteImage = async (image: MatchImage) => {
    setIsUpdatingImages(true)
    setImageError(null)
    try {
      await deleteMatchImage(image)
      setMatches((current) => current.map((match) => (
        match.id === image.matchId ? { ...match, images: match.images.filter((matchImage) => matchImage.id !== image.id) } : match
      )))
      setEditingMatch((current) => current ? { ...current, images: current.images.filter((matchImage) => matchImage.id !== image.id) } : null)
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Failed to delete image.')
    } finally {
      setIsUpdatingImages(false)
    }
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
        {matchGroups.length > 0 ? matchGroups.map((group) => <div className="date-block" key={group.date}><header className="date-header"><time dateTime={group.date}>{formatDate(group.date)}</time><span>{group.matches.length} {group.matches.length === 1 ? 'game' : 'games'}</span></header><div className="date-matches">{group.matches.map((match, index) => {
          const editable = canEditMatch(match)
          const isExpanded = expandedMatchId === match.id
          const detailsId = `match-details-${match.id}`
          return <article className="match-row" key={`${match.date}-${match.player1}-${match.player2}-${index}`}>
            <button type="button" className="match-row-summary" aria-expanded={isExpanded} aria-controls={detailsId} onClick={() => setExpandedMatchId((current) => current === match.id ? null : match.id ?? null)}>
              <div className="players"><strong>{match.player1}</strong><span>vs</span><strong>{match.player2}</strong></div>
              <div className="teams"><span>{match.teamOne}</span><span>{match.teamTwo}</span></div>
              <div className="match-meta"><span className="map">{match.map}</span>{match.isHomebrew && <span className="homebrew">Homebrew</span>}</div>
              <span className="match-expand-indicator" aria-hidden="true">{isExpanded ? '−' : '+'}</span>
            </button>
            {isExpanded && <div className="match-row-expanded" id={detailsId}>
              <dl className="match-details" aria-label="Match details"><div><dt>Crit op</dt><dd>{match.critOp ?? 'None'}</dd></div><div><dt>Score</dt><dd>{match.player1Score ?? '—'} – {match.player2Score ?? '—'}</dd></div><div><dt>{match.player1} tac op</dt><dd>{match.player1Tac ?? 'None'}</dd></div><div><dt>{match.player2} tac op</dt><dd>{match.player2Tac ?? 'None'}</dd></div></dl>
              {match.images.length > 0 && <div className="match-images" aria-label="Match images">{match.images.map((image, imageIndex) => <button type="button" className="match-image-thumbnail" key={image.id} onClick={() => setSelectedImage(image)}><img src={image.url} alt={image.caption ?? `Match photo ${imageIndex + 1}`} /></button>)}</div>}
              {editable && <button type="button" className="match-edit-button" onClick={() => handleEdit(match)}>Edit match</button>}
            </div>}
          </article>
        })}</div></div>) : <div className="empty-state"><strong>No matches found</strong><span>Try changing or clearing your filters.</span></div>}
      </section>
      {editingMatch && (
        <MatchEditModal
          match={editingMatch}
          options={formOptions}
          isSaving={isSaving}
          error={saveError}
          isUpdatingImages={isUpdatingImages}
          imageError={imageError}
          onCancel={() => { setEditingMatch(null); setSaveError(null); setImageError(null) }}
          onSave={handleSave}
          onUploadImages={handleUploadImages}
          onDeleteImage={handleDeleteImage}
        />
      )}
      {selectedImage && <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="Full-size match image" onClick={() => setSelectedImage(null)}>
        <div className="image-lightbox-content" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="image-lightbox-close" aria-label="Close full-size image" onClick={() => setSelectedImage(null)}>&times;</button>
          <img src={selectedImage.url} alt={selectedImage.caption ?? 'Full-size match photo'} />
          {selectedImages.length > 1 && <div className="image-lightbox-controls">
            <button type="button" onClick={() => setSelectedImage(selectedImages[(selectedImageIndex - 1 + selectedImages.length) % selectedImages.length])}>Previous</button>
            <span>{selectedImageIndex + 1} / {selectedImages.length}</span>
            <button type="button" onClick={() => setSelectedImage(selectedImages[(selectedImageIndex + 1) % selectedImages.length])}>Next</button>
          </div>}
        </div>
      </div>}
    </div>
  )
}

export default Ledger
