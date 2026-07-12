import { useState } from 'react'
import { AvatarMaker } from './AvatarMaker'
import { defaultAvatar } from '../avatar/types'
import type { AvatarConfig } from '../avatar/types'

interface Props {
  onDone: (name: string, config: AvatarConfig) => void
}

export function Onboarding({ onDone }: Props) {
  const [step, setStep] = useState<0 | 1>(0)
  const [name, setName] = useState('')

  if (step === 0) {
    return (
      <div className="onboarding">
        <div className="card onboarding-card">
          <div className="onboarding-logo">🌸</div>
          <h1>Bienvenue dans Célestine</h1>
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
        </div>
      </div>
    )
  }

  return (
    <AvatarMaker
      title={`À quoi ressembles-tu, ${name.trim()} ?`}
      initialName={name.trim()}
      initialConfig={defaultAvatar()}
      nameEditable={false}
      saveLabel="✨ C'est moi !"
      onSave={(_n, config) => onDone(name.trim(), config)}
    />
  )
}
