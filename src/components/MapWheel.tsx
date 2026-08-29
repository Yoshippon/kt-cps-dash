import { useEffect, useRef, useState } from 'react'
import type { MapData } from '../data'
import spinEndSound from '../assets/oh-my-god.mp3'

interface MapWheelProps {
  maps: MapData[]
  isOpen: boolean
  onClose: () => void
  onSelect: (map: MapData) => void
}

const WHEEL_COLORS = ['#7898bd', '#c98278', '#d0b86a', '#83a88b', '#a28abd', '#78bdc7', '#8290b2', '#b58b74']

const getWinningIndex = (angle: number, segmentAngle: number, segmentCount: number) => {
  const index = Math.round(-angle / segmentAngle)
  return ((index % segmentCount) + segmentCount) % segmentCount
}

function MapWheel({ maps, isOpen, onClose, onSelect }: MapWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [spinning, setSpinning] = useState(false)
  const [selectedMap, setSelectedMap] = useState<MapData | null>(null)
  const [excludedMaps, setExcludedMaps] = useState<string[]>([])
  const animationFrameRef = useRef<number | undefined>(undefined)
  const availableMaps = maps.filter((map) => !excludedMaps.includes(map.name))

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
      ctx.strokeStyle = '#1e1e1e'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.save()
      ctx.translate(centerX, centerY)
      ctx.rotate(startAngle + arc / 2)
      ctx.textAlign = 'right'
      ctx.fillStyle = '#fff'
      const maxTextWidth = Math.max(42, radius * Math.sin(arc / 2) * 1.5)
      let fontSize = Math.min(14, Math.max(9, 220 / availableMaps.length))
      ctx.font = `bold ${fontSize}px system-ui`
      while (fontSize > 9 && ctx.measureText(map.name).width > maxTextWidth) {
        fontSize -= 1
        ctx.font = `bold ${fontSize}px system-ui`
      }
      let label = map.name
      while (ctx.measureText(label).width > maxTextWidth && label.length > 3) label = `${label.slice(0, -2)}…`
      ctx.fillText(label, radius * 0.82, 4)
      ctx.restore()
    })
    ctx.beginPath()
    ctx.moveTo(centerX, 30)
    ctx.lineTo(centerX - 10, 10)
    ctx.lineTo(centerX + 10, 10)
    ctx.closePath()
    ctx.fillStyle = '#fff'
    ctx.fill()
    ctx.strokeStyle = '#333'
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
        setSpinning(false)
        const sound = new Audio(spinEndSound)
        const playFromOffset = () => {
          sound.currentTime = 2
          sound.play().catch(() => {})
        }
        if (sound.readyState >= 1) playFromOffset()
        else sound.addEventListener('loadedmetadata', playFromOffset, { once: true })
        sound.load()
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
      setExcludedMaps([])
    }
  }, [isOpen, maps])

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
  }, [isOpen, maps, excludedMaps])

  if (!isOpen) return null

  return (
    <div className="wheel-overlay">
      <div className="wheel-modal" onClick={(e) => e.stopPropagation()}>
        <button className="wheel-close" type="button" aria-label="Close map wheel" onClick={onClose} disabled={spinning}>×</button>
        <div className={`wheel-content ${selectedMap ? 'wheel-finished' : ''}`}>
          <div className="wheel-main">
            <h3>Spin for Map</h3>
            <canvas ref={canvasRef} width={300} height={300} />
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
            <small>Exclude maps before spinning.</small>
            {maps.map((map) => {
              const isExcluded = excludedMaps.includes(map.name)
              return <label key={map.name}><input type="checkbox" checked={!isExcluded} onChange={() => setExcludedMaps((current) => isExcluded ? current.filter((name) => name !== map.name) : [...current, map.name])} disabled={spinning} /><span>{map.name}</span></label>
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