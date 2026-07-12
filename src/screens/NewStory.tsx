import { useState } from 'react'
import { UNIVERSES } from '../universes'
import type { UniverseId } from '../universes'
import { TEMPLATES } from '../builder/types'
import type { TemplateId } from '../builder/types'
import { AvatarView } from '../avatar/AvatarView'
import type { Roster } from '../storage'

interface Props {
  roster: Roster
  onCreate: (title: string, universe: UniverseId, template: TemplateId, characters: string[]) => void
  onCancel: () => void
}

export function NewStory({ roster, onCreate, onCancel }: Props) {
  const [title, setTitle] = useState('')
  const [universe, setUniverse] = useState<UniverseId>('sakura')
  const [template, setTemplate] = useState<TemplateId>('secret')
  const available = Object.keys(roster).filter((id) => id !== 'self')
  const [chars, setChars] = useState<string[]>(available.slice(0, 2))

  return (
    <div className="newstory">
      <div className="card newstory-card">
        <header className="maker-header">
          <button className="btn btn-ghost" onClick={onCancel}>← Retour</button>
          <h1>✨ Nouvelle histoire</h1>
        </header>

        <h3>Son titre</h3>
        <input className="name-input" value={title} maxLength={40} placeholder="Le titre de ton histoire…" onChange={(e) => setTitle(e.target.value)} />

        <h3>Son univers</h3>
        <div className="uni-row">
          {UNIVERSES.map((u) => (
            <button key={u.id} className={universe === u.id ? 'uni-tile uni-select active' : 'uni-tile uni-select'} style={{ borderColor: u.color }} onClick={() => setUniverse(u.id)}>
              <span className="uni-emoji">{u.emoji}</span>
              <strong>{u.name}</strong>
              <small>{u.tagline}</small>
            </button>
          ))}
        </div>

        <h3>Son point de départ</h3>
        <div className="uni-row">
          {TEMPLATES.map((t) => (
            <button key={t.id} className={template === t.id ? 'uni-tile uni-select active' : 'uni-tile uni-select'} style={{ borderColor: '#c9a8f0' }} onClick={() => setTemplate(t.id)}>
              <span className="uni-emoji">{t.emoji}</span>
              <strong>{t.label}</strong>
              <small>{t.desc}</small>
            </button>
          ))}
        </div>

        <h3>Ses personnages (en plus de toi)</h3>
        <div className="char-row">
          {available.map((id) => {
            const entry = roster[id]
            const on = chars.includes(id)
            return (
              <button key={id} className={on ? 'char-tile char-select on' : 'char-tile char-select'} onClick={() => setChars(on ? chars.filter((c) => c !== id) : [...chars, id])}>
                <AvatarView config={entry.config} expr={on ? 'joie' : 'neutre'} width="100%" />
                <span className="char-name">{entry.name}</span>
                <span className="char-edit">{on ? '✓ dans l’histoire' : '＋ ajouter'}</span>
              </button>
            )
          })}
        </div>

        <button className="btn btn-primary btn-big btn-save" disabled={!title.trim()} onClick={() => onCreate(title.trim(), universe, template, chars)}>
          🕸️ Tisser cette histoire !
        </button>
      </div>
    </div>
  )
}
