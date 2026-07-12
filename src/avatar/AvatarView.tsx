import type { AvatarConfig, BodyType, Expression, HairStyle } from './types'

interface Props {
  config: AvatarConfig
  expr?: Expression
  width?: number | string
  className?: string
}

function shade(hex: string, amount: number): string {
  const n = hex.replace('#', '')
  const num = parseInt(n, 16)
  const r = Math.min(255, Math.max(0, (num >> 16) + amount))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount))
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/*
 * Gabarit (viewBox 220×300) — proportions « ado » :
 * tête : ellipse (110,78) rx41 ry44 · yeux y≈88 · cou y118-134
 * épaules y≈136 · taille y≈188 · hanches y≈205 · jambes y≈200→282
 */

const ARM_L = 'M86,140 C76,162 75,186 79,211'
const ARM_R = 'M134,140 C144,162 145,186 141,211'

function HairBack({ style, color }: { style: HairStyle; color: string }) {
  const dark = shade(color, -28)
  const hug = <ellipse cx="110" cy="74" rx="46" ry="48" fill={color} />
  switch (style) {
    case 'long':
      return (
        <g>
          <path
            d={`M110,28 C66,28 58,66 60,104 C61,140 56,176 50,204
                C60,200 68,204 72,196 C76,204 84,200 86,192
                C82,160 84,130 88,108 L132,108 C136,130 138,160 134,192
                C136,200 144,204 148,196 C152,204 160,200 170,204
                C164,176 159,140 160,104 C162,66 154,28 110,28 Z`}
            fill={color}
          />
          <path d="M66,120 C64,156 60,184 55,200 M154,120 C156,156 160,184 165,200" stroke={dark} strokeWidth="2.5" fill="none" opacity="0.45" />
        </g>
      )
    case 'couettes':
      return (
        <g>
          {hug}
          <path d="M64,66 C46,74 42,120 50,168 C53,182 60,190 64,182 C60,186 70,192 72,180 C66,140 68,100 72,82 Z" fill={color} />
          <path d="M156,66 C174,74 178,120 170,168 C167,182 160,190 156,182 C160,186 150,192 148,180 C154,140 152,100 148,82 Z" fill={color} />
          <path d="M56,120 C56,144 58,162 61,176 M164,120 C164,144 162,162 159,176" stroke={dark} strokeWidth="2" fill="none" opacity="0.45" />
          <circle cx="66" cy="72" r="7" fill={dark} />
          <circle cx="154" cy="72" r="7" fill={dark} />
        </g>
      )
    case 'carre':
      return (
        <g>
          <path
            d={`M110,28 C66,28 56,62 58,96 C59,118 62,132 68,140 C74,146 80,144 80,136
                L80,104 L140,104 L140,136 C140,144 146,146 152,140 C158,132 161,118 162,96
                C164,62 154,28 110,28 Z`}
            fill={color}
          />
        </g>
      )
    case 'chignon':
      return (
        <g>
          <circle cx="110" cy="26" r="17" fill={color} />
          <circle cx="110" cy="26" r="17" fill={dark} opacity="0.25" />
          <path d="M100,38 q10,6 20,0" stroke={dark} strokeWidth="2" fill="none" opacity="0.5" />
          {hug}
        </g>
      )
    case 'court':
      return <ellipse cx="110" cy="72" rx="45" ry="46" fill={color} />
    case 'meche':
      return <ellipse cx="110" cy="72" rx="45" ry="46" fill={color} />
    case 'hirsute':
      return (
        <g fill={color}>
          <ellipse cx="110" cy="72" rx="45" ry="46" />
          <path d="M66,52 L52,40 L68,42 L60,26 L76,34 L74,18 L88,30 L92,14 L102,28 L110,12 L118,28 L128,14 L132,30 L146,18 L144,34 L160,26 L152,42 L168,40 L154,52 Z" />
        </g>
      )
  }
}

