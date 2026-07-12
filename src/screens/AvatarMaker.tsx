import { useState } from 'react'
import { AvatarView } from '../avatar/AvatarView'
import type { AvatarConfig, Expression } from '../avatar/types'
import {
  ACCESSORIES,
  BODIES,
  EXPRESSIONS,
  EYE_COLORS,
  HAIR_COLORS,
  HAIR_STYLES,
  OUTFIT_COLORS,
  OUTFITS,
  SKIN_TONES,
} from '../avatar/types'
import { UNIVERSES } from '../universes'

interface Props {
  title: string
  initialName: string
  initialConfig: AvatarConfig
  nameEditable?: boolean
  saveLabel?: string
  onSave: (name: string, config: AvatarConfig) => void
  onCancel?: () => void
}

type Tab = 'peau' | 'cheveux' | 'tenue' | 'accessoire'

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'peau', label: 'Visage', emoji: '🙂' },
  { id: 'cheveux', label: 'Cheveux', emoji: '💇' },
  { id: 'tenue', label: 'Tenue', emoji: '👗' },
  { id: 'accessoire', label: 'Accessoires', emoji: '🎀' },
]

export function AvatarMaker({ title, initialName, initialConfig, nameEditable = true, saveLabel, onSave, onCancel }: Props) {
  const [config, setConfig] = useState<AvatarConfig>(initialConfig)
  const [name, setName] = useState(initialName)
  const [tab, setTab] = useState<Tab>('cheveux')
  const [expr, setExpr] = useState<Expression>('joie')

  const set = <K extends keyof AvatarConfig>(key: K, value: AvatarConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }))

  return (
    <div className="maker">
      <header className="maker-header">
        {onCancel && (
          <button className="btn btn-ghost" onClick={onCancel}>
            ← Retour
          </button>
        )}
        <h1>{title}</h1>
      </header>

      <div className="maker-body">
        <div className="maker-preview card">
          <div className="maker-avatar">
            <AvatarView config={config} expr={expr} width="100%" />
          </div>
          {nameEditable ? (
            <input
              className="name-input"
              value={name}
              maxLength={16}
              onChange={(e) => setName(e.target.value)}
              placeholder="Son prénom…"
            />
          ) : (
            <div className="maker-name">{name}</div>
          )}
          <div className="expr-row">
            {EXPRESSIONS.map((e) => (
              <button
                key={e.id}
                className={expr === e.id ? 'expr-chip active' : 'expr-chip'}
                onClick={() => setExpr(e.id)}
                title={e.label}
              >
                <AvatarView config={config} expr={e.id} width={34} />
              </button>
            ))}
          </div>
        </div>

        <div className="maker-panel card">
          <div className="tabs">
            {TABS.map((t) => (
              <button key={t.id} className={tab === t.id ? 'tab active' : 'tab'} onClick={() => setTab(t.id)}>
                {t.emoji} {t.label}
              </button>
            ))}
          </div>

          {tab === 'peau' && (
            <section>
              <h3>Silhouette</h3>
              <div className="style-grid">
                {BODIES.map((b) => (
                  <button
                    key={b.id}
                    className={config.body === b.id ? 'style-card active' : 'style-card'}
                    onClick={() => set('body', b.id)}
                  >
                    <AvatarView config={{ ...config, body: b.id }} expr="neutre" width={64} />
                    <span>{b.emoji} {b.label}</span>
                  </button>
                ))}
              </div>
              <h3>Carnation</h3>
              <div className="swatches">
                {SKIN_TONES.map((c) => (
                  <button
                    key={c}
                    className={config.skin === c ? 'swatch active' : 'swatch'}
                    style={{ background: c }}
                    onClick={() => set('skin', c)}
                  />
                ))}
              </div>
              <h3>Couleur des yeux</h3>
              <div className="swatches">
                {EYE_COLORS.map((c) => (
                  <button
                    key={c}
                    className={config.eyeColor === c ? 'swatch active' : 'swatch'}
                    style={{ background: c }}
                    onClick={() => set('eyeColor', c)}
                  />
                ))}
              </div>
            </section>
          )}

          {tab === 'cheveux' && (
            <section>
              <h3>Coiffure</h3>
              <div className="style-grid">
                {HAIR_STYLES.map((h) => (
                  <button
                    key={h.id}
                    className={config.hairStyle === h.id ? 'style-card active' : 'style-card'}
                    onClick={() => set('hairStyle', h.id)}
                  >
                    <AvatarView config={{ ...config, hairStyle: h.id }} expr="neutre" width={64} />
                    <span>{h.label}</span>
                  </button>
                ))}
              </div>
              <h3>Couleur</h3>
              <div className="swatches">
                {HAIR_COLORS.map((c) => (
                  <button
                    key={c}
                    className={config.hairColor === c ? 'swatch active' : 'swatch'}
                    style={{ background: c }}
                    onClick={() => set('hairColor', c)}
                  />
                ))}
              </div>
            </section>
          )}

          {tab === 'tenue' && (
            <section>
              <h3>Tenue</h3>
              <div className="style-grid">
                {OUTFITS.map((o) => {
                  const uni = UNIVERSES.find((u) => u.id === o.universe)
                  return (
                    <button
                      key={o.id}
                      className={config.outfit === o.id ? 'style-card active' : 'style-card'}
                      onClick={() => set('outfit', o.id)}
                    >
                      <AvatarView config={{ ...config, outfit: o.id }} expr="neutre" width={64} />
                      <span>{o.label}</span>
                      <span className="uni-chip" style={{ background: uni?.color }}>
                        {uni?.emoji}
                      </span>
                    </button>
                  )
                })}
              </div>
              <h3>Couleur principale</h3>
              <div className="swatches">
                {OUTFIT_COLORS.map((c) => (
                  <button
                    key={c}
                    className={config.outfitColor === c ? 'swatch active' : 'swatch'}
                    style={{ background: c }}
                    onClick={() => set('outfitColor', c)}
                  />
                ))}
              </div>
              <h3>Couleur secondaire</h3>
              <div className="swatches">
                {OUTFIT_COLORS.map((c) => (
                  <button
                    key={c + '2'}
                    className={config.outfitColor2 === c ? 'swatch active' : 'swatch'}
                    style={{ background: c }}
                    onClick={() => set('outfitColor2', c)}
                  />
                ))}
              </div>
            </section>
          )}

          {tab === 'accessoire' && (
            <section>
              <h3>Accessoire</h3>
              <div className="style-grid">
                {ACCESSORIES.map((a) => (
                  <button
                    key={a.id}
                    className={config.accessory === a.id ? 'style-card active' : 'style-card'}
                    onClick={() => set('accessory', a.id)}
                  >
                    <AvatarView config={{ ...config, accessory: a.id }} expr="neutre" width={64} />
                    <span>{a.label}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <button
            className="btn btn-primary btn-save"
            disabled={!name.trim()}
            onClick={() => onSave(name.trim(), config)}
          >
            {saveLabel ?? '💾 Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
