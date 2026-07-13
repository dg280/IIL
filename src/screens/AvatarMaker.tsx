import { useState } from 'react'
import { AvatarView } from '../avatar/AvatarView'
import type { AvatarConfig, Expression } from '../avatar/types'
import {
  ACCESSORIES,
  ACCESSORY_COLORS,
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
import { getWardrobe } from '../atelier/wardrobe'
import { colorName } from '../avatar/types'
import { getAssetUrl, saveAsset } from '../atelier/assets'
import { generateCharacterPortrait, hasAI } from '../atelier/genai'
import { addReward, getProgress } from '../progression'

interface Props {
  title: string
  initialName: string
  initialConfig: AvatarConfig
  initialPortrait?: string
  universe?: string
  nameEditable?: boolean
  saveLabel?: string
  onSave: (name: string, config: AvatarConfig, portrait?: string) => void
  onCancel?: () => void
}

type Tab = 'peau' | 'cheveux' | 'tenue' | 'accessoire'

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'peau', label: 'Visage', emoji: '🙂' },
  { id: 'cheveux', label: 'Cheveux', emoji: '💇' },
  { id: 'tenue', label: 'Tenue', emoji: '👗' },
  { id: 'accessoire', label: 'Accessoires', emoji: '🎀' },
]

export function AvatarMaker({ title, initialName, initialConfig, initialPortrait, universe = 'sakura', nameEditable = true, saveLabel, onSave, onCancel }: Props) {
  const [config, setConfig] = useState<AvatarConfig>(initialConfig)
  const wardrobe = getWardrobe()
  const [name, setName] = useState(initialName)
  const [tab, setTab] = useState<Tab>('cheveux')
  const [expr, setExpr] = useState<Expression>('joie')
  const [portrait, setPortrait] = useState<string | undefined>(initialPortrait)
  const [portraitDescr, setPortraitDescr] = useState('')
  const [portraitBusy, setPortraitBusy] = useState(false)
  const [portraitMsg, setPortraitMsg] = useState<string | null>(null)

  const set = <K extends keyof AvatarConfig>(key: K, value: AvatarConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }))

  const genPortrait = async () => {
    if (getProgress().gems < 20) {
      setPortraitMsg('Il te faut 20 💎 pour un portrait magique.')
      return
    }
    setPortraitBusy(true)
    setPortraitMsg(null)
    try {
      const blob = await generateCharacterPortrait(portraitDescr || `${name}, un personnage`, universe)
      const asset = await saveAsset({ kind: 'image', mime: blob.type, label: `Portrait de ${name || 'perso'}`, prompt: portraitDescr, universe }, blob)
      addReward(0, -20)
      setPortrait(asset.id)
      setPortraitMsg('✨ Portrait créé ! Il apparaîtra en jeu.')
    } catch (e) {
      setPortraitMsg(e instanceof Error ? e.message : 'La magie a raté.')
    } finally {
      setPortraitBusy(false)
    }
  }

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
            {portrait && getAssetUrl(portrait) ? (
              <img className="portrait-img" src={getAssetUrl(portrait)!} alt="portrait" />
            ) : (
              <AvatarView config={config} expr={expr} width="100%" />
            )}
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

          <div className="portrait-panel">
            <h3>Portrait magique (IA)</h3>
            {hasAI() ? (
              <>
                <input
                  className="tiss-input"
                  value={portraitDescr}
                  maxLength={100}
                  placeholder="ex : une fille aux cheveux roux et lunettes, souriante"
                  onChange={(e) => setPortraitDescr(e.target.value)}
                />
                <div className="portrait-actions">
                  <button className="btn btn-primary" disabled={portraitBusy} onClick={genPortrait}>
                    {portraitBusy ? '🪄 Plume peint…' : '🪄 Générer (20 💎)'}
                  </button>
                  {portrait && (
                    <button className="btn btn-ghost" onClick={() => setPortrait(undefined)}>Revenir au dessin</button>
                  )}
                </div>
                {portraitMsg && <p className="hint">{portraitMsg}</p>}
              </>
            ) : (
              <p className="hint">Active la magie dans l’Espace parents pour créer un portrait unique par IA.</p>
            )}
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
                    aria-label={colorName(c)}
                    title={colorName(c)}
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
                    aria-label={colorName(c)}
                    title={colorName(c)}
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
                    aria-label={colorName(c)}
                    title={colorName(c)}
                    style={{ background: c }}
                    onClick={() => set('hairColor', c)}
                  />
                ))}
              </div>
            </section>
          )}

          {tab === 'tenue' && (
            <section>
              {wardrobe.length > 0 && (
                <>
                  <h3>✨ Mes créations de l'Atelier magique</h3>
                  <div className="style-grid">
                    {wardrobe.map((w) => {
                      const on =
                        config.outfit === w.outfit &&
                        config.outfitColor === w.outfitColor &&
                        config.motif?.kind === w.motif?.kind
                      return (
                        <button
                          key={w.id}
                          className={on ? 'style-card active' : 'style-card'}
                          onClick={() =>
                            setConfig((c) => ({
                              ...c,
                              outfit: w.outfit,
                              outfitColor: w.outfitColor,
                              outfitColor2: w.outfitColor2,
                              motif: w.motif,
                            }))
                          }
                        >
                          <AvatarView
                            config={{ ...config, outfit: w.outfit, outfitColor: w.outfitColor, outfitColor2: w.outfitColor2, motif: w.motif }}
                            expr="neutre"
                            width={64}
                          />
                          <span>{w.label}</span>
                          <span className="uni-chip" style={{ background: '#c9b8f5' }}>🪄</span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
              <h3>Tenue</h3>
              <div className="style-grid">
                {OUTFITS.map((o) => {
                  const uni = UNIVERSES.find((u) => u.id === o.universe)
                  return (
                    <button
                      key={o.id}
                      className={config.outfit === o.id && !config.motif ? 'style-card active' : 'style-card'}
                      onClick={() => setConfig((c) => ({ ...c, outfit: o.id, motif: null }))}
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
                    aria-label={colorName(c)}
                    title={colorName(c)}
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
                    aria-label={colorName(c)}
                    title={colorName(c)}
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
              {config.accessory !== 'aucun' && (
                <>
                  <h3>Couleur de l'accessoire</h3>
                  <div className="swatches">
                    {ACCESSORY_COLORS.map((c) => (
                      <button
                        key={c}
                        className={config.accessoryColor === c ? 'swatch active' : 'swatch'}
                        aria-label={colorName(c)}
                        title={colorName(c)}
                        style={{ background: c }}
                        onClick={() => set('accessoryColor', c)}
                      />
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          <button
            className="btn btn-primary btn-save"
            disabled={!name.trim()}
            onClick={() => onSave(name.trim(), config, portrait)}
          >
            {saveLabel ?? '💾 Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
