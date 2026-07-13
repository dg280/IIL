/** Silhouette générique ombrée : placeholder tant qu'un portrait/décor IA n'existe pas. */
export function Silhouette({ kind }: { kind: 'perso' | 'decor' }) {
  if (kind === 'perso') {
    return (
      <svg viewBox="0 0 100 130" className="silhouette" aria-hidden>
        <defs>
          <linearGradient id="silP" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e9d8ff" />
            <stop offset="1" stopColor="#f7c9de" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="42" r="24" fill="url(#silP)" />
        <path d="M12 130 Q12 82 50 82 Q88 82 88 130 Z" fill="url(#silP)" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 100 75" className="silhouette" aria-hidden>
      <defs>
        <linearGradient id="silD" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9d8ff" />
          <stop offset="1" stopColor="#cfe6d2" />
        </linearGradient>
      </defs>
      <rect width="100" height="75" fill="url(#silD)" />
      <circle cx="74" cy="22" r="10" fill="#fff" opacity="0.6" />
      <path d="M0 62 Q26 40 46 56 Q64 70 100 46 L100 75 L0 75 Z" fill="#fff" opacity="0.45" />
      <path d="M0 70 Q30 54 54 66 Q76 76 100 60 L100 75 L0 75 Z" fill="#fff" opacity="0.35" />
    </svg>
  )
}