function HairFront({ style, color }: { style: HairStyle; color: string }) {
  const light = shade(color, 26)
  const dark = shade(color, -20)

  // frange douce avec pointes, pour les styles « classiques »
  const soft = (
    <g>
      <path
        d={`M110,32 C74,32 62,56 63,84 C67,80 69,68 72,60 C74,70 80,76 85,64
            C89,74 97,76 102,64 C107,76 115,76 120,64 C125,76 133,74 137,64
            C142,76 147,70 149,60 C152,68 154,80 157,84 C159,56 146,32 110,32 Z`}
        fill={color}
      />
      <path d="M82,42 C94,36 122,35 138,42" stroke={light} strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.65" />
    </g>
  )
  const sideLocks = (
    <g fill={color}>
      <path d="M63,80 C60,98 61,114 66,126 C70,118 72,102 70,84 Z" />
      <path d="M157,80 C160,98 159,114 154,126 C150,118 148,102 150,84 Z" />
    </g>
  )
  switch (style) {
    case 'long':
    case 'couettes':
    case 'chignon':
      return (
        <g>
          {soft}
          {style !== 'couettes' && sideLocks}
        </g>
      )
    case 'carre':
      return (
        <g>
          {soft}
          {sideLocks}
        </g>
      )
    case 'court':
      return (
        <g>
          <path
            d={`M110,30 C72,30 62,54 64,82 C70,76 72,64 76,56 C80,66 88,68 94,58
                C100,68 110,68 116,58 C122,68 130,66 136,56 C142,64 148,74 156,82
                C158,54 148,30 110,30 Z`}
            fill={color}
          />
          <path d="M80,44 C92,37 120,36 136,43" stroke={light} strokeWidth="3.5" fill="none" strokeLinecap="round" opacity="0.6" />
        </g>
      )
    case 'meche':
      return (
        <g>
          <path
            d={`M110,30 C72,30 60,56 64,86 C70,80 72,68 74,60
                C82,74 108,76 128,62 C140,54 148,66 152,84 C158,60 148,30 110,30 Z`}
            fill={color}
          />
          <path d="M74,60 C86,72 112,72 128,60 L134,70 C116,84 88,84 72,70 Z" fill={dark} opacity="0.35" />
          <path d="M80,42 C94,35 122,34 138,42" stroke={light} strokeWidth="3.5" fill="none" strokeLinecap="round" opacity="0.6" />
        </g>
      )
    case 'hirsute':
      return (
        <g>
          <path
            d={`M110,30 C74,30 62,54 64,84 C70,76 74,66 78,54 C82,64 90,66 96,54
                C102,66 112,66 118,54 C124,66 132,64 136,54 C142,66 148,76 156,84
                C158,54 146,30 110,30 Z`}
            fill={color}
          />
        </g>
      )
  }
}

