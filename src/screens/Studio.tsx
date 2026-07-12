import { AvatarView } from '../avatar/AvatarView'
import { UNIVERSES } from '../universes'
import type { Roster } from '../storage'
import { getEndingsFound } from '../storage'
import { demoStory } from '../data/demoStory'

interface Props {
  playerName: string
  roster: Roster
  onPlay: () => void
  onEditCharacter: (id: string) => void
}

const LOCKED = [
  { emoji: '🕸️', title: 'La Tisseuse', desc: 'Crée tes propres histoires à choix', version: 'v0.2' },
  { emoji: '🪄', title: "L'Atelier magique", desc: 'Invente tenues et décors avec la magie', version: 'v0.3' },
  { emoji: '💌', title: 'Partage', desc: 'Envoie tes histoires à tes copines', version: 'v0.4' },
]

export function Studio({ playerName, roster, onPlay, onEditCharacter }: Props) {
  const found = getEndingsFound(demoStory.meta.id)
  const uni = UNIVERSES.find((u) => u.id === demoStory.meta.universe)

  return (
    <div className="studio">
      <div className="petals" aria-hidden>
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className="petal" style={{ left: `${(i * 8.5) % 100}%`, animationDelay: `${i * 1.7}s`, animationDuration: `${9 + (i % 5) * 2}s` }} />
        ))}
      </div>

      <header className="studio-header">
        <h1>
          ✨ Le studio de <span className="accent">{playerName}</span>
        </h1>
        <p className="subtitle">Crée tes personnages, joue tes histoires, découvre toutes les fins !</p>
      </header>

      <main className="studio-grid">
        <section className="card story-card">
          <div className="story-banner" style={{ background: `linear-gradient(135deg, ${uni?.color}33, ${uni?.color}0d)` }}>
            <span className="story-uni" style={{ background: uni?.color }}>
              {uni?.emoji} {uni?.name}
            </span>
            <h2>{demoStory.meta.title}</h2>
            <p>{demoStory.meta.description}</p>
            <div className="story-meta">
              <span className="endings-badge">
                {found.length} / {demoStory.endings.length} fins{' '}
                {demoStory.endings.map((e) => (found.includes(e.id) ? e.emoji : '❔')).join(' ')}
              </span>
            </div>
            <button className="btn btn-primary btn-big" onClick={onPlay}>
              ▶ Jouer
            </button>
          </div>
        </section>

        <section className="card characters-card">
          <h2>🎭 Les personnages</h2>
          <p className="hint">Touche un personnage pour changer sa coiffure, sa tenue, tout !</p>
          <div className="char-row">
            {(['self', 'yuki', 'hana'] as const).map((id) => {
              const entry = roster[id]
              if (!entry) return null
              return (
                <button key={id} className="char-tile" onClick={() => onEditCharacter(id)}>
                  <AvatarView config={entry.config} expr={id === 'self' ? 'joie' : 'neutre'} width="100%" />
                  <span className="char-name">{id === 'self' ? `${entry.name} (toi !)` : entry.name}</span>
                  <span className="char-edit">✏️ Personnaliser</span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="card universes-card">
          <h2>🗺️ Les univers</h2>
          <div className="uni-row">
            {UNIVERSES.map((u) => (
              <div key={u.id} className="uni-tile" style={{ borderColor: u.color }}>
                <span className="uni-emoji">{u.emoji}</span>
                <strong>{u.name}</strong>
                <small>{u.tagline}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="card locked-card">
          <h2>🔜 Bientôt dans ton studio</h2>
          <div className="locked-row">
            {LOCKED.map((l) => (
              <div key={l.title} className="locked-tile">
                <span className="locked-emoji">{l.emoji}</span>
                <strong>{l.title}</strong>
                <small>{l.desc}</small>
                <span className="locked-badge">🔒 {l.version}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
