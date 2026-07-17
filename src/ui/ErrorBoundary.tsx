import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { hardReset } from '../pwa'

/**
 * Filet de sécurité de rendu : sans lui, un composant qui lève = écran blanc
 * définitif pour une enfant (aucun message, aucune issue de secours). Ici :
 * message doux de Plume + recharger + vider le cache (état corrompu).
 * Les données locales ne sont PAS touchées.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // journal console uniquement (pas de télémétrie) — utile en mode debug
    console.error('[Célestine] écran cassé :', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="onboarding">
        <div className="card onboarding-card" role="alert">
          <div className="onboarding-logo" aria-hidden>🪶</div>
          <h1>Oh non, Plume a trébuché !</h1>
          <p>
            Quelque chose s'est cassé dans cette page. Tes histoires et tes personnages
            sont <strong>en sécurité</strong> — recharge et tout devrait repartir.
          </p>
          <button className="btn btn-primary btn-big" onClick={() => window.location.reload()}>
            🔄 Recharger
          </button>
          <p className="hint">
            Si ça recommence à chaque fois : le grand nettoyage répare presque tout
            (tes créations sont gardées).
          </p>
          <button className="btn btn-ghost" onClick={() => void hardReset()}>
            🧹 Vider le cache et recharger
          </button>
          <div className="build-tag">{String(this.state.error)}</div>
        </div>
      </div>
    )
  }
}