function Face({ expr, skin, eyeColor, browColor }: { expr: Expression; skin: string; eyeColor: string; browColor: string }) {
  const ink = '#3c2a35'
  const blushColor = '#f4a0b5'
  const L = { x: 93, y: 89 }
  const R = { x: 127, y: 89 }

  const openEye = (x: number, y: number, irisShift = 0, irisDrop = 0, wide = false) => (
    <g>
      <ellipse cx={x} cy={y} rx={wide ? 8.5 : 7.5} ry={wide ? 10.5 : 9.5} fill="#fff" />
      <circle cx={x + irisShift} cy={y + 1 + irisDrop} r={wide ? 4.6 : 5.4} fill={eyeColor} />
      <circle cx={x + irisShift} cy={y + 1 + irisDrop} r={wide ? 2.1 : 2.6} fill={ink} />
      <circle cx={x + irisShift - 1.6} cy={y - 1.5 + irisDrop} r={1.7} fill="#fff" />
      <path d={`M${x - 8},${y - 6} Q${x},${y - 12} ${x + 8},${y - 6}`} stroke={ink} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d={`M${x + 6.5},${y - 7.5} l3,-2.5`} stroke={ink} strokeWidth="2" fill="none" strokeLinecap="round" />
    </g>
  )
  const brow = (x: number, tilt: number, lift = 0) => (
    <path
      d={`M${x - 8},${77 - lift + tilt} Q${x},${73 - lift - tilt} ${x + 8},${75 - lift - tilt / 2}`}
      stroke={browColor}
      strokeWidth="2.8"
      fill="none"
      strokeLinecap="round"
    />
  )
  const browMirror = (x: number, tilt: number, lift = 0) => (
    <path
      d={`M${x + 8},${77 - lift + tilt} Q${x},${73 - lift - tilt} ${x - 8},${75 - lift - tilt / 2}`}
      stroke={browColor}
      strokeWidth="2.8"
      fill="none"
      strokeLinecap="round"
    />
  )
  const nose = <path d="M110,97 q2.5,4 0,7" stroke={shade(skin, -38)} strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.55" />
  const blush = (strong = false) => (
    <g opacity={strong ? 0.8 : 0.35}>
      <ellipse cx="83" cy="101" rx="7.5" ry="4" fill={blushColor} />
      <ellipse cx="137" cy="101" rx="7.5" ry="4" fill={blushColor} />
    </g>
  )

  let eyes: JSX.Element
  let brows: JSX.Element
  let mouth: JSX.Element
  let extra: JSX.Element | null = null

  switch (expr) {
    case 'joie':
      eyes = (
        <g stroke="#3c2a35" strokeWidth="3" fill="none" strokeLinecap="round">
          <path d={`M${L.x - 7},${L.y} q7,-9 14,0`} />
          <path d={`M${R.x - 7},${R.y} q7,-9 14,0`} />
        </g>
      )
      brows = <g>{brow(L.x, 0, 3)}{browMirror(R.x, 0, 3)}</g>
      mouth = <path d="M102,107 q8,9 16,0 q-8,3.5 -16,0 Z" fill="#b64a62" />
      extra = blush()
      break
    case 'gene':
      eyes = <g>{openEye(L.x, L.y, 1.5)}{openEye(R.x, R.y, 1.5)}</g>
      brows = <g>{brow(L.x, 2, 1)}{browMirror(R.x, 2, 1)}</g>
      mouth = <path d="M103,109 q4,3.5 7,0 q4,-3.5 7,0" stroke="#b64a62" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      extra = blush(true)
      break
    case 'surprise':
      eyes = <g>{openEye(L.x, L.y, 0, 0, true)}{openEye(R.x, R.y, 0, 0, true)}</g>
      brows = <g>{brow(L.x, 0, 6)}{browMirror(R.x, 0, 6)}</g>
      mouth = <ellipse cx="110" cy="110" rx="4.5" ry="6" fill="#b64a62" />
      break
    case 'triste':
      eyes = <g>{openEye(L.x, L.y, 0, 2)}{openEye(R.x, R.y, 0, 2)}</g>
      brows = <g>{brow(L.x, -3, 2)}{browMirror(R.x, -3, 2)}</g>
      mouth = <path d="M103,111 q7,-6 14,0" stroke="#b64a62" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      extra = <ellipse cx={R.x + 10} cy={R.y + 12} rx="2.6" ry="4.5" fill="#9ed4f5" />
      break
    case 'colere':
      eyes = <g>{openEye(L.x, L.y)}{openEye(R.x, R.y)}</g>
      brows = <g>{brow(L.x, 5)}{browMirror(R.x, 5)}</g>
      mouth = <path d="M103,111 q7,-5 14,0" stroke="#b64a62" strokeWidth="2.8" fill="none" strokeLinecap="round" />
      extra = <path d="M152,58 l6,-6 M156,66 l8,-3 M147,53 l3,-8" stroke="#e35d7c" strokeWidth="2.6" strokeLinecap="round" />
      break
    default:
      eyes = <g>{openEye(L.x, L.y)}{openEye(R.x, R.y)}</g>
      brows = <g>{brow(L.x, 0)}{browMirror(R.x, 0)}</g>
      mouth = <path d="M103,108 q7,6 14,0" stroke="#b64a62" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      extra = blush()
  }

  return (
    <g>
      {extra}
      {brows}
      {eyes}
      {nose}
      {mouth}
    </g>
  )
}

