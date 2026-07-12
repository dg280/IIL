import type { RoomConfig } from './room'
import type { AvatarConfig } from '../avatar/types'
import { AvatarView } from '../avatar/AvatarView'
import { MotifGlyph } from '../avatar/Motifs'

function shade(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, Math.max(0, (num >> 16) + amount))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount))
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

interface Props {
  room: RoomConfig
  avatar?: AvatarConfig | null
  className?: string
}

export function RoomView({ room, avatar, className }: Props) {
  const wallDark = shade(room.wall, -18)
  const bedDark = shade(room.bed, -30)
  return (
    <svg viewBox="0 0 800 500" className={className} preserveAspectRatio="xMidYMid meet" role="img" aria-label="chambre">
      {/* mur + plinthe + sol */}
      <rect width="800" height="380" fill={room.wall} />
      <rect y="370" width="800" height="12" fill={wallDark} />
      <rect y="382" width="800" height="118" fill="#e8cba8" />
      <path d="M0,382 h800" stroke="#d4b28e" strokeWidth="5" />

      {/* fenêtre avec rideaux */}
      <rect x="80" y="60" width="180" height="160" fill="#cfe8f7" stroke="#fff" strokeWidth="10" />
      <circle cx="140" cy="105" r="18" fill="#fff" opacity="0.7" />
      <circle cx="122" cy="112" r="12" fill="#fff" opacity="0.7" />
      <path d="M80,60 l180,160" stroke="#fff" strokeWidth="4" opacity="0.5" />
      <path d="M70,50 h200 v14 h-200 Z" fill="#f6a8c8" />
      <path d="M84,64 q-12,80 4,150 l20,0 q-14,-72 -4,-150 Z M256,64 q12,80 -4,150 l-20,0 q14,-72 4,-150 Z" fill="#f9c3da" />

      {/* guirlande */}
      {room.guirlande && (
        <g>
          <path d="M300,40 Q400,90 500,42 Q600,90 700,44" stroke="#c9b8a0" strokeWidth="2.5" fill="none" />
          {[320, 360, 400, 440, 480, 530, 570, 610, 650, 690].map((x, i) => {
            const y = 40 + Math.abs(Math.sin((x - 300) / 63)) * 42
            return <circle key={x} cx={x} cy={y + 6} r="7" fill={['#ffe28a', '#f9b8d4', '#9ed4f5', '#c9f2a8'][i % 4]} />
          })}
        </g>
      )}

      {/* poster de l'Atelier magique */}
      {room.posterCustom && (
        <g>
          <rect x="320" y="80" width="110" height="140" rx="6" fill={room.posterCustom.background} stroke="#e5cfdc" strokeWidth="4" />
          <g transform="translate(375,150) scale(5.5)">
            <MotifGlyph kind={room.posterCustom.motif.kind} color={room.posterCustom.motif.color} />
          </g>
          <g transform="translate(345,110) scale(2.2)">
            <MotifGlyph kind={room.posterCustom.motif.kind} color={room.posterCustom.motif.color} />
          </g>
          <g transform="translate(408,190) scale(2.2)">
            <MotifGlyph kind={room.posterCustom.motif.kind} color={room.posterCustom.motif.color} />
          </g>
        </g>
      )}

      {/* poster */}
      {!room.posterCustom && room.poster && (
        <g>
          <rect x="320" y="80" width="110" height="140" rx="6" fill="#fff" stroke="#e5cfdc" strokeWidth="4" />
          {room.poster === 'etoile' && (
            <path d="M375,110 l10,24 26,3 -19,17 5,26 -22,-13 -22,13 5,-26 -19,-17 26,-3 Z" fill="#f2c94c" />
          )}
          {room.poster === 'coeur' && (
            <path d="M375,190 C340,160 340,125 358,118 C368,114 375,122 375,130 C375,122 382,114 392,118 C410,125 410,160 375,190 Z" fill="#e35d7c" />
          )}
          {room.poster === 'musique' && (
            <g fill="#8a63d2">
              <ellipse cx="355" cy="180" rx="12" ry="9" />
              <rect x="364" y="110" width="7" height="72" />
              <ellipse cx="393" cy="168" rx="12" ry="9" />
              <rect x="402" y="98" width="7" height="72" />
              <path d="M364,110 L409,98 L409,116 L364,128 Z" />
            </g>
          )}
        </g>
      )}

      {/* étagère */}
      {room.etagere && (
        <g>
          <rect x="490" y="120" width="150" height="12" rx="4" fill="#b98a63" />
          <rect x="500" y="88" width="16" height="32" fill="#e35d7c" />
          <rect x="520" y="92" width="14" height="28" fill="#5a77c9" />
          <rect x="538" y="86" width="18" height="34" fill="#67b57f" />
          <rect x="560" y="94" width="13" height="26" fill="#f2b33d" />
          <path d="M590,100 l8,18 -18,0 Z" fill="#8a63d2" />
          <circle cx="618" cy="108" r="11" fill="#f9b8d4" />
        </g>
      )}

      {/* lit */}
      <g>
        <rect x="520" y="250" width="240" height="76" rx="14" fill={room.bed} />
        <rect x="520" y="306" width="240" height="60" rx="10" fill={bedDark} />
        <rect x="536" y="228" width="64" height="44" rx="14" fill="#fff" />
        <rect x="744" y="240" width="24" height="122" rx="7" fill={shade(room.bed, -50)} />
        <rect x="512" y="240" width="24" height="122" rx="7" fill={shade(room.bed, -50)} />
        <path d="M540,290 q40,14 200,2" stroke={shade(room.bed, 35)} strokeWidth="5" fill="none" opacity="0.8" />
      </g>

      {/* peluche sur le lit */}
      {room.peluche && (
        <g transform="translate(636,236)">
          <ellipse cx="0" cy="18" rx="16" ry="14" fill="#e8d5c4" />
          <circle cx="0" cy="-2" r="11" fill="#e8d5c4" />
          <ellipse cx="-7" cy="-16" rx="4" ry="10" fill="#e8d5c4" />
          <ellipse cx="7" cy="-16" rx="4" ry="10" fill="#e8d5c4" />
          <ellipse cx="-7" cy="-15" rx="2" ry="7" fill="#f4b8c8" />
          <ellipse cx="7" cy="-15" rx="2" ry="7" fill="#f4b8c8" />
          <circle cx="-4" cy="-4" r="1.6" fill="#4a3540" />
          <circle cx="4" cy="-4" r="1.6" fill="#4a3540" />
          <path d="M-2,1 q2,2 4,0" stroke="#4a3540" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </g>
      )}

      {/* bureau */}
      <g>
        <rect x="90" y="270" width="150" height="14" rx="4" fill="#b98a63" />
        <rect x="100" y="284" width="12" height="82" fill="#a97a54" />
        <rect x="218" y="284" width="12" height="82" fill="#a97a54" />
        <rect x="130" y="240" width="46" height="32" rx="4" fill="#fff" stroke="#d4b28e" strokeWidth="3" />
        <rect x="146" y="272" width="14" height="4" fill="#d4b28e" />
      </g>

      {/* lampe champignon */}
      {room.lampe && (
        <g transform="translate(196,232)">
          <path d="M-22,10 A22,16 0 0 1 22,10 Z" fill="#f2b33d" />
          <rect x="-4" y="10" width="8" height="26" rx="3" fill="#e8d5c4" />
          <ellipse cx="0" cy="10" rx="24" ry="6" fill="#ffe28a" opacity="0.55" />
        </g>
      )}

      {/* tapis */}
      {room.rug && (
        <g>
          <ellipse cx="380" cy="440" rx="130" ry="34" fill={room.rug} opacity="0.9" />
          <ellipse cx="380" cy="440" rx="95" ry="24" fill={shade(room.rug, 30)} opacity="0.7" />
        </g>
      )}

      {/* plante */}
      {room.plante && (
        <g transform="translate(60,320)">
          <path d="M-16,60 h32 l-5,38 h-22 Z" fill="#c96f4a" />
          <path d="M0,58 C-4,30 -22,22 -30,2 C-10,8 -4,26 0,40 C4,20 12,8 30,0 C24,24 8,32 2,58 Z" fill="#5da86a" />
          <path d="M0,58 C0,40 -2,28 -12,14" stroke="#3f7d5a" strokeWidth="2.5" fill="none" />
        </g>
      )}

      {/* avatar dans la chambre */}
      {avatar && (
        <g transform="translate(310,205) scale(0.83)">
          <AvatarView config={avatar} expr="joie" width={220} />
        </g>
      )}
    </svg>
  )
}
