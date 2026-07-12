import type { AvatarConfig, Expression } from './types'

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

function HairBack({ style, color }: { style: AvatarConfig['hairStyle']; color: string }) {
  const dark = shade(color, -25)
  switch (style) {
    case 'long':
      return (
        <g>
          <path
            d={`M110,30 C58,30 40,80 42,130 C44,185 52,230 60,252 C70,240 76,210 76,180
                C70,150 72,120 84,100 L136,100 C148,120 150,150 144,180 C144,210 150,240 160,252
                C168,230 176,185 178,130 C180,80 162,30 110,30 Z`}
            fill={color}
          />
          <path d="M60,252 C70,240 76,210 76,180 L84,220 Z" fill={dark} opacity="0.35" />
          <path d="M160,252 C150,240 144,210 144,180 L136,220 Z" fill={dark} opacity="0.35" />
        </g>
      )
    case 'couettes':
      return (
        <g>
          <circle cx="110" cy="80" r="66" fill={color} />
          <path d="M52,90 C30,100 26,150 40,195 C50,180 52,160 50,140 C60,130 58,105 52,90 Z" fill={color} />
          <path d="M168,90 C190,100 194,150 180,195 C170,180 168,160 170,140 C160,130 162,105 168,90 Z" fill={color} />
          <circle cx="49" cy="93" r="9" fill={dark} opacity="0.5" />
          <circle cx="171" cy="93" r="9" fill={dark} opacity="0.5" />
        </g>
      )
    case 'carre':
      return (
        <g>
          <path
            d={`M110,28 C60,28 42,70 44,120 C45,155 52,172 62,178 C58,150 60,120 70,100
                L150,100 C160,120 162,150 158,178 C168,172 175,155 176,120 C178,70 160,28 110,28 Z`}
            fill={color}
          />
        </g>
      )
    case 'chignon':
      return (
        <g>
          <circle cx="110" cy="26" r="24" fill={color} />
          <circle cx="110" cy="26" r="24" fill={dark} opacity="0.2" />
          <circle cx="110" cy="80" r="64" fill={color} />
        </g>
      )
  }
}

function HairFront({ style, color }: { style: AvatarConfig['hairStyle']; color: string }) {
  const light = shade(color, 22)
  const fringe = (
    <path
      d={`M110,34 C66,34 50,66 50,96 C56,90 60,78 64,70 C68,80 74,86 80,74 C86,86 96,90 102,76
          C108,90 118,90 124,76 C130,88 138,86 144,72 C150,84 154,90 158,96 C170,96 154,34 110,34 Z`}
      fill={color}
    />
  )
  const sides = (
    <g>
      <path d="M50,92 C46,110 48,128 54,140 C60,128 62,110 58,94 Z" fill={color} />
      <path d="M170,92 C174,110 172,128 166,140 C160,128 158,110 162,94 Z" fill={color} />
    </g>
  )
  return (
    <g>
      {fringe}
      {style !== 'couettes' && sides}
      <path d="M78,44 C90,38 116,36 132,42" stroke={light} strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.7" />
    </g>
  )
}

