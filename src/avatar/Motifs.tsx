import type { Motif, MotifKind, Outfit } from './types'

/** Petit glyphe de motif, centré sur (0,0), taille ~1 (à scaler). */
export function MotifGlyph({ kind, color }: { kind: MotifKind; color: string }) {
  switch (kind) {
    case 'etoile':
      return <path d="M0,-5 L1.5,-1.5 5,-1 2,1.5 3,5 0,3 -3,5 -2,1.5 -5,-1 -1.5,-1.5 Z" fill={color} />
    case 'coeur':
      return <path d="M0,4 C-5,0 -5,-4 -2.5,-4.5 C-1,-4.8 0,-3.5 0,-2.5 C0,-3.5 1,-4.8 2.5,-4.5 C5,-4 5,0 0,4 Z" fill={color} />
    case 'fleur':
      return (
        <g fill={color}>
          <circle cx="0" cy="-3" r="2" />
          <circle cx="2.9" cy="-0.9" r="2" />
          <circle cx="1.8" cy="2.4" r="2" />
          <circle cx="-1.8" cy="2.4" r="2" />
          <circle cx="-2.9" cy="-0.9" r="2" />
          <circle cx="0" cy="0" r="1.6" fill="#fff" opacity="0.85" />
        </g>
      )
    case 'lune':
      return <path d="M1.5,-4.5 A5,5 0 1 0 4.5,2 A4,4 0 1 1 1.5,-4.5 Z" fill={color} />
    case 'eclair':
      return <path d="M1,-5 L-3,0.5 L-0.5,0.5 L-1,5 L3,-0.5 L0.5,-0.5 Z" fill={color} />
    case 'note':
      return (
        <g fill={color}>
          <ellipse cx="-1.5" cy="3" rx="2" ry="1.5" />
          <rect x="0" y="-4" width="1.2" height="7.5" />
          <path d="M0,-4 q3,0.5 3,2.5 q-1.2,-1 -3,-1 Z" />
        </g>
      )
    case 'pois':
      return <circle cx="0" cy="0" r="2.6" fill={color} />
    case 'paillettes':
      return (
        <g fill={color}>
          <path d="M0,-4 L1,-1 4,0 1,1 0,4 -1,1 -4,0 -1,-1 Z" />
        </g>
      )
  }
}

/** Points d'ancrage sûrs (zone habillée) par silhouette de tenue. */
function anchors(outfit: Outfit): [number, number, number][] {
  // [x, y, scale]
  const torso: [number, number, number][] = [
    [98, 150, 1], [122, 143, 0.85], [108, 168, 1.1], [125, 178, 0.8], [93, 182, 0.9],
  ]
  const skirt: [number, number, number][] = [
    [96, 215, 1], [118, 220, 0.9], [108, 236, 1.15],
  ]
  const gown: [number, number, number][] = [
    [88, 220, 1], [126, 214, 0.95], [104, 244, 1.2], [140, 248, 0.9], [72, 250, 0.9],
  ]
  const pantsLegs: [number, number, number][] = [
    [101, 230, 0.85], [119, 248, 0.85],
  ]
  switch (outfit) {
    case 'bal':
      return [...torso, ...gown]
    case 'etoile':
      return [...torso, ...skirt, [90, 236, 0.9], [128, 240, 0.95]]
    case 'uniforme':
    case 'sweat':
    case 'pop':
    case 'aventure':
    case 'gakuran':
    case 'blazer':
      return [...torso, [100, 214, 0.9], [121, 218, 0.85]]
    case 'scene_rock':
    case 'prince':
      return [...torso, ...pantsLegs]
  }
}

/** Superposition de motifs « brodés » sur la tenue. */
export function ClothingMotifs({ outfit, motif }: { outfit: Outfit; motif: Motif }) {
  const pts = anchors(outfit)
  const count = motif.density === 1 ? 4 : motif.density === 2 ? 7 : pts.length + 4
  const chosen: [number, number, number][] = []
  for (let i = 0; i < count; i++) {
    const base = pts[i % pts.length]
    // au-delà d'un tour complet, on décale légèrement pour densifier
    const wave = Math.floor(i / pts.length)
    chosen.push([base[0] + wave * 9 - 4, base[1] + wave * 6 - 3, base[2] * (wave ? 0.7 : 1)])
  }
  return (
    <g opacity="0.92">
      {chosen.map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x},${y}) scale(${s * 1.15}) rotate(${(i * 47) % 40 - 20})`}>
          <MotifGlyph kind={motif.kind} color={motif.color} />
        </g>
      ))}
    </g>
  )
}