function BodyBase({ body, skin }: { body: BodyType; skin: string }) {
  const dark = shade(skin, -22)
  const shoulderY = 136
  const torso =
    body === 'fille'
      ? `M85,${shoulderY} C88,130 98,127 110,127 C122,127 132,130 135,${shoulderY}
         L133,166 C130,178 129,186 130,198 L90,198 C91,186 90,178 87,166 Z`
      : `M81,${shoulderY} C85,129 97,126 110,126 C123,126 135,129 139,${shoulderY}
         L136,172 L134,200 L86,200 L84,172 Z`
  const legW = body === 'fille' ? 11 : 13
  return (
    <g>
      {/* jambes */}
      <rect x={110 - legW - 2} y="192" width={legW} height="88" rx={legW / 2} fill={skin} />
      <rect x={112} y="192" width={legW} height="88" rx={legW / 2} fill={skin} />
      {/* chaussures */}
      <path d={`M${110 - legW - 4},278 h${legW + 4} v6 q0,4 -5,4 h-${legW - 2} q-5,0 -5,-4 Z`} fill="#6d5468" />
      <path d={`M${110 + 2},278 h${legW + 4} v6 q0,4 -5,4 h-${legW - 2} q-5,0 -5,-4 Z`} fill="#6d5468" />
      {/* bras */}
      <path d={ARM_L} stroke={skin} strokeWidth="11" fill="none" strokeLinecap="round" />
      <path d={ARM_R} stroke={skin} strokeWidth="11" fill="none" strokeLinecap="round" />
      {/* torse */}
      <path d={torso} fill={skin} />
      {/* cou */}
      <path d="M103,116 L103,132 Q110,138 117,132 L117,116 Z" fill={skin} />
      <path d="M103,116 L103,124 Q110,130 117,124 L117,116 Z" fill={dark} opacity="0.5" />
    </g>
  )
}

