import { useRef, useState } from 'react'
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
import { AI_SKIN_TONES, AMBIANCES, generateCharacterPortrait, hasAI } from '../atelier/genai'
import { addReward, getProgress } from '../progression'
import { PortraitViewer } from '../ui/PortraitViewer'

interface Props {
  title: string
  initialName: string
  initialConfig: AvatarConfig
  initialPortrait?: string
  initialPortraitDescr?: string
  universe?: string
  nameEditable?: boolean
  saveLabel?: string
  onSave: (name: string, config: AvatarConfig, portrait?: string) => void
  onCancel?: () => void
}

type Tab = 'peau' | 'cheveux' | 'tenue' | 'accessoire'

// tuiles d'aide pour décrire un portrait sans partir d'un prompt vide
const PORTRAIT_CHIPS: { label: string; words: string[] }[] = [
  { label: 'Cheveux', words: ['cheveux roux', 'cheveux blonds', 'cheveux bruns', 'cheveux roses', 'cheveux bleus', 'cheveux bouclés', 'longs cheveux', 'cheveux courts'] },
  { label: 'Détails', words: ['des lunettes', 'des taches de rousseur', 'un ruban', 'un chapeau', 'des yeux verts', 'des yeux bleus'] },
  { label: 'Air', words: ['souriant·e', 'timide', 'rieur·se', 'sérieux·se', 'espiègle', 'doux·ce'] },
]

// retouches rapides : ajoutent un détail en gardant la base du portrait
const RETOUCHE_CHIPS = [
  'des taches de rousseur bien visibles',
  'des lunettes',
  'cheveux plus longs',
  'cheveux plus courts',
  'un grand sourire',
  'un ruban dans les cheveux',
  'des yeux plus clairs',
  'des couettes',
]

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'peau', label: 'Visage', emoji: '🙂' },
  { id: 'cheveux', label: 'Cheveux', emoji: '💇' },
  { id: 'tenue', label: 'Tenue', emoji: '👗' },
  { id: 'accessoire', label: 'Accessoires', emoji: '🎀' },
]

