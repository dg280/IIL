import { useState } from 'react'
import { getProgress } from '../progression'
import {
  buySlotBundle,
  decorSlots,
  isPremium,
  KEYWORD_PACKS,
  ownedPacks,
  persoSlots,
  redeemCode,
  SLOT_COST,
  unlockPack,
} from '../premium'

interface Props {
  onBack: () => void
}

export function Boutique({ onBack }: Props) {
  const [, force] = useState(0)
  const refresh = () => force((n) => n + 1)
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const gems = getProgress().gems
  const premium = isPremium()
  const owned = ownedPacks()

  const activate = () => {
    if (redeemCode(code)) {
      setMsg('✨ Passe Créatrice activé ! Tout est débloqué. Merci !')
      refresh()
    } else {
      setMsg('Ce code n’est pas reconnu — demande à un parent.')
    }
  }

  const buyPack = (id: string) => {
    const r = unlockPack(id)
    if (r.ok && r.reason !== 'owned') { setMsg('✨ Pack débloqué ! Retrouve ses mots-clés dans le créateur.'); refresh() }
    else if (r.reason === 'gems') setMsg('Il te manque des gemmes — joue un peu pour en gagner !')
  }

  const buySlots = () => {
    const r = buySlotBundle()
    if (r.ok) { setMsg('✨ +5 slots persos & décors !'); refresh() }
    else if (r.reason === 'gems') setMsg('Il te manque des gemmes pour agrandir tes slots.')
  }

  return (
    <div className="parents">
      <header className="maker-header">
        <button className="btn btn-ghost" onClick={onBack}>← Studio</button>
        <h1>✨ Boutique</h1>
      </header>

      <div className="card parents-card">
        <div className="boutique-gems">💎 {gems} gemmes</div>
        {msg && <p className="room-message">{msg}</p>}
      </div>

      {/* Passe Créatrice */}
      <div className={premium ? 'card parents-card premium-on' : 'card parents-card'}>
        <h2>👑 Passe Créatrice {premium && <span className="premium-badge">actif ✨</span>}</h2>
        {premium ? (
          <p className="hint">Tout est débloqué : univers illimités, plein de slots, tous les packs de mots-clés cools et un bonus de gemmes. Merci&nbsp;!</p>
        ) : (
          <>
            <ul className="premium-perks">
              <li>🌍 Univers perso illimités</li>
              <li>🎒 Beaucoup plus de slots persos &amp; décors</li>
              <li>🎨 Tous les packs de mots-clés stylés</li>
              <li>💎 Bonus de gemmes &amp; badge doré</li>
            </ul>
            <p className="hint">Le Passe s’active avec un code (un parent s’en occupe).</p>
            <div className="modal-actions">
              <input className="tiss-input" value={code} placeholder="Code du Passe…" onChange={(e) => setCode(e.target.value)} />
              <button className="btn btn-primary" disabled={!code.trim()} onClick={activate}>Activer</button>
            </div>
          </>
        )}
      </div>

      {/* Slots */}
      <div className="card parents-card">
        <h2>🎒 Mes slots</h2>
        <p className="hint">
          Slots « vivants » : <strong>{persoSlots()}</strong> personnages · <strong>{decorSlots()}</strong> décors.
          Au-delà, range tes créations en 🫙 bouteille (elles restent régénérables).
        </p>
        {!premium && (
          <button className="btn btn-primary" onClick={buySlots}>Agrandir +5 persos &amp; décors ({SLOT_COST} 💎)</button>
        )}
      </div>

      {/* Packs de mots-clés */}
      <div className="card parents-card">
        <h2>🎨 Packs de styles cools</h2>
        <p className="hint">Débloque des mots-clés stylés qui apparaissent dans le créateur de personnage.</p>
        <div className="pack-grid">
          {KEYWORD_PACKS.map((p) => {
            const has = owned.includes(p.id)
            return (
              <div key={p.id} className={has ? 'pack-card owned' : 'pack-card'}>
                <span className="pack-emoji">{p.emoji}</span>
                <strong>{p.label}</strong>
                <small>{p.words.slice(0, 2).join(', ')}…</small>
                {has ? (
                  <span className="pack-owned">{premium ? '✨ Inclus' : '✓ Débloqué'}</span>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={() => buyPack(p.id)}>{p.cost} 💎</button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