function OutfitLayer({ config }: { config: AvatarConfig }) {
  const c1 = config.outfitColor
  const c2 = config.outfitColor2
  const d1 = shade(c1, -28)
  const d2 = shade(c2, -24)
  const girl = config.body === 'fille'

  // hauts communs
  const fittedTop = () =>
    girl
      ? `M85,136 C88,130 98,127 110,127 C122,127 132,130 135,136 L133,166 C130,178 129,186 130,196 L90,196 C91,186 90,178 87,166 Z`
      : `M81,136 C85,129 97,126 110,126 C123,126 135,129 139,136 L136,172 L134,198 L86,198 L84,172 Z`
  const sleeves = (color: string, w = 11) => (
    <g stroke={color} strokeWidth={w} fill="none" strokeLinecap="round">
      <path d="M86,140 C79,155 77,168 78,178" />
      <path d="M134,140 C141,155 143,168 142,178" />
    </g>
  )
  const shortSleeves = (color: string) => (
    <g stroke={color} strokeWidth="12" fill="none" strokeLinecap="round">
      <path d="M86,139 C82,146 80,152 79,158" />
      <path d="M134,139 C138,146 140,152 141,158" />
    </g>
  )
  const pants = (color: string) => (
    <g>
      <path d="M87,192 L133,192 L134,214 L114,214 L112,200 L108,200 L106,214 L86,214 Z" fill={color} />
      <rect x="95" y="212" width="13" height="66" rx="5" fill={color} />
      <rect x="112" y="212" width="13" height="66" rx="5" fill={color} />
    </g>
  )
  const pleatedSkirt = (color: string, dk: string) => (
    <g>
      <path d="M88,190 L132,190 L142,226 L78,226 Z" fill={color} />
      <path d="M90,190 L96,226 M101,190 L104,226 M110,190 L110,226 M119,190 L116,226 M130,190 L124,226" stroke={dk} strokeWidth="2" opacity="0.5" />
    </g>
  )

  switch (config.outfit) {
    case 'uniforme':
      return (
        <g>
          <path d={fittedTop()} fill={c2} />
          {shortSleeves(c2)}
          <path d="M88,134 L110,152 L132,134 L135,146 L110,164 L85,146 Z" fill={c1} />
          <path d="M104,155 l6,-5 l6,5 l-6,8 Z" fill="#e35d7c" />
          {girl ? pleatedSkirt(c1, d1) : pants(c1)}
        </g>
      )
    case 'blazer':
      return (
        <g>
          <path d={fittedTop()} fill={c2} />
          <path d="M106,130 L110,168 L114,130 Z" fill="#fff" />
          <path d="M107,132 l3,5 l3,-5 l-3,14 Z" fill="#c2566e" />
          <path d={fittedTop()} fill={c1} opacity="0" />
          <path d="M85,136 C88,131 96,128 104,127 L108,134 L96,196 L90,196 C91,186 90,178 87,166 Z" fill={c1} />
          <path d="M135,136 C132,131 124,128 116,127 L112,134 L124,196 L130,196 C129,186 130,178 133,166 Z" fill={c1} />
          <path d="M104,127 L108,134 L104,142 L99,132 Z M116,127 L112,134 L116,142 L121,132 Z" fill={d1} />
          {sleeves(c1)}
          {girl ? pleatedSkirt(shade(c1, -10), d1) : pants(shade(c1, -14))}
        </g>
      )
    case 'sweat':
      return (
        <g>
          <path d={girl ? 'M84,138 C86,130 97,126 110,126 C123,126 134,130 136,138 L136,200 L84,200 Z' : 'M80,138 C84,129 96,125 110,125 C124,125 136,129 140,138 L138,204 L82,204 Z'} fill={c1} />
          <path d="M96,130 C102,140 118,140 124,130" stroke={d1} strokeWidth="4" fill="none" strokeLinecap="round" />
          <rect x="98" y="168" width="24" height="16" rx="6" fill={d1} opacity="0.45" />
          <path d="M104,132 L104,144 M116,132 L116,144" stroke={c2} strokeWidth="3.5" strokeLinecap="round" />
          {sleeves(c1, 12)}
          {girl ? pleatedSkirt(c2, d2) : pants(shade(c2, -6))}
        </g>
      )
    case 'etoile':
      return (
        <g>
          <path d={fittedTop()} fill={c1} />
          <path d="M88,132 L132,132 L133,140 L87,140 Z" fill="#ffe28a" />
          <path d="M90,190 C74,226 76,244 78,252 L142,252 C144,244 146,226 130,190 Z" fill={c2} />
          <path d="M110,214 l3.5,8 9,1 -6.5,6 2,9 -8,-4.5 -8,4.5 2,-9 -6.5,-6 9,-1 Z" fill="#ffe28a" />
          <circle cx="92" cy="236" r="2" fill="#fff" opacity="0.9" />
          <circle cx="126" cy="228" r="1.8" fill="#fff" opacity="0.9" />
          <circle cx="102" cy="246" r="1.8" fill="#fff" opacity="0.7" />
        </g>
      )
    case 'pop':
      return (
        <g>
          <path d={fittedTop()} fill={c2} />
          <path d="M110,150 l3,6.5 7,0.8 -5,5 1.5,7 -6.5,-4 -6.5,4 1.5,-7 -5,-5 7,-0.8 Z" fill={c1} />
          <path d="M85,134 L97,130 L95,192 L88,190 Z M135,134 L123,130 L125,192 L132,190 Z" fill={c1} />
          {sleeves(c1)}
          {girl ? pleatedSkirt(d1, shade(d1, -20)) : pants(shade(c1, -30))}
        </g>
      )
    case 'bal':
      return (
        <g>
          <path d={fittedTop()} fill={c1} />
          <path d="M88,133 Q110,144 132,133 L132,141 Q110,152 88,141 Z" fill={shade(c1, 32)} />
          <path d="M89,188 C60,238 56,262 58,272 L162,272 C164,262 160,238 131,188 Z" fill={c2} />
          <path d="M89,188 C82,202 72,226 66,250 M131,188 C138,202 148,226 154,250" stroke={d2} strokeWidth="2.2" fill="none" opacity="0.5" />
          <circle cx="84" cy="244" r="2.6" fill="#fff" opacity="0.85" />
          <circle cx="118" cy="230" r="2.2" fill="#fff" opacity="0.85" />
          <circle cx="140" cy="254" r="2.6" fill="#fff" opacity="0.85" />
          <path d="M104,182 l6,-5 l6,5 l-6,6 Z" fill="#ffe28a" />
        </g>
      )
    case 'prince':
      return (
        <g>
          <path d={fittedTop()} fill={c1} />
          {sleeves(c1)}
          <path d="M110,128 L110,196" stroke="#ffe28a" strokeWidth="2.5" />
          <circle cx="103" cy="146" r="2" fill="#ffe28a" />
          <circle cx="103" cy="160" r="2" fill="#ffe28a" />
          <circle cx="103" cy="174" r="2" fill="#ffe28a" />
          <path d="M84,138 L96,130 L98,142 L88,148 Z" fill="#ffe28a" opacity="0.9" />
          <path d="M84,190 L136,190 L136,200 L84,200 Z" fill={d1} />
          <rect x="103" y="188" width="14" height="13" rx="2" fill="#ffe28a" />
          {pants(c2 === '#f5f1f7' ? shade(c1, -34) : shade(c2, -10))}
        </g>
      )
    case 'scene_rock':
      return (
        <g>
          <path d={fittedTop()} fill={c2} />
          <path d="M110,148 l3,6.5 7,0.8 -5,5 1.5,7 -6.5,-4 -6.5,4 1.5,-7 -5,-5 7,-0.8 Z" fill="#ffe28a" />
          <path d="M84,136 L98,129 L96,198 L87,196 Z M136,136 L122,129 L124,198 L133,196 Z" fill={c1} />
          <path d="M98,129 L96,198 M122,129 L124,198" stroke={d1} strokeWidth="2" opacity="0.6" />
          {sleeves(c1)}
          <circle cx="90" cy="150" r="1.6" fill="#ffe28a" />
          <circle cx="130" cy="150" r="1.6" fill="#ffe28a" />
          {pants(shade(c1, -26))}
        </g>
      )
    case 'aventure':
      return (
        <g>
          <path d={fittedTop()} fill={c1} />
          {sleeves(c2, 10)}
          <path d="M86,166 L134,166 L134,176 L86,176 Z" fill="#7a5638" />
          <rect x="103" y="164" width="14" height="13" rx="2" fill="#f2b33d" />
          <path d="M110,128 L110,164" stroke={d1} strokeWidth="2.5" opacity="0.6" />
          {girl ? pleatedSkirt(c2, d2) : pants(shade(c2, -8))}
          <path d="M92,268 h17 v12 h-17 Z M111,268 h17 v12 h-17 Z" fill="#7a5638" />
        </g>
      )
  }
}