function Face({ expr, skin }: { expr: Expression; skin: string }) {
  const ink = '#4a3540'
  const blushColor = '#ff9db8'
  const eyeL = { x: 85, y: 104 }
  const eyeR = { x: 135, y: 104 }

  const openEye = (x: number, y: number, r = 1) => (
    <g>
      <ellipse cx={x} cy={y} rx={8.5 * r} ry={11.5 * r} fill={ink} />
      <circle cx={x - 2.5} cy={y - 4} r={3.2} fill="#fff" />
      <circle cx={x + 3} cy={y + 3.5} r={1.6} fill="#fff" opacity="0.8" />
    </g>
  )
  const blush = (strong = false) => (
    <g opacity={strong ? 0.85 : 0.45}>
      <ellipse cx="70" cy="122" rx="9" ry="5" fill={blushColor} />
      <ellipse cx="150" cy="122" rx="9" ry="5" fill={blushColor} />
    </g>
  )

  let eyes: JSX.Element
  let brows: JSX.Element | null = null
  let mouth: JSX.Element
  let extra: JSX.Element | null = null

  switch (expr) {
    case 'joie':
      eyes = (
        <g stroke={ink} strokeWidth="4" fill="none" strokeLinecap="round">
          <path d={`M${eyeL.x - 9},${eyeL.y + 2} q9,-12 18,0`} />
          <path d={`M${eyeR.x - 9},${eyeR.y + 2} q9,-12 18,0`} />
        </g>
      )
      mouth = <path d="M100,128 q10,12 20,0 q-10,4 -20,0 Z" fill="#c9556e" />
      extra = blush()
      break
    case 'gene':
      eyes = (
        <g>
          {openEye(eyeL.x, eyeL.y, 0.9)}
          {openEye(eyeR.x, eyeR.y, 0.9)}
        </g>
      )
      mouth = (
        <path d="M100,132 q5,5 10,0 q5,-5 10,0" stroke="#c9556e" strokeWidth="3" fill="none" strokeLinecap="round" />
      )
      extra = blush(true)
      break
    case 'surprise':
      eyes = (
        <g>
          <circle cx={eyeL.x} cy={eyeL.y} r="10" fill="#fff" stroke={ink} strokeWidth="2.5" />
          <circle cx={eyeL.x} cy={eyeL.y} r="4" fill={ink} />
          <circle cx={eyeR.x} cy={eyeR.y} r="10" fill="#fff" stroke={ink} strokeWidth="2.5" />
          <circle cx={eyeR.x} cy={eyeR.y} r="4" fill={ink} />
        </g>
      )
      brows = (
        <g stroke={ink} strokeWidth="3.5" fill="none" strokeLinecap="round">
          <path d={`M${eyeL.x - 9},${eyeL.y - 22} q9,-6 18,-1`} />
          <path d={`M${eyeR.x - 9},${eyeR.y - 23} q9,-5 18,1`} />
        </g>
      )
      mouth = <ellipse cx="110" cy="132" rx="6" ry="8" fill="#c9556e" />
      break
    case 'triste':
      eyes = (
        <g>
          {openEye(eyeL.x, eyeL.y, 0.85)}
          {openEye(eyeR.x, eyeR.y, 0.85)}
        </g>
      )
      brows = (
        <g stroke={ink} strokeWidth="3.5" fill="none" strokeLinecap="round">
          <path d={`M${eyeL.x - 8},${eyeL.y - 20} q10,-4 16,2`} />
          <path d={`M${eyeR.x - 8},${eyeR.y - 18} q6,-6 16,-2`} />
        </g>
      )
      mouth = <path d="M101,134 q9,-8 18,0" stroke="#c9556e" strokeWidth="3" fill="none" strokeLinecap="round" />
      extra = <ellipse cx={eyeR.x + 12} cy={eyeR.y + 14} rx="3.5" ry="5.5" fill="#9ed4f5" />
      break
    case 'colere':
      eyes = (
        <g>
          {openEye(eyeL.x, eyeL.y, 0.85)}
          {openEye(eyeR.x, eyeR.y, 0.85)}
        </g>
      )
      brows = (
        <g stroke={ink} strokeWidth="4" fill="none" strokeLinecap="round">
          <path d={`M${eyeL.x - 9},${eyeL.y - 24} L${eyeL.x + 9},${eyeL.y - 16}`} />
          <path d={`M${eyeR.x + 9},${eyeR.y - 24} L${eyeR.x - 9},${eyeR.y - 16}`} />
        </g>
      )
      mouth = <path d="M101,134 q9,-7 18,0" stroke="#c9556e" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      extra = (
        <path d="M158,66 l7,-7 M162,74 l9,-3 M152,61 l3,-9" stroke="#e35d7c" strokeWidth="3" strokeLinecap="round" />
      )
      break
    default:
      eyes = (
        <g>
          {openEye(eyeL.x, eyeL.y)}
          {openEye(eyeR.x, eyeR.y)}
        </g>
      )
      mouth = <path d="M101,130 q9,8 18,0" stroke="#c9556e" strokeWidth="3" fill="none" strokeLinecap="round" />
      extra = blush()
  }

  return (
    <g>
      <ellipse cx="110" cy="150" rx="14" ry="6" fill={shade(skin, -18)} opacity="0.35" />
      {extra}
      {brows}
      {eyes}
      {mouth}
      <path d="M108,116 q2,3 4,0" stroke={shade(skin, -30)} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5" />
    </g>
  )
}

