import { useEffect, useRef, useState } from 'react'
import type { MapData } from '../data'

interface MapWheelProps {
  maps: MapData[]
  isOpen: boolean
  onClose: () => void
  onSelect: (map: MapData) => void
}

const CATEGORY_COLORS: Record<string, string> = {
  'Open': '#4ade80',
  'Close Quarters': '#60a5fa',
  'Hazardous Terrain': '#f87171',
}

function MapWheel({ maps, isOpen, onClose, onSelect }: MapWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [spinning, setSpinning] = useState(false)
  const [selectedMap, setSelectedMap] = useState<MapData | null>(null)
  const animationFrameRef = useRef<number>()

  const spin = () => {
    if (spinning || maps.length === 0) return
    setSpinning(true)
    setSelectedMap(null)

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const radius = Math.min(centerX, centerY) - 20

    const segments = maps.length
    const arc = (2 * Math.PI) / segments

    const fullRotations = 5 + Math.random() * 3
    const extraRotation = Math.random() * 2 * Math.PI
    const targetAngle = fullRotations * 2 * Math.PI + extraRotation
    const duration = 3500
    const startTime = performance.now()

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easedProgress = 1 - Math.pow(1 - progress, 3)
      const currentAngle = targetAngle * easedProgress

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      maps.forEach((map, index) => {
        const startAngle = index * arc - Math.PI / 2 + currentAngle
        const endAngle = startAngle + arc

        ctx.beginPath()
        ctx.moveTo(centerX, centerY)
        ctx.arc(centerX, centerY, radius, startAngle, endAngle)
        ctx.closePath()

        const colorKey = map.category as keyof typeof CATEGORY_COLORS
        ctx.fillStyle = CATEGORY_COLORS[colorKey] || '#888'
        ctx.fill()

        ctx.strokeStyle = '#1e1e1e'
        ctx.lineWidth = 2
        ctx.stroke()

        ctx.save()
        ctx.translate(centerX, centerY)
        ctx.rotate(startAngle + arc / 2)
        ctx.textAlign = 'right'
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 14px system-ui'
        const textRadius = radius * 0.7
        ctx.fillText(map.name, textRadius, 5)
        ctx.restore()
      })

      ctx.beginPath()
      ctx.moveTo(centerX, 10)
      ctx.lineTo(centerX - 10, 30)
      ctx.lineTo(centerX + 10, 30)
      ctx.closePath()
      ctx.fillStyle = '#fff'
      ctx.fill()
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 2
      ctx.stroke()

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate)
      } else {
        const finalAngle = (targetAngle % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)
        const pointerAngle = -Math.PI / 2
        const relativeAngle = (pointerAngle - finalAngle + 2 * Math.PI) % (2 * Math.PI)
        const winningIndex = Math.floor(relativeAngle / arc) % segments
        const winner = maps[winningIndex]
        setSelectedMap(winner)
        setSpinning(false)
        setTimeout(() => {
          onSelect(winner)
          onClose()
        }, 500)
      }
    }

    animationFrameRef.current = requestAnimationFrame(animate)
  }

  useEffect(() => {
    if (!isOpen) {
      cancelAnimationFrame(animationFrameRef.current)
      setSpinning(false)
      setSelectedMap(null)
    }
  }, [isOpen])

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
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="wheel-overlay" onClick={onClose}>
      <div className="wheel-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Spin for Map</h3>
        <canvas ref={canvasRef} width={300} height={300} />
        <div className="wheel-legend">
          {Object.entries(CATEGORY_COLORS).map(([category, color]) => (
            <span key={category} className="legend-item">
              <i style={{ backgroundColor: color }} />
              {category}
            </span>
          ))}
        </div>
        <button
          className={`spin-btn ${spinning ? 'spinning' : ''}`}
          onClick={spin}
          disabled={spinning || maps.length === 0}
        >
          {spinning ? 'Spinning...' : selectedMap ? `Selected: ${selectedMap.name}` : 'Spin Wheel'}
        </button>
        <button className="close-btn" onClick={onClose} disabled={spinning}>
          Cancel
        </button>
      </div>
    </div>
  )
}

export default MapWheel