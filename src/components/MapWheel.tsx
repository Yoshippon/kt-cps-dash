import { useEffect, useRef, useState } from 'react'
import type { MapData } from '../data'
import spinEndSound from '../assets/oh-my-god.mp3'

interface MapWheelProps {
  maps: MapData[]
  preselectedMapNames: string[]
  isOpen: boolean
  onClose: () => void
  onSelect: (map: MapData) => void
}

const WHEEL_COLORS = ['#dd5d32', '#4d7c8b', '#5d8b6a', '#c68d6a', '#7a8aa6', '#9a7f5d', '#5b7d99', '#d4b56f']

const getWinningIndex = (angle: number, segmentAngle: number, segmentCount: number) => {
  const index = Math.round(-angle / segmentAngle)
  return ((index % segmentCount) + segmentCount) % segmentCount
}

function MapWheel({ maps, preselectedMapNames, isOpen, onClose, onSelect }: MapWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const confettiRef = useRef<HTMLCanvasElement | null>(null)
  const spinEndSoundRef = useRef<HTMLAudioElement | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [selectedMap, setSelectedMap] = useState<MapData | null>(null)
  const [winnerDialogOpen, setWinnerDialogOpen] = useState(false)
  const [includedMapNames, setIncludedMapNames] = useState<string[]>([])
  const animationFrameRef = useRef<number | undefined>(undefined)
  const wasOpenRef = useRef(false)
  const availableMaps = maps.filter((map) => includedMapNames.includes(map.name))

  const playSpinEndSound = () => {
    const sound = spinEndSoundRef.current ?? new Audio(spinEndSound)
    spinEndSoundRef.current = sound
    sound.volume = 0.9
    sound.pause()

    const startAtOffset = () => {
      if (sound.duration && sound.duration > 2) {
        sound.currentTime = 2
      }
      sound.play().catch(() => {})
    }

    if (sound.readyState >= 2) {
      startAtOffset()
      return
    }

    sound.addEventListener('canplay', startAtOffset, { once: true })
    sound.load()
  }

  const launchConfettiBurst = () => {
    const canvas = confettiRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const particles = Array.from({ length: 90 }, () => {
      const angle = Math.random() * Math.PI * 2
      const velocity = 2.6 + Math.random() * 5.8
      return {
        x: 150,
        y: 150,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 1.2,
        size: 4 + Math.random() * 5,
        color: WHEEL_COLORS[Math.floor(Math.random() * WHEEL_COLORS.length)],
        life: 1,
      }
    })

    const tick = () => {
      ctx.clearRect(0, 0, 300, 300)
      particles.forEach((particle) => {
        particle.x += particle.vx
        particle.y += particle.vy
        particle.vy += 0.08
        particle.life -= 0.012
        ctx.globalAlpha = Math.max(0, particle.life)
        ctx.fillStyle = particle.color
        ctx.fillRect(particle.x, particle.y, particle.size, particle.size)
      })
      ctx.globalAlpha = 1

      if (particles.some((particle) => particle.life > 0)) {
        requestAnimationFrame(tick)
      } else {
        ctx.clearRect(0, 0, 300, 300)
      }
    }

    tick()
  }

  const handleRemoveFromPool = () => {
    if (!selectedMap) return
    setIncludedMapNames((current) => current.filter((name) => name !== selectedMap.name))
    setWinnerDialogOpen(false)
  }

  const drawWheel = (angle: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const centerX = 150
    const centerY = 150
    const radius = 130
    const arc = (2 * Math.PI) / availableMaps.length

    ctx.clearRect(0, 0, 300, 300)
    availableMaps.forEach((map, index) => {
      const startAngle = index * arc - Math.PI / 2 - arc / 2 + angle
      const endAngle = startAngle + arc
      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.arc(centerX, centerY, radius, startAngle, endAngle)
      ctx.closePath()
      ctx.fillStyle = WHEEL_COLORS[index % WHEEL_COLORS.length]
      ctx.fill()
      ctx.strokeStyle = '#f5f3ee'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.save()
      ctx.translate(centerX, centerY)
      ctx.rotate(startAngle + arc / 2)
      ctx.textAlign = 'right'
      ctx.fillStyle = '#f5f3ee'
      ctx.shadowColor = 'rgba(30, 36, 38, 0.18)'
      ctx.shadowBlur = 3
      const maxTextWidth = Math.max(42, radius * Math.sin(arc / 2) * 1.5)
      let fontSize = Math.min(14, Math.max(9, 220 / availableMaps.length))
      ctx.font = `700 ${fontSize}px 'Space Grotesk', sans-serif`
      while (fontSize > 9 && ctx.measureText(map.name).width > maxTextWidth) {
        fontSize -= 1
        ctx.font = `700 ${fontSize}px 'Space Grotesk', sans-serif`
      }
      let label = map.name
      while (ctx.measureText(label).width > maxTextWidth && label.length > 3) label = `${label.slice(0, -2)}…`
      ctx.fillText(label, radius * 0.82, 4)
      ctx.restore()
      ctx.shadowBlur = 0
    })
    ctx.beginPath()
    ctx.moveTo(centerX, 30)
    ctx.lineTo(centerX - 12, 10)
    ctx.lineTo(centerX + 12, 10)
    ctx.closePath()
    ctx.fillStyle = '#dd5d32'
    ctx.fill()
    ctx.strokeStyle = '#1e2426'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  const spin = () => {
    if (spinning || availableMaps.length === 0) return
    setSpinning(true)
    setSelectedMap(null)

    const canvas = canvasRef.current
    if (!canvas) return

    const segments = availableMaps.length
    const arc = (2 * Math.PI) / segments

    const fullRotations = 5 + Math.random() * 3
    const extraRotation = Math.random() * 2 * Math.PI
    const targetAngle = fullRotations * 2 * Math.PI + extraRotation
    const duration = 4500
    const startTime = performance.now()

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easedProgress = 1 - Math.pow(1 - progress, 5)
      const currentAngle = targetAngle * easedProgress

      drawWheel(currentAngle)

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate)
      } else {
        const finalAngle = (targetAngle % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)
        const winningIndex = getWinningIndex(finalAngle, arc, segments)
        const winner = availableMaps[winningIndex]
        setSelectedMap(winner)
        setWinnerDialogOpen(true)
        setSpinning(false)
        playSpinEndSound()
        launchConfettiBurst()
        onSelect(winner)
      }
    }

    animationFrameRef.current = requestAnimationFrame(animate)
  }

  useEffect(() => {
    if (!isOpen) {
      if (animationFrameRef.current !== undefined) cancelAnimationFrame(animationFrameRef.current)
      setSpinning(false)
      setSelectedMap(null)
      setWinnerDialogOpen(false)
      setIncludedMapNames([])
    } else if (!wasOpenRef.current) {
      setIncludedMapNames(preselectedMapNames)
    }
    wasOpenRef.current = isOpen
  }, [isOpen, preselectedMapNames])

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      const size = 300
      canvas.width = size * dpr
      canvas.height = size * dpr
      canvas.style.width = `${size}px`
      canvas.style.height = `${size}px`
      ctx.scale(dpr, dpr)
      if (availableMaps.length > 0) drawWheel(0)
    }
  }, [isOpen, maps, includedMapNames])

  if (!isOpen) return null

  return (
    <div className="wheel-overlay">
      <div className="wheel-modal" onClick={(e) => e.stopPropagation()}>
        <button className="wheel-close" type="button" aria-label="Close map wheel" onClick={onClose} disabled={spinning}>×</button>
        {winnerDialogOpen && selectedMap && (
          <div className="wheel-confirmation-backdrop" aria-live="polite">
            <div className="wheel-confirmation-dialog" role="dialog" aria-modal="false" aria-label="Selected map result">
              <span className="wheel-dialog-kicker">Winner</span>
              <strong>{selectedMap.name}</strong>
              <div className="wheel-dialog-actions">
                <button type="button" className="wheel-dialog-primary" onClick={() => setWinnerDialogOpen(false)}>Use this map</button>
                <button type="button" className="wheel-dialog-secondary" onClick={handleRemoveFromPool}>Remove from pool</button>
              </div>
            </div>
          </div>
        )}
        <div className={`wheel-content ${selectedMap ? 'wheel-finished' : ''} ${winnerDialogOpen ? 'wheel-paused' : ''}`}>
          <div className="wheel-main">
            <h3>Spin for Map</h3>
            <div className="wheel-canvas-wrap">
              <canvas ref={canvasRef} className="wheel-base-canvas" width={300} height={300} />
              <canvas ref={confettiRef} className="wheel-confetti-canvas" width={300} height={300} aria-hidden="true" />
            </div>
            <button
              className={`spin-btn ${spinning ? 'spinning' : ''}`}
              onClick={spin}
              disabled={spinning || availableMaps.length === 0}
            >
              {spinning ? 'Spinning...' : selectedMap ? `Selected: ${selectedMap.name}` : 'Spin Wheel'}
            </button>
            {selectedMap && <div className="wheel-result" role="status"><span>Selected map</span><strong>{selectedMap.name}</strong></div>}
          </div>
          <aside className="wheel-options" aria-label="Map options">
            <strong>Map options</strong>
            <small>Vote leaders are preselected. Add any map.</small>
            {maps.map((map) => {
              const isIncluded = includedMapNames.includes(map.name)
              return <label key={map.name}><input type="checkbox" checked={isIncluded} onChange={() => setIncludedMapNames((current) => isIncluded ? current.filter((name) => name !== map.name) : [...current, map.name])} disabled={spinning} /><span>{map.name}</span></label>
            })}
            {availableMaps.length === 0 && <em>Select at least one map.</em>}
          </aside>
        </div>
        <button className="wheel-done" type="button" onClick={onClose} disabled={spinning}>Close</button>
      </div>
    </div>
  )
}

export default MapWheel