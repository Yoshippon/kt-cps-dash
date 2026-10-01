import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { fetchMatches, type MatchRecord } from '../services/matches'
import { formatDate } from '../utils/date'

const ROTATION_INTERVAL_MS = 7000
const MAX_MOMENTS = 6

type RecentMoment = {
  match: MatchRecord
  image: MatchRecord['images'][number]
}

function RecentMoments() {
  const [matches, setMatches] = useState<MatchRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)

  useEffect(() => {
    fetchMatches()
      .then(setMatches)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load recent moments.'))
  }, [])

  const moments = useMemo<RecentMoment[]>(() => matches
    .flatMap((match) => match.images.map((image) => ({ match, image })))
    .slice(0, MAX_MOMENTS), [matches])

  useEffect(() => {
    if (moments.length < 2 || isPaused || isLightboxOpen) return

    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % moments.length)
    }, ROTATION_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [isLightboxOpen, isPaused, moments.length])

  useEffect(() => {
    if (!isLightboxOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsLightboxOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isLightboxOpen])

  if (error) {
    return <p className="recent-moments-error">Unable to load recent moments: {error}</p>
  }
  if (moments.length === 0) return null

  const moment = moments[activeIndex]
  const imageAlt = moment.image.caption ?? `${moment.match.teamOne} vs ${moment.match.teamTwo}`

  return (
    <>
      <section
        className="recent-moments"
        aria-labelledby="recent-moments-heading"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocus={() => setIsPaused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setIsPaused(false)
        }}
      >
        <div className="recent-moments-copy">
          <p className="section-kicker">Recent moments</p>
          <h3 id="recent-moments-heading">{moment.match.teamOne} vs {moment.match.teamTwo}</h3>
          <p>{formatDate(moment.match.date)} · {moment.match.player1} vs {moment.match.player2}</p>
          <Link to={`/matches?match=${moment.match.id}`}>View match</Link>
        </div>
        <button
          type="button"
          className="recent-moments-image"
          aria-label={`View photo from ${imageAlt}`}
          onClick={() => setIsLightboxOpen(true)}
        >
          <img src={moment.image.url} alt={imageAlt} />
        </button>
        {moments.length > 1 && (
          <div className="recent-moments-controls" aria-label="Recent moments">
            {moments.map((item, index) => (
              <button
                type="button"
                key={item.image.id}
                aria-label={`Show photo ${index + 1}: ${item.match.teamOne} vs ${item.match.teamTwo}`}
                aria-current={index === activeIndex}
                onClick={() => setActiveIndex(index)}
              />
            ))}
          </div>
        )}
      </section>
      {isLightboxOpen && (
        <div className="image-lightbox" role="dialog" aria-modal="true" aria-label={imageAlt} onClick={() => setIsLightboxOpen(false)}>
          <div className="image-lightbox-content" onClick={(event) => event.stopPropagation()}>
            <img src={moment.image.url} alt={imageAlt} />
            <button type="button" className="image-lightbox-close" aria-label="Close photo" onClick={() => setIsLightboxOpen(false)}>×</button>
          </div>
        </div>
      )}
    </>
  )
}

export default RecentMoments