function AccessoryLayer({ config }: { config: AvatarConfig }) {
  const c = config.outfitColor
  switch (config.accessory) {
    case 'noeud':
      return (
        <g transform="translate(146,42) rotate(16)">
          <path d="M0,0 L-15,-8 L-13,8 Z" fill={c} />
          <path d="M0,0 L15,-8 L13,8 Z" fill={c} />
          <circle cx="0" cy="0" r="4" fill={shade(c, -30)} />
        </g>
      )
    case 'diademe':
      return (
        <g>
          <path d="M88,36 Q110,26 132,36 L129,43 Q110,35 91,43 Z" fill="#f2c94c" />
          <path d="M107,26 l3,-8 l3,8 Z M93,30 l2,-6 l3,6 Z M122,30 l3,-6 l2,6 Z" fill="#f2c94c" />
          <circle cx="110" cy="32" r="3" fill="#e35d7c" />
        </g>
      )
    case 'lunettes':
      return (
        <g stroke="#3c2a35" strokeWidth="2.6" fill="rgba(255,255,255,0.22)">
          <rect x="81" y="80" width="24" height="18" rx="8" />
          <rect x="115" y="80" width="24" height="18" rx="8" />
          <path d="M105,88 L115,88" fill="none" />
        </g>
      )
    case 'etoile':
      return <path d="M70,46 l3.5,8 9,1 -6.5,6 2,9 -8,-4.5 -8,4.5 2,-9 -6.5,-6 9,-1 Z" fill="#f2c94c" />
    default:
      return null
  }
}

export function AvatarView({ config, expr = 'neutre', width = 180, className }: Props) {
  const skin = config.skin
  const browColor = shade(config.hairColor, -35)
  return (
    <svg viewBox="0 0 220 300" width={width} className={className} role="img" aria-label="avatar">
      <HairBack style={config.hairStyle} color={config.hairColor} />
      <BodyBase body={config.body} skin={skin} />
      <OutfitLayer config={config} />
      {/* tête */}
      <ellipse cx="69" cy="88" rx="6" ry="8" fill={skin} />
      <ellipse cx="151" cy="88" rx="6" ry="8" fill={skin} />
      <path
        d="M110,34 C79,34 69,58 69,82 C69,102 78,116 92,121 C98,123 104,124 110,124
           C116,124 122,123 128,121 C142,116 151,102 151,82 C151,58 141,34 110,34 Z"
        fill={skin}
      />
      <path d="M92,121 C98,123 122,123 128,121 C122,127 98,127 92,121 Z" fill={shade(skin, -18)} opacity="0.4" />
      <Face expr={expr} skin={skin} eyeColor={config.eyeColor} browColor={browColor} />
      <HairFront style={config.hairStyle} color={config.hairColor} />
      <AccessoryLayer config={config} />
    </svg>
  )
}
