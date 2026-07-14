import { useState } from 'react'
import type { CSSProperties } from 'react'
import { AvatarMaker } from './AvatarMaker'
import { defaultAvatar } from '../avatar/types'
import type { AvatarConfig } from '../avatar/types'
import { UNIVERSES } from '../universes'
import type { UniverseId } from '../universes'
import { Background } from '../universes/Background'
import { defaultBg } from '../builder/types'
import { CHANGELOG } from '../data/changelog'
import { BUILD_ID, isDebug, setDebug } from '../debug'

interface Props {
  onDone: (name: string, config: AvatarConfig, universe: UniverseId) => void
}

// pitch narratif court, en plus du décor (univers graphique) et du tagline
const UNIVERSE_PITCH: Record<UniverseId, string> = {
  sakura: 'Un lycée au printemps : nouvelles amies, clubs, confidences et le grand festival sous les pétales.',
  scene: 'Les projecteurs s’allument : ton groupe, les répètes, le trac et le premier concert.',
  royaumes: 'Un château plein de secrets : bals masqués, invitations mystérieuses et cœurs qui hésitent.',
}

export function Onboarding({ onDone }: Props) {
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [name, setName] = useState('')
  const [universe, setUniverse] = useState<UniverseId | null>(null)
  const [debug, setDebugState] = useState(isDebug())
  const latest = CHANGELOG[0]

  if (step === 0) {
    return (
      <div className="onboarding">
        <div className="card onboarding-card">
          <div className="onboarding-logo" aria-hidden>❦</div>
          <h1>Célestine</h1>
          <p className="subtitle">Ton studio d'histoires à choix</p>
          <p>Ton studio pour créer, jouer et bientôt partager tes propres histoires à choix.</p>
          <label className="onboarding-label" htmlFor="player-name">
            Comment t'appelles-tu ?
          </label>
          <input
            id="player-name"
            className="name-input"
            value={name}
            maxLength={16}
            placeholder="Ton prénom…"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && name.trim() && setStep(1)}
          />
          <button className="btn btn-primary btn-big" disabled={!name.trim()} onClick={() => setStep(1)}>
            C'est parti ! ✨
          </button>

          <div className="changelog">
            <div className="changelog-head">✨ Nouveautés — v{latest.v} <small>({latest.date})</small></div>
            <ul>
              {latest.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>

          <label className="debug-toggle">
            <input
              type="checkbox"
              checked={debug}
              onChange={(e) => { setDebug(e.target.checked); setDebugState(e.target.checked) }}
            />
            🐞 Mode debug (remontées de bugs, crédits illimités)
          </label>
          <div className="build-tag">v{latest.v} · {BUILD_ID}</div>
        </div>
      </div>
    )
  }

  if (step === 1) {
    return (
      <div className="onboarding">
        <div className="card onboarding-card onboarding-univers">
          <h1>Dans quel monde ?</h1>
          <p className="subtitle">
            Choisis l’ambiance de tes premières histoires, {name.trim()}. Tu pourras en explorer d’autres plus tard !
          </p>
          <p className="univers-hint">👆 Touche un monde pour y entrer tout de suite</p>
          <div className="univers-grid">
            {UNIVERSES.map((u) => (
              <button
                key={u.id}
                className="univers-card"
                style={{ '--u-color': u.color } as CSSProperties}
                onClick={() => { setUniverse(u.id); setStep(2) }}
              >
                <div className="univers-preview">
                  <Background id={defaultBg(u.id)} />
                  <span className="univers-emoji" aria-hidden>{u.emoji}</span>
                </div>
                <div className="univers-accent" aria-hidden />
                <strong>{u.name}</strong>
                <span className="univers-tagline">{u.tagline}</span>
                <span className="univers-pitch">{UNIVERSE_PITCH[u.id]}</span>
                <span className="univers-go">Entrer ici ✨</span>
              </button>
            ))}
          </div>
          <div className="onboarding-nav">
            <button className="btn btn-ghost" onClick={() => setStep(0)}>← Retour</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <AvatarMaker
      title={`À quoi ressembles-tu, ${name.trim()} ?`}
      initialName={name.trim()}
      initialConfig={defaultAvatar()}
      universe={universe ?? 'sakura'}
      nameEditable={false}
      saveLabel="✨ C'est moi !"
      onSave={(_n, config) => onDone(name.trim(), config, universe ?? 'sakura')}
      onCancel={() => setStep(1)}
    />
  )
}