function OutfitLayer({ config }: { config: AvatarConfig }) {
  const c1 = config.outfitColor
  const c2 = config.outfitColor2
  const d1 = shade(c1, -25)
  switch (config.outfit) {
    case 'uniforme':
      return (
        <g>
          <path d="M88,168 L132,168 L136,214 L84,214 Z" fill={c2} />
          <path d="M88,168 L110,168 L110,196 L84,206 Z M132,168 L110,168 L110,196 L136,206 Z" fill={c2} />
          <path d="M88,166 L110,182 L132,166 L134,178 L110,192 L86,178 Z" fill={c1} />
          <path d="M104,186 l6,-5 l6,5 l-6,7 Z" fill="#e35d7c" />
          <path d="M80,212 L140,212 L148,244 L72,244 Z" fill={c1} />
          <path d="M84,212 L92,244 M97,212 L102,244 M110,212 L110,244 M123,212 L118,244 M136,212 L128,244" stroke={d1} strokeWidth="2.5" opacity="0.6" />
        </g>
      )
    case 'sweat':
      return (
        <g>
          <path d="M84,170 C84,162 136,162 136,170 L140,224 C140,232 80,232 80,224 Z" fill={c1} />
          <path d="M92,168 C98,178 122,178 128,168" stroke={d1} strokeWidth="4" fill="none" strokeLinecap="round" />
          <rect x="96" y="200" width="28" height="16" rx="6" fill={d1} opacity="0.5" />
          <path d="M104,170 L104,182 M116,170 L116,182" stroke={c2} strokeWidth="4" strokeLinecap="round" />
          <path d="M82,228 L138,228 L142,252 L78,252 Z" fill={c2} />
        </g>
      )
    case 'etoile':
      return (
        <g>
          <path d="M90,168 L130,168 L134,206 L86,206 Z" fill={c1} />
          <path d="M86,204 C70,238 74,252 76,258 L144,258 C146,252 150,238 134,204 Z" fill={c2} />
          <path d="M86,204 C70,238 74,252 76,258 L144,258 C146,252 150,238 134,204 Z" fill="url(#none)" opacity="0" />
          <path d="M110,222 l4,9 10,1 -7,7 2,10 -9,-5 -9,5 2,-10 -7,-7 10,-1 Z" fill="#ffe28a" />
          <circle cx="90" cy="240" r="2.5" fill="#fff" opacity="0.9" />
          <circle cx="128" cy="232" r="2" fill="#fff" opacity="0.9" />
          <circle cx="100" cy="250" r="2" fill="#fff" opacity="0.7" />
          <path d="M90,168 L130,168 L131,176 L89,176 Z" fill="#ffe28a" />
        </g>
      )
    case 'pop':
      return (
        <g>
          <path d="M92,168 L128,168 L132,212 L88,212 Z" fill={c2} />
          <path d="M110,180 l3,7 8,1 -6,5 2,8 -7,-4 -7,4 2,-8 -6,-5 8,-1 Z" fill={c1} />
          <path d="M84,166 L96,166 L94,224 L80,220 Z M136,166 L124,166 L126,224 L140,220 Z" fill={c1} />
          <path d="M86,210 L134,210 L140,238 L80,238 Z" fill={d1} />
          <path d="M80,238 L140,238" stroke={c1} strokeWidth="5" strokeLinecap="round" />
        </g>
      )
    case 'bal':
      return (
        <g>
          <path d="M92,168 L128,168 L132,204 L88,204 Z" fill={c1} />
          <path d="M92,168 Q110,178 128,168 L128,176 Q110,186 92,176 Z" fill={shade(c1, 30)} />
          <path d="M88,202 C56,250 52,272 54,282 L166,282 C168,272 164,250 132,202 Z" fill={c2} />
          <path d="M88,202 C80,216 70,240 64,262 M132,202 C140,216 150,240 156,262" stroke={shade(c2, -25)} strokeWidth="2.5" fill="none" opacity="0.5" />
          <circle cx="80" cy="252" r="3" fill="#fff" opacity="0.85" />
          <circle cx="118" cy="238" r="2.5" fill="#fff" opacity="0.85" />
          <circle cx="142" cy="262" r="3" fill="#fff" opacity="0.85" />
          <circle cx="100" cy="268" r="2.5" fill="#fff" opacity="0.7" />
          <path d="M104,200 l6,-5 l6,5 l-6,6 Z" fill="#ffe28a" />
        </g>
      )
    case 'aventure':
      return (
        <g>
          <path d="M86,168 C80,172 76,190 78,206 L86,206 Z M134,168 C140,172 144,190 142,206 L134,206 Z" fill={c2} />
          <path d="M88,168 L132,168 L136,230 L84,230 Z" fill={c1} />
          <path d="M84,206 L136,206 L136,216 L84,216 Z" fill="#7a5638" />
          <rect x="104" y="205" width="12" height="12" rx="2" fill="#f2b33d" />
          <path d="M86,228 L134,228 L138,248 L82,248 Z" fill={c2} />
        </g>
      )
  }
}

