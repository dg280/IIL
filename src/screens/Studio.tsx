import { AvatarView } from '../avatar/AvatarView'
import { UNIVERSES } from '../universes'
import type { Roster } from '../storage'
import { deleteStory, getEndingsFound, getStories } from '../storage'
import { demoStory } from '../data/demoStory'
import type { AuthoredStory } from '../builder/types'

interface Props {
  playerName: string
  roster: Roster
  onPlayDemo: () => void
  onPlayStory: (story: AuthoredStory) => void
  onWeave: (story: AuthoredStory) => void
  onNewStory: () => void
  onEditCharacter: (id: string) => void
  onNewCharacter: () => void
  onRefresh: () => void
}

const LOCKED = [
  { emoji: '🪄', title: "L'Atelier magique", desc: 'Invente tenues et décors avec la magie', version: 'v0.3' },
  { emoji: '💌', title: 'Partage', desc: 'Envoie tes histoires à tes copines', version: 'v0.4' },
  { emoji: '🏘️', title: 'Le Village', desc: 'Retrouve les avatars de tes amies', version: 'v2' },
]

export function Studio({ playerName, roster, onPlayDemo, onPlayStory, onWeave, onNewStory, onEditCharacter, onNewCharacter, onRefresh }: Props) {
  const foundDemo = getEndingsFound(demoStory.meta.id)
  const uniDemo = UNIVERSES.find((u) => u.id === demoStory.meta.universe)
  const stories = Object.values(getStories())

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
        <p className="subtitle">Crée tes personnages, tisse tes histoires, découvre toutes les fins !</p>
      </header>

      <main className="studio-grid">
        <section className="card">
          <div className="stories-head">
            <h2>📚 Mes histoires</h2>
            <button className="btn btn-primary" onClick={onNewStory}>＋ Nouvelle histoire</button>
          </div>
          <div className="stories-row">
            <div className="story-tile" style={{ borderColor: uniDemo?.color }}>
              <span className="story-uni" style={{ background: uniDemo?.color }}>
                {uniDemo?.emoji} {uniDemo?.name}
              </span>
              <strong>{demoStory.meta.title}</strong>
              <small>Histoire d'exemple · {foundDemo.length}/{demoStory.endings.length} fins {demoStory.endings.map((e) => (foundDemo.includes(e.id) ? e.emoji : '❔')).join(' ')}</small>
              <div className="story-actions">
                <button className="btn btn-primary" onClick={onPlayDemo}>▶ Jouer</button>
              </div>
            </div>
            {stories.map((s) => {
              const uni = UNIVERSES.find((u) => u.id === s.universe)
              const found = getEndingsFound(s.id)
              const finCount = Object.values(s.scenes).filter((sc) => sc.outcome.kind === 'fin').length
              return (
                <div key={s.id} className="story-tile" style={{ borderColor: uni?.color }}>
                  <span className="story-uni" style={{ background: uni?.color }}>
                    {uni?.emoji} {uni?.name}
                  </span>
                  <strong>{s.title}</strong>
                  <small>
                    {Object.keys(s.scenes).length} scènes · {finCount} fin{finCount > 1 ? 's' : ''} · {found.length} trouvée{found.length > 1 ? 's' : ''}
                  </small>
                  <div className="story-actions">
                    <button className="btn btn-primary" onClick={() => onPlayStory(s)}>▶ Jouer</button>
                    <button className="btn btn-ghost" onClick={() => onWeave(s)}>🕸️ Tisser</button>
                    <button
                      className="btn btn-ghost"
                      title="Supprimer"
                      onClick={() => {
                        if (window.confirm(`Supprimer « ${s.title} » ? Cette histoire sera perdue.`)) {
                          deleteStory(s.id)
                          onRefresh()
                        }
                      }}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="card characters-card">
          <h2>🎭 Les personnages</h2>
          <p className="hint">Touche un personnage pour changer sa coiffure, sa tenue, tout !</p>
          <div className="char-row">
            {Object.entries(roster)
              .sort(([a], [b]) => (a === 'self' ? -1 : b === 'self' ? 1 : 0))
              .map(([id, entry]) => (
                <button key={id} className="char-tile" onClick={() => onEditCharacter(id)}>
                  <AvatarView config={entry.config} expr={id === 'self' ? 'joie' : 'neutre'} width="100%" />
                  <span className="char-name">{id === 'self' ? `${entry.name} (toi !)` : entry.name}</span>
                  <span className="char-edit">✏️ Personnaliser</span>
                </button>
              ))}
            <button className="char-tile char-new" onClick={onNewCharacter}>
              <span className="char-new-plus">＋</span>
              <span className="char-name">Nouveau personnage</span>
              <span className="char-edit">Invente quelqu'un !</span>
            </button>
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
