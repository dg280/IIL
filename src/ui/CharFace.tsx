import type { CSSProperties } from 'react'
import { getAssetUrl } from '../atelier/assets'

/**
 * Vignette ronde d'un personnage : son portrait IA si dispo, sinon une pastille
 * avec son initiale. Remplace le paper-doll dans le jeu et l'éditeur.
 */
export function CharFace({ portraitId, name, color, size = 34 }: { portraitId?: string; name: string; color?: string; size?: number }) {
  const url = portraitId ? getAssetUrl(portraitId) : null
  const style = { width: size, height: size } as CSSProperties
  if (url) {
    return (
      <span className="char-face" style={style}>
        <img src={url} alt={name} />
      </span>
    )
  }
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?'
  return (
    <span className="char-face char-face-initial" style={{ ...style, background: color ?? '#e35d7c' }}>
      {initial}
    </span>
  )
}