function AccessoryLayer({ config }: { config: AvatarConfig }) {
  const c = config.outfitColor
  switch (config.accessory) {
    case 'noeud':
      return (
        <g transform="translate(152,48) rotate(18)">
          <path d="M0,0 L-18,-10 L-16,10 Z" fill={c} />
          <path d="M0,0 L18,-10 L16,10 Z" fill={c} />
          <circle cx="0" cy="0" r="5" fill={shade(c, -30)} />
        </g>
      )
    case 'diademe':
      return (
        <g>
          <path d="M84,38 Q110,26 136,38 L132,46 Q110,36 88,46 Z" fill="#f2c94c" />
          <path d="M108,26 l3,-8 3,8 Z M92,32 l2,-7 3,7 Z M122,32 l3,-7 2,7 Z" fill="#f2c94c" />
          <circle cx="110" cy="34" r="3.5" fill="#e35d7c" />
        </g>
      )
    case 'lunettes':
      return (
        <g stroke="#4a3540" strokeWidth="3" fill="rgba(255,255,255,0.25)">
          <circle cx="85" cy="104" r="14" />
          <circle cx="135" cy="104" r="14" />
          <path d="M99,104 L121,104" fill="none" />
        </g>
      )
    case 'etoile':
      return <path d="M62,52 l4,9 10,1 -7,7 2,10 -9,-5 -9,5 2,-10 -7,-7 10,-1 Z" fill="#f2c94c" />
    default:
      return null
  }
}

export function AvatarView({ config, expr = 'neutre', width = 180, className }: Props) {
  const skin = config.skin
  const skinDark = shade(skin, -20)
  return (
    <svg viewBox="0 0 220 300" width={width} className={className} role="img" aria-label="avatar">
      <HairBack style={config.hairStyle} color={config.hairColor} />
      {/* jambes */}
      <path d="M96,224 L96,280 Q96,286 102,286 L104,286 Q108,286 108,280 L108,224 Z" fill={skin} />
      <path d="M112,224 L112,280 Q112,286 118,286 L120,286 Q124,286 124,280 L124,224 Z" fill={skin} />
      <ellipse cx="102" cy="288" rx="10" ry="5" fill="#8a5f78" />
      <ellipse cx="118" cy="288" rx="10" ry="5" fill="#8a5f78" />
      {/* bras */}
      <path d="M88,172 Q72,196 80,226" stroke={skin} strokeWidth="13" fill="none" strokeLinecap="round" />
      <path d="M132,172 Q148,196 140,226" stroke={skin} strokeWidth="13" fill="none" strokeLinecap="round" />
      {/* cou + torse */}
      <rect x="101" y="146" width="18" height="24" rx="8" fill={skinDark} />
      <path d="M90,166 L130,166 L134,226 L86,226 Z" fill={skin} />
      {/* tenue */}
      <OutfitLayer config={config} />
      {/* tête */}
      <circle cx="110" cy="92" r="60" fill={skin} />
      <Face expr={expr} skin={skin} />
      <HairFront style={config.hairStyle} color={config.hairColor} />
      <AccessoryLayer config={config} />
    </svg>
  )
}