export function AvatarMaker({ title, initialName, initialConfig, initialPortrait, initialPortraitDescr, universe = 'sakura', nameEditable = true, saveLabel, onSave, onCancel }: Props) {
  const [config, setConfig] = useState<AvatarConfig>(initialConfig)
  const wardrobe = getWardrobe()
  const [name, setName] = useState(initialName)
  const [tab, setTab] = useState<Tab>('cheveux')
  const [expr, setExpr] = useState<Expression>('joie')
  const [portrait, setPortrait] = useState<string | undefined>(initialPortrait)
  const [portraitDescr, setPortraitDescr] = useState(initialPortraitDescr ?? '')
  const [portraitBusy, setPortraitBusy] = useState(false)
  const [portraitMsg, setPortraitMsg] = useState<string | null>(null)
  // révélation stylée du portrait quand l'IA a fini
  const previewRef = useRef<HTMLDivElement>(null)
  const [revealKey, setRevealKey] = useState(0)
  const [ambiance, setAmbiance] = useState('doux')
  const [gender, setGender] = useState<'fille' | 'garcon'>(initialConfig.body === 'garcon' ? 'garcon' : 'fille')
  const [skin, setSkin] = useState('clair')
  const [seed, setSeed] = useState<number | null>(null)
  const [viewer, setViewer] = useState<string | null>(null)
  // Mode full IA : quand la magie est branchée, le portrait magique est le
  // geste de création principal ; le dessin animé reste pour les expressions.
  const [mode, setMode] = useState<'ia' | 'dessin'>(hasAI() ? 'ia' : 'dessin')

  const set = <K extends keyof AvatarConfig>(key: K, value: AvatarConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }))

  const focusPreview = () => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  // keepSeed = retouche : on garde la même graine → la base reste, seul le détail change
  const doGenerate = async (descr: string, keepSeed: boolean) => {
    if (getProgress().gems < 20) {
      setPortraitMsg('Il te faut 20 💎 pour un portrait magique.')
      return
    }
    const useSeed = keepSeed && seed != null ? seed : Math.floor(Math.random() * 1_000_000_000)
    setSeed(useSeed)
    setPortraitBusy(true)
    setPortraitMsg(null)
    focusPreview() // l'enfant regarde la zone pendant que Plume peint
    try {
      const blob = await generateCharacterPortrait(descr || `${name}, un personnage`, universe, { ambiance, gender, skin, seed: useSeed })
      const asset = await saveAsset({ kind: 'image', mime: blob.type, label: `Portrait de ${name || 'perso'}`, prompt: descr, universe }, blob)
      addReward(0, -20)
      setPortrait(asset.id)
      setRevealKey((k) => k + 1) // relance l'animation de révélation
      setPortraitMsg(keepSeed ? '✨ Retouché ! (la base est gardée)' : '✨ Portrait créé ! Il apparaîtra en jeu.')
      requestAnimationFrame(focusPreview)
    } catch (e) {
      setPortraitMsg(e instanceof Error ? e.message : 'La magie a raté.')
    } finally {
      setPortraitBusy(false)
    }
  }

  const genPortrait = () => doGenerate(portraitDescr || `${name}, un personnage`, false)

  // ajoute un détail en gardant la base (ex : « des taches de rousseur »)
  const applyRetouche = (text: string) => {
    const next = ((portraitDescr.trim() ? portraitDescr.trim() + ', ' : '') + text).slice(0, 220)
    setPortraitDescr(next)
    doGenerate(next, true)
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
          <div className={`maker-avatar${portraitBusy ? ' portrait-painting' : ''}`} ref={previewRef}>
            {portrait && getAssetUrl(portrait) ? (
              <img
                key={revealKey}
                className="portrait-img portrait-reveal"
                src={getAssetUrl(portrait)!}
                alt="portrait"
                title="Voir en grand"
                onClick={() => setViewer(getAssetUrl(portrait)!)}
                style={{ cursor: 'zoom-in' }}
              />
            ) : (
              <AvatarView config={config} expr={expr} width="100%" />
            )}
            {portraitBusy && (
              <div className="paint-overlay" aria-hidden>
                <span className="paint-shimmer" />
                <span className="paint-label">🪄 Plume peint…</span>
              </div>
            )}
            {revealKey > 0 && !portraitBusy && portrait && (
              <div className="reveal-sparkles" key={`sp${revealKey}`} aria-hidden>
                {['✨', '⭐', '💫', '🌟', '✨', '💖'].map((s, i) => (
                  <span key={i} className={`sparkle sparkle-${i}`}>{s}</span>
                ))}
              </div>
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
          {portrait && (
            <span className="portrait-badge">🪄 Portrait magique actif</span>
          )}
        </div>

        <div className="maker-panel card">
          {hasAI() && (
            <div className="maker-mode">
              <button
                className={mode === 'ia' ? 'maker-mode-btn active' : 'maker-mode-btn'}
                onClick={() => setMode('ia')}
              >
                🪄 Portrait magique
              </button>
              <button
                className={mode === 'dessin' ? 'maker-mode-btn active' : 'maker-mode-btn'}
                onClick={() => setMode('dessin')}
              >
                🎨 Avatar animé
              </button>
            </div>
          )}

          {mode === 'ia' && hasAI() && (
            <section className="ia-panel">
              <h3>🪄 Le portrait magique de {name || 'ton personnage'}</h3>
              <p className="hint">
                Décris-le et Plume le peint dans le style maison. C’est ce portrait
                qu’on verra en jeu. L’avatar animé (onglet à côté) sert pour ses expressions.
              </p>
              <input
                className="tiss-input"
                value={portraitDescr}
                maxLength={120}
                placeholder="Touche des idées ci-dessous, ou écris toi-même…"
                onChange={(e) => setPortraitDescr(e.target.value)}
              />
              <div className="chip-help">
                {PORTRAIT_CHIPS.map((grp) => (
                  <div key={grp.label} className="chip-group">
                    <span className="chip-group-label">{grp.label}</span>
                    {grp.words.map((w) => (
                      <button
                        key={w}
                        className="seed-chip"
                        onClick={() => setPortraitDescr((d) => (d.trim() ? `${d.trim()}, ${w}` : w).slice(0, 120))}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
              <div className="ia-controls">
                <span className="ia-ctrl-label">Qui est-ce ?</span>
                <div className="gender-row" role="group" aria-label="Genre">
                  <button className={gender === 'fille' ? 'gender-chip active' : 'gender-chip'} onClick={() => setGender('fille')}>👧 Fille</button>
                  <button className={gender === 'garcon' ? 'gender-chip active' : 'gender-chip'} onClick={() => setGender('garcon')}>👦 Garçon</button>
                </div>
                <span className="ia-ctrl-label">Sa carnation</span>
                <div className="swatches">
                  {AI_SKIN_TONES.map((s) => (
                    <button
                      key={s.id}
                      className={skin === s.id ? 'swatch active' : 'swatch'}
                      aria-label={s.label}
                      title={s.label}
                      style={{ background: s.hex }}
                      onClick={() => setSkin(s.id)}
                    />
                  ))}
                </div>
                <span className="ia-ctrl-label">L'ambiance</span>
                <div className="ambiance-row" role="group" aria-label="Ambiance">
                  {AMBIANCES.map((a) => (
                    <button
                      key={a.id}
                      className={ambiance === a.id ? 'ambiance-chip active' : 'ambiance-chip'}
                      onClick={() => setAmbiance(a.id)}
                    >
                      <span className="ambiance-emoji">{a.emoji}</span>
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="portrait-actions">
                <button className="btn btn-primary" disabled={portraitBusy} onClick={genPortrait}>
                  {portraitBusy ? '🪄 Plume peint…' : portrait ? '🔄 Refaire (20 💎)' : '🪄 Peindre le portrait (20 💎)'}
                </button>
                {portrait && (
                  <button className="btn btn-ghost" onClick={() => setPortrait(undefined)}>
                    Enlever le portrait
                  </button>
                )}
              </div>
              {portraitMsg && <p className="hint">{portraitMsg}</p>}

              {portrait && (
                <div className="retouche">
                  <span className="ia-ctrl-label">✨ Retoucher (garde la base)</span>
                  <p className="hint">Il manque un détail ? Touche pour l’ajouter — Plume garde le même personnage et corrige.</p>
                  <div className="chip-help">
                    {RETOUCHE_CHIPS.map((r) => (
                      <button key={r} className="seed-chip" disabled={portraitBusy} onClick={() => applyRetouche(r)}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                className="btn btn-primary btn-save"
                disabled={!name.trim()}
                onClick={() => onSave(name.trim(), config, portrait)}
              >
                {saveLabel ?? '💾 Enregistrer'}
              </button>
            </section>
          )}

          {mode === 'dessin' && (
          <>
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
          </>
          )}
        </div>
      </div>

      {viewer && <PortraitViewer src={viewer} onClose={() => setViewer(null)} />}
    </div>
  )
}
