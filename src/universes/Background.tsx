interface Props {
  id: string | null
}

const petals = Array.from({ length: 14 }, (_, i) => ({
  cx: (i * 61) % 800,
  cy: (i * 137) % 400,
  r: 4 + (i % 3) * 2,
  o: 0.5 + (i % 4) * 0.12,
}))

function CourSakura() {
  return (
    <g>
      <rect width="800" height="450" fill="url(#skyDay)" />
      <ellipse cx="150" cy="70" rx="70" ry="22" fill="#fff" opacity="0.85" />
      <ellipse cx="620" cy="110" rx="90" ry="26" fill="#fff" opacity="0.75" />
      <rect y="360" width="800" height="90" fill="#9fce7e" />
      <rect y="352" width="800" height="12" fill="#8bbf6c" />
      <path d="M640,360 C630,290 650,240 645,190 L672,190 C668,240 688,290 678,360 Z" fill="#7a5638" />
      <circle cx="655" cy="150" r="85" fill="#f9b8d4" />
      <circle cx="580" cy="185" r="55" fill="#f6a8c8" />
      <circle cx="735" cy="185" r="52" fill="#fbc9dd" />
      <circle cx="660" cy="105" r="48" fill="#fbc9dd" />
      {petals.map((p, i) => (
        <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill="#f9b8d4" opacity={p.o} />
      ))}
      <rect x="60" y="220" width="220" height="140" fill="#f3e6d8" />
      <rect x="60" y="205" width="220" height="18" fill="#d97f6a" />
      <rect x="85" y="245" width="45" height="55" fill="#bde0f0" stroke="#fff" strokeWidth="4" />
      <rect x="155" y="245" width="45" height="55" fill="#bde0f0" stroke="#fff" strokeWidth="4" />
      <rect x="225" y="245" width="40" height="55" fill="#bde0f0" stroke="#fff" strokeWidth="4" />
    </g>
  )
}

function SalleClasse() {
  return (
    <g>
      <rect width="800" height="450" fill="#f3ead9" />
      <rect y="330" width="800" height="120" fill="#c8a06c" />
      <rect y="322" width="800" height="10" fill="#a9835a" />
      <rect x="60" y="60" width="180" height="130" fill="#bde0f0" stroke="#fff" strokeWidth="8" />
      <rect x="300" y="60" width="180" height="130" fill="#bde0f0" stroke="#fff" strokeWidth="8" />
      <path d="M60,60 l180,130 M300,60 l180,130" stroke="#fff" strokeWidth="3" opacity="0.5" />
      <rect x="550" y="70" width="200" height="120" rx="6" fill="#3f7d5a" stroke="#8a6a4a" strokeWidth="8" />
      <path d="M570,100 h60 M570,120 h100 M570,140 h80" stroke="#e8f5ee" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
      <rect x="80" y="280" width="150" height="14" fill="#8a6a4a" />
      <rect x="90" y="294" width="10" height="60" fill="#6f543a" />
      <rect x="210" y="294" width="10" height="60" fill="#6f543a" />
      <rect x="420" y="280" width="150" height="14" fill="#8a6a4a" />
      <rect x="430" y="294" width="10" height="60" fill="#6f543a" />
      <rect x="550" y="294" width="10" height="60" fill="#6f543a" />
    </g>
  )
}

function Toit() {
  return (
    <g>
      <rect width="800" height="450" fill="url(#skySunset)" />
      <circle cx="620" cy="180" r="55" fill="#ffd9a0" />
      <g fill="#8a7f9e" opacity="0.7">
        <rect x="0" y="230" width="60" height="80" />
        <rect x="70" y="250" width="45" height="60" />
        <rect x="130" y="235" width="55" height="75" />
        <rect x="200" y="255" width="40" height="55" />
        <rect x="700" y="245" width="60" height="65" />
        <rect x="640" y="260" width="50" height="50" />
      </g>
      <rect y="305" width="800" height="145" fill="#b9c0cf" />
      <rect y="300" width="800" height="10" fill="#9aa2b5" />
      <g stroke="#7e8698" strokeWidth="5">
        <path d="M0,305 L0,190 M100,305 L100,190 M200,305 L200,190 M300,305 L300,190 M400,305 L400,190 M500,305 L500,190 M600,305 L600,190 M700,305 L700,190 M800,305 L800,190" />
        <path d="M0,200 L800,200 M0,240 L800,240 M0,280 L800,280" strokeWidth="3" />
      </g>
    </g>
  )
}

