import { useEffect, useRef, useState } from 'react'

/**
 * Visionneuse plein écran d'un portrait/décor : image entière (contain) + zoom.
 * Zoom via boutons ➕/➖, double-tap et molette ; déplacement en glissant quand zoomé.
 */
export function PortraitViewer({ src, alt, onClose }: { src: string; alt?: string; onClose: () => void }) {
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const clamp = (s: number) => Math.max(1, Math.min(4, s))
  const zoom = (d: number) =>
    setScale((s) => {
      const ns = clamp(s + d)
      if (ns === 1) setPos({ x: 0, y: 0 })
      return ns
    })

  return (
    <div className="viewer-overlay" onClick={onClose}>
      <div className="viewer-stage" onClick={(e) => e.stopPropagation()}>
        <img
          src={src}
          alt={alt}
          className="viewer-img"
          draggable={false}
          style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`, cursor: scale > 1 ? 'grab' : 'zoom-in' }}
          onDoubleClick={() => zoom(scale > 1 ? -3 : 1.2)}
          onWheel={(e) => zoom(e.deltaY < 0 ? 0.3 : -0.3)}
          onPointerDown={(e) => {
            if (scale > 1) {
              drag.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y }
              ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
            }
          }}
          onPointerMove={(e) => {
            if (drag.current) setPos({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) })
          }}
          onPointerUp={() => (drag.current = null)}
        />
        <div className="viewer-controls">
          <button aria-label="Dézoomer" onClick={() => zoom(-0.4)}>➖</button>
          <button aria-label="Réinitialiser" onClick={() => { setScale(1); setPos({ x: 0, y: 0 }) }}>↺</button>
          <button aria-label="Zoomer" onClick={() => zoom(0.4)}>➕</button>
        </div>
        <button className="viewer-close" aria-label="Fermer" onClick={onClose}>✕</button>
      </div>
    </div>
  )
}