function Chambre() {
  return (
    <g>
      <rect width="800" height="450" fill="#fbeef4" />
      <rect y="340" width="800" height="110" fill="#e8cba8" />
      <rect y="334" width="800" height="10" fill="#d4b28e" />
      <rect x="90" y="70" width="170" height="150" fill="#cfe8f7" stroke="#fff" strokeWidth="10" />
      <path d="M90,70 l170,150" stroke="#fff" strokeWidth="4" opacity="0.6" />
      <path d="M80,60 h190 v14 h-190 Z" fill="#f6a8c8" />
      <path d="M96,74 v150 h24 v-150 Z M250,74 v150 h-24 v-150 Z" fill="#f9c3da" opacity="0.9" />
      <rect x="420" y="250" width="260" height="60" rx="12" fill="#f28fb4" />
      <rect x="420" y="290" width="260" height="60" rx="10" fill="#e07a9e" />
      <rect x="440" y="228" width="70" height="42" rx="14" fill="#fff" />
      <rect x="660" y="240" width="26" height="110" rx="6" fill="#c98aa8" />
      <rect x="120" y="260" width="120" height="80" rx="8" fill="#b98a63" />
      <rect x="130" y="250" width="100" height="14" rx="4" fill="#a97a54" />
      <circle cx="310" cy="140" r="34" fill="#ffe28a" opacity="0.9" />
      <path d="M310,106 l6,14 15,2 -11,10 3,15 -13,-8 -13,8 3,-15 -11,-10 15,-2 Z" fill="#f2c94c" />
    </g>
  )
}

function SceneConcert() {
  return (
    <g>
      <rect width="800" height="450" fill="#221a3a" />
      <path d="M120,0 L40,330 L260,330 Z" fill="#ffe28a" opacity="0.25" />
      <path d="M400,0 L310,330 L490,330 Z" fill="#f9b8d4" opacity="0.25" />
      <path d="M680,0 L560,330 L780,330 Z" fill="#9ed4f5" opacity="0.25" />
      <rect y="330" width="800" height="120" fill="#3a2d5e" />
      <rect y="322" width="800" height="12" fill="#4d3d7a" />
      {petals.map((p, i) => (
        <circle key={i} cx={p.cx} cy={(p.cy * 0.7) % 320} r={p.r * 0.5} fill={i % 2 ? '#ffe28a' : '#f9b8d4'} opacity={p.o} />
      ))}
      <circle cx="120" cy="20" r="14" fill="#544a7a" />
      <circle cx="400" cy="20" r="14" fill="#544a7a" />
      <circle cx="680" cy="20" r="14" fill="#544a7a" />
    </g>
  )
}

function SalleBal() {
  return (
    <g>
      <rect width="800" height="450" fill="#f5e3c8" />
      <rect y="350" width="800" height="100" fill="#d9b98a" />
      <path d="M0,350 h800" stroke="#c2a273" strokeWidth="8" />
      <g fill="#efd9b8" stroke="#d9b98a" strokeWidth="4">
        <rect x="60" y="80" width="46" height="270" />
        <rect x="694" y="80" width="46" height="270" />
      </g>
      <path d="M50,80 h66 v-16 h-66 Z M684,80 h66 v-16 h-66 Z" fill="#d9b98a" />
      <path d="M250,90 a60,60 0 0 1 120,0 l0,160 l-120,0 Z" fill="#fdf3e3" stroke="#d9b98a" strokeWidth="5" />
      <path d="M430,90 a60,60 0 0 1 120,0 l0,160 l-120,0 Z" fill="#fdf3e3" stroke="#d9b98a" strokeWidth="5" />
      <path d="M280,120 q30,40 0,110 M340,120 q-30,40 0,110" stroke="#e8cba8" strokeWidth="3" fill="none" />
      <g fill="#f2c94c">
        <path d="M396,30 l4,0 0,26 -4,0 Z" />
        <circle cx="398" cy="66" r="10" />
        <path d="M358,60 q40,26 80,0 l-6,14 q-34,20 -68,0 Z" />
        <circle cx="362" cy="70" r="5" />
        <circle cx="434" cy="70" r="5" />
        <circle cx="398" cy="82" r="5" />
      </g>
    </g>
  )
}

export function Background({ id }: Props) {
  let scene: JSX.Element
  switch (id) {
    case 'cour_sakura': scene = <CourSakura />; break
    case 'salle_classe': scene = <SalleClasse />; break
    case 'toit': scene = <Toit />; break
    case 'chambre': scene = <Chambre />; break
    case 'scene_concert': scene = <SceneConcert />; break
    case 'salle_bal': scene = <SalleBal />; break
    default:
      scene = <rect width="800" height="450" fill="url(#skyDay)" />
  }
  return (
    <svg viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice" className="bg-svg">
      <defs>
        <linearGradient id="skyDay" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a8d8f0" />
          <stop offset="1" stopColor="#e3f2fb" />
        </linearGradient>
        <linearGradient id="skySunset" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f9a86c" />
          <stop offset="0.6" stopColor="#f6c8a0" />
          <stop offset="1" stopColor="#f9e0c8" />
        </linearGradient>
      </defs>
      {scene}
    </svg>
  )
}

export const BACKGROUNDS: { id: string; label: string; universe: string }[] = [
  { id: 'cour_sakura', label: 'Cour aux cerisiers', universe: 'sakura' },
  { id: 'salle_classe', label: 'Salle de classe', universe: 'sakura' },
  { id: 'toit', label: "Toit de l'école", universe: 'sakura' },
  { id: 'chambre', label: 'Chambre', universe: 'sakura' },
  { id: 'scene_concert', label: 'Scène de concert', universe: 'scene' },
  { id: 'salle_bal', label: 'Salle de bal', universe: 'royaumes' },
]
