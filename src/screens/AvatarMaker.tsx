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
import { AI_AGES, AI_HEIGHTS, AI_SKIN_TONES, AMBIANCES, aiPortraitsEnabled, generateCharacterPortrait, hasAI } from '../atelier/genai'
import { addReward, getProgress } from '../progression'
import { PortraitViewer } from '../ui/PortraitViewer'
import { Silhouette } from '../ui/Silhouette'
import { isDebug } from '../debug'
import { playReveal, playSelect, playShutter } from '../player/voice'
import { KEYWORD_PACKS, ownedPacks } from '../premium'

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

// tuiles à activer (elles s'ajoutent au prompt) : chaque catégorie a son emoji
// et sa couleur pour bien se distinguer des autres (cf. .chip-group dans styles.css)
const PORTRAIT_CHIPS: { label: string; emoji: string; words: string[] }[] = [
  { label: 'Cheveux', emoji: '🎨', words: ['cheveux roux', 'cheveux blonds', 'cheveux bruns', 'cheveux noirs', 'cheveux roses', 'cheveux bleus', 'cheveux violets', 'cheveux argentés'] },
  { label: 'Coiffure', emoji: '💇', words: ['cheveux bouclés', 'cheveux raides', 'longs cheveux', 'cheveux courts', 'couettes', 'queue de cheval', 'tresses', 'frange', 'chignon'] },
  { label: 'Yeux', emoji: '👀', words: ['yeux verts', 'yeux bleus', 'yeux noisette', 'yeux violets', 'grands yeux'] },
  { label: 'Détails', emoji: '✨', words: ['des taches de rousseur', 'des lunettes', 'un grain de beauté', 'des boucles d’oreilles'] },
  { label: 'Tenue', emoji: '👗', words: ['uniforme marin', 'uniforme gakuran', 'blazer scolaire', 'tenue décontractée', 'robe étoilée', 'look de pop star', 'veste de scène rock', 'robe de bal', 'tenue princière', 'tenue d’aventure'] },
  { label: 'Accessoire', emoji: '🎀', words: ['un ruban', 'un serre-tête', 'un chapeau', 'un foulard', 'une fleur dans les cheveux', 'des écouteurs'] },
  { label: 'Chaussures', emoji: '👟', words: ['bottes', 'sandales', 'tongs', 'pieds nus', 'baskets', 'mocassins', 'chaussures à talons', 'ballerines'] },
  { label: 'Air', emoji: '😊', words: ['souriant·e', 'timide', 'rieur·se', 'sérieux·se', 'espiègle', 'doux·ce', 'mystérieux·se'] },
]

// groupes de tuiles mutuellement exclusives : une couleur de cheveux/yeux (ou une tenue)
// chasse les autres tuiles du même groupe pour éviter d'envoyer des choix contradictoires à
// l'IA (ex. « uniforme marin » + « robe de bal » actifs en même temps → l'IA retombe sur l'uniforme)
const EXCLUSIVE_CHIP_GROUPS: string[][] = [
  ['cheveux roux', 'cheveux blonds', 'cheveux bruns', 'cheveux noirs', 'cheveux roses', 'cheveux bleus', 'cheveux violets', 'cheveux argentés'],
  ['yeux verts', 'yeux bleus', 'yeux noisette', 'yeux violets'],
  ['uniforme marin', 'uniforme gakuran', 'blazer scolaire', 'tenue décontractée', 'robe étoilée', 'look de pop star', 'veste de scène rock', 'robe de bal', 'tenue princière', 'tenue d’aventure'],
]

// onglets du photomaton : chaque catégorie sur son onglet → pas de long scroll
const IA_TABS = [
  { id: 'base', emoji: '🧑', label: 'Base' },
  { id: 'cheveux', emoji: '💇', label: 'Cheveux' },
  { id: 'visage', emoji: '👀', label: 'Visage' },
  { id: 'style', emoji: '🎀', label: 'Style' },
  { id: 'ambiance', emoji: '🌈', label: 'Ambiance' },
] as const
type IaTab = (typeof IA_TABS)[number]['id']
// quelles catégories de tuiles (PORTRAIT_CHIPS.label) vont sur quel onglet
const CHIP_TABS: Record<string, string[]> = {
  cheveux: ['Cheveux', 'Coiffure'],
  visage: ['Yeux', 'Détails'],
  style: ['Tenue', 'Chaussures', 'Accessoire', 'Air'],
}

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

// cartes d'inspiration : un tap pose toute une ambiance (genre + tuiles + air)
const INSPIRATIONS: { emoji: string; label: string; gender: 'fille' | 'garcon'; skin: string; tags: string[]; ambiance: string; descr: string }[] = [
  { emoji: '👑', label: 'Princesse des étoiles', gender: 'fille', skin: 'clair', tags: ['cheveux argentés', 'longs cheveux', 'grands yeux'], ambiance: 'feerique', descr: 'une princesse rêveuse et bienveillante' },
  { emoji: '🎸', label: 'Rockeur cool', gender: 'garcon', skin: 'dore', tags: ['cheveux noirs', 'cheveux courts', 'des écouteurs'], ambiance: 'lumineux', descr: 'un ado cool et sûr de lui' },
  { emoji: '🧚', label: 'Fée espiègle', gender: 'fille', skin: 'clair', tags: ['cheveux roses', 'une fleur dans les cheveux', 'espiègle'], ambiance: 'feerique', descr: 'une petite fée malicieuse' },
  { emoji: '🌙', label: 'Mystérieux du soir', gender: 'garcon', skin: 'clair', tags: ['cheveux noirs', 'frange', 'mystérieux·se'], ambiance: 'crepuscule', descr: 'un garçon calme et énigmatique' },
  { emoji: '⚽', label: 'Sportive joyeuse', gender: 'fille', skin: 'hale', tags: ['cheveux bruns', 'queue de cheval', 'souriant·e'], ambiance: 'lumineux', descr: 'une sportive pleine d’énergie' },
  { emoji: '☁️', label: 'Douce rêveuse', gender: 'fille', skin: 'clair', tags: ['cheveux blonds', 'cheveux bouclés', 'doux·ce'], ambiance: 'doux', descr: 'une rêveuse toute douce' },
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
  // dernière photo remplacée (par une nouvelle prise, une retouche ou une suppression) :
  // permet de revenir en arrière si le nouveau résultat plaît moins
  const [previousPortrait, setPreviousPortrait] = useState<string | undefined>(undefined)
  const [portraitDescr, setPortraitDescr] = useState(initialPortraitDescr ?? '')
  const [portraitBusy, setPortraitBusy] = useState(false)
  const [portraitMsg, setPortraitMsg] = useState<string | null>(null)
  // étape en cours pendant la génération (« Plume vérifie… », « ajuste la tenue… »)
  const [stageMsg, setStageMsg] = useState<string | null>(null)
  // révélation stylée du portrait quand l'IA a fini
  const previewRef = useRef<HTMLDivElement>(null)
  const [revealKey, setRevealKey] = useState(0)
  const [ambiance, setAmbiance] = useState('doux')
  const [gender, setGender] = useState<'fille' | 'garcon'>(initialConfig.body === 'garcon' ? 'garcon' : 'fille')
  const [skin, setSkin] = useState('clair')
  const [age, setAge] = useState('ado')
  const [height, setHeight] = useState('moyen')
  const [seed, setSeed] = useState<number | null>(null)
  const [viewer, setViewer] = useState<string | null>(null)
  const [flash, setFlash] = useState(0) // clé d'animation du flash
  // message affiché quand on tente d'enregistrer sans prénom/photo : sans lui, le bouton
  // restait juste désactivé et l'enfant ne comprenait pas pourquoi « ça ne marche pas »
  const [saveWarn, setSaveWarn] = useState<string | null>(null)
  const [iaTab, setIaTab] = useState<IaTab>('base')
  const filledCount = portrait ? 1 : 0
  // tuiles à afficher pour l'onglet courant (+ packs de mots-clés dans « Style »)
  const chipGroupsFor = (t: IaTab): { label: string; emoji: string; words: string[] }[] => {
    const base = PORTRAIT_CHIPS.filter((g) => (CHIP_TABS[t] ?? []).includes(g.label))
    if (t === 'style') {
      const packs = KEYWORD_PACKS.filter((p) => ownedPacks().includes(p.id)).map((p) => ({ label: p.label, emoji: p.emoji, words: p.words }))
      return [...base, ...packs]
    }
    return base
  }
  // tuiles activées : combinées au texte libre pour former la description IA
  const [tags, setTags] = useState<Set<string>>(new Set())
  // tuiles marquées « super important » (⭐) : sous-ensemble strict de `tags`
  const [reinforced, setReinforced] = useState<Set<string>>(new Set())
  const toggleTag = (w: string) =>
    setTags((prev) => {
      const n = new Set(prev)
      if (n.has(w)) {
        n.delete(w)
        setReinforced((r) => (r.has(w) ? new Set([...r].filter((x) => x !== w)) : r))
      } else {
        const group = EXCLUSIVE_CHIP_GROUPS.find((g) => g.includes(w))
        if (group) {
          group.forEach((other) => n.delete(other))
          // une couleur renforcée chassée par une autre perd son étoile
          setReinforced((r) => new Set([...r].filter((x) => !group.includes(x))))
        }
        n.add(w)
      }
      return n
    })
  // ⭐ marque/démarque un trait actif comme « super important »
  const toggleReinforce = (w: string) => {
    if (!tags.has(w)) return
    setReinforced((prev) => {
      const n = new Set(prev)
      if (n.has(w)) {
        n.delete(w)
        setPortraitMsg('Trait remis en normal 👍')
      } else {
        n.add(w)
        setPortraitMsg('⭐ Trait super important ! Plume va bien le garder.')
      }
      return n
    })
    playSelect()
  }
  // Les tuiles activées sont les choix d'IDENTITÉ (cheveux, yeux…) : on les met en
  // TÊTE et on ne tronque jamais dessus ; seul le texte libre (queue) est rogné si trop long.
  const buildDescr = () => {
    const MAX = 220
    const tagPart = [...tags].join(', ')
    const free = portraitDescr.trim()
    if (!tagPart) return free.slice(0, MAX)
    if (!free) return tagPart
    const remaining = Math.max(0, MAX - tagPart.length - 2)
    return remaining > 0 ? `${tagPart}, ${free.slice(0, remaining)}` : tagPart
  }
  // Full IA quand la magie est branchée : plus d'avatar animé (paper-doll),
  // uniquement le portrait magique. Sans clé, on garde le dessin animé.
  // Portraits IA en pause (sécurité anti-nudité) → on force l'avatar dessiné, sûr.
  const mode: 'ia' | 'dessin' = hasAI() && aiPortraitsEnabled() ? 'ia' : 'dessin'

  const set = <K extends keyof AvatarConfig>(key: K, value: AvatarConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }))

  // on remonte sur le photomaton (haut du cadre) : l'enfant regarde toujours la cabine.
  // Uniquement en layout mobile 1 colonne : au-delà de 700px (cf. styles.css), la cabine
  // et le menu d'onglets vivent dans 2 colonnes d'un même conteneur scrollable — y faire un
  // scrollIntoView pousse le menu hors champ sans moyen d'y revenir (rien à scroller à la main).
  const focusPreview = () => {
    if (window.matchMedia('(min-width: 700px)').matches) return
    previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // keepSeed = retouche : on garde la même graine → la base reste, seul le détail change.
  const doGenerate = async (keepSeed: boolean, descrOverride?: string) => {
    if (!isDebug() && getProgress().gems < 20) {
      setPortraitMsg('Il te faut 20 💎 pour une photo magique.')
      return
    }
    const descr = (descrOverride ?? buildDescr()) || `${name}, un personnage`
    const useSeed = keepSeed && seed != null ? seed : Math.floor(Math.random() * 1_000_000_000)
    setSeed(useSeed)
    setPortraitBusy(true)
    setPortraitMsg(null)
    focusPreview() // l'enfant regarde la cabine pendant que Plume peint
    try {
      const reinf = [...reinforced].filter((t) => tags.has(t))
      const blob = await generateCharacterPortrait(descr, universe, {
        ambiance,
        gender,
        skin,
        age,
        height,
        seed: useSeed,
        tags: [...tags],
        reinforced: reinf,
        onProgress: setStageMsg, // la cabine raconte chaque étape (peinture, vérif, retouche)
      })
      const asset = await saveAsset(
        {
          kind: 'image',
          mime: blob.type,
          label: `Portrait de ${name || 'perso'}`,
          prompt: descr,
          universe,
          // paramètres persistés → permet de reproduire EXACTEMENT ce perso plus tard
          gen: { seed: useSeed, gender, skin, age, height, ambiance, tags: [...tags], reinforced: reinf },
        },
        blob,
      )
      if (!isDebug()) addReward(0, -20)
      setPortraitWithHistory(asset.id)
      setSaveWarn(null)
      setRevealKey((k) => k + 1) // relance l'animation de révélation
      setFlash((f) => f + 1) // ⚡ flash du photomaton
      playShutter() // clic-clac + souffle de flash
      playReveal() // petite fanfare joyeuse à la révélation
      setPortraitMsg(keepSeed ? '✨ Retouché ! (la base est gardée)' : '📸 Photo prise !')
      requestAnimationFrame(focusPreview)
    } catch (e) {
      setPortraitMsg(e instanceof Error ? e.message : 'La magie a raté.')
    } finally {
      setPortraitBusy(false)
      setStageMsg(null)
    }
  }

  const genPortrait = () => doGenerate(false)

  // remplace la photo actuelle en gardant la précédente en mémoire, pour pouvoir y revenir
  const setPortraitWithHistory = (next: string | undefined) => {
    setPreviousPortrait(portrait)
    setPortrait(next)
  }

  // enlever la photo
  const clearPhoto = () => {
    if (!portrait) return
    setPortraitWithHistory(undefined)
  }

  // revient à la photo d'avant (avant la dernière prise, retouche ou suppression)
  const undoPortrait = () => {
    if (previousPortrait === undefined) return
    setPortrait(previousPortrait)
    setPreviousPortrait(undefined)
    setPortraitMsg('↩️ Photo précédente restaurée')
    setRevealKey((k) => k + 1)
  }

  // carte d'inspiration : pose toute une ambiance d'un coup (sans générer)
  const applyInspiration = (p: (typeof INSPIRATIONS)[number]) => {
    setGender(p.gender)
    setSkin(p.skin)
    setTags(new Set(p.tags))
    setReinforced(new Set())
    setAmbiance(p.ambiance)
    setPortraitDescr(p.descr)
  }

  // 🎲 surprise : tout au hasard, puis on peint direct
  const surprise = () => {
    const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]
    const g = pick(['fille', 'garcon'] as const)
    const sk = pick(AI_SKIN_TONES).id
    const words = [pick(PORTRAIT_CHIPS[0].words), pick(PORTRAIT_CHIPS[1].words), pick(PORTRAIT_CHIPS[3].words), pick(PORTRAIT_CHIPS[5].words)]
    const amb = pick(AMBIANCES).id
    setGender(g)
    setSkin(sk)
    setTags(new Set(words))
    setReinforced(new Set())
    setAmbiance(amb)
    doGenerate(false, [...words].join(', '))
  }

  // ajoute un détail en gardant la base (ex : « des taches de rousseur »).
  // On garde la MÊME graine (doGenerate(true, …)) et on protège l'identité (tuiles)
  // ET le nouveau détail : seul le texte libre est rogné si on dépasse le budget.
  const applyRetouche = (text: string) => {
    const MAX = 220
    const head = [[...tags].join(', '), text].filter(Boolean).join(', ') // identité + détail : jamais tronqués
    const free = portraitDescr.trim()
    const remaining = Math.max(0, MAX - head.length - 2)
    const next = free && remaining > 0 ? `${head}, ${free.slice(0, remaining)}` : head
    setPortraitDescr((d) => ((d.trim() ? d.trim() + ', ' : '') + text).slice(0, MAX))
    doGenerate(true, next)
  }

  return (
    <div className="maker screen maker-screen">
      <header className="screen-header">
        {onCancel && (
          <button className="icon-btn" onClick={onCancel} aria-label="Retour">←</button>
        )}
        <h1>{title}</h1>
        <span className="spacer" />
        {mode === 'ia' && hasAI() && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              if (!name.trim()) { setSaveWarn('✏️ Donne-lui un prénom avant de valider !'); return }
              if (!portrait) { setSaveWarn('📸 Prends d’abord sa photo magique !'); return }
              setSaveWarn(null)
              onSave(name.trim(), config, portrait)
            }}
          >
            {saveLabel ?? '✨ Valider'}
          </button>
        )}
      </header>

      <div className="screen-body">
        {saveWarn && <p className="room-message maker-save-warn">{saveWarn}</p>}
        <div className="maker-preview">
          <div className={`photobooth${portraitBusy ? ' booth-busy' : ''}${mode === 'ia' ? '' : ' booth-plain'}`}>
            {mode === 'ia' && <span className="booth-curtain booth-curtain-l" aria-hidden />}
            {mode === 'ia' && <span className="booth-curtain booth-curtain-r" aria-hidden />}
            <div className={`maker-avatar${portraitBusy ? ' portrait-painting' : ''}`} ref={previewRef}>
              {portrait && getAssetUrl(portrait) ? (
                <img
                  key={revealKey}
                  className="portrait-img portrait-reveal polaroid-develop"
                  src={getAssetUrl(portrait)!}
                  alt="portrait"
                  title="Voir en grand"
                  onClick={() => setViewer(getAssetUrl(portrait)!)}
                  style={{ cursor: 'zoom-in' }}
                />
              ) : mode === 'dessin' ? (
                <AvatarView config={config} expr={expr} width="100%" />
              ) : (
                <div className="portrait-placeholder">
                  <Silhouette kind="perso" />
                  <span className="placeholder-hint">{portraitBusy ? 'Souris… ça va flasher !' : 'Souris : ta photo magique apparaîtra ici ✨'}</span>
                </div>
              )}
              {portraitBusy && (
                <div className="paint-overlay" aria-hidden>
                  <span className="paint-shimmer" />
                  <span className="paint-label" key={stageMsg ?? 'peint'}>{stageMsg ?? '🪄 Plume peint…'}</span>
                </div>
              )}
              {flash > 0 && !portraitBusy && <span className="booth-flash" key={`fl${flash}`} aria-hidden />}
              {revealKey > 0 && !portraitBusy && portrait && (
                <div className="reveal-sparkles" key={`sp${revealKey}`} aria-hidden>
                  {['✨', '⭐', '💫', '🌟', '✨', '💖'].map((s, i) => (
                    <span key={i} className={`sparkle sparkle-${i}`}>{s}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {nameEditable ? (
            <input
              className="name-input"
              value={name}
              maxLength={16}
              onChange={(e) => { setName(e.target.value); if (e.target.value.trim()) setSaveWarn(null) }}
              placeholder="Son prénom…"
            />
          ) : (
            <div className="maker-name">{name}</div>
          )}
          {mode === 'dessin' && !portrait && (
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
          )}
          {portrait && (
            <span className="portrait-badge">🪄 Portrait magique actif</span>
          )}
        </div>

        {mode === 'ia' && hasAI() && (
          <nav className="segmented maker-seg" role="tablist" aria-label="Réglages du portrait">
            {IA_TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={iaTab === t.id} className={iaTab === t.id ? 'active' : ''} onClick={() => setIaTab(t.id)}>
                <span aria-hidden>{t.emoji}</span>
                <span className="seg-lbl">{t.label}</span>
              </button>
            ))}
          </nav>
        )}

        <div className="maker-tray">

          {mode === 'ia' && hasAI() && (
            <section className="ia-panel">
              {iaTab === 'base' && (
                <>
                  <div className="inspo-row" data-scroll>
                    {INSPIRATIONS.map((p) => (
                      <button key={p.label} className="inspo-card" onClick={() => applyInspiration(p)} title={p.label}>
                        <span className="inspo-emoji">{p.emoji}</span>
                        <span>{p.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="ia-controls">
                    <span className="ia-ctrl-label">Qui est-ce ?</span>
                    <div className="gender-row" role="group" aria-label="Genre">
                      <button className={gender === 'fille' ? 'gender-chip active' : 'gender-chip'} onClick={() => setGender('fille')}>👧 Fille</button>
                      <button className={gender === 'garcon' ? 'gender-chip active' : 'gender-chip'} onClick={() => setGender('garcon')}>👦 Garçon</button>
                    </div>
                    <span className="ia-ctrl-label">Son âge</span>
                    <div className="gender-row" role="group" aria-label="Âge">
                      {AI_AGES.map((a) => (
                        <button key={a.id} className={age === a.id ? 'gender-chip active' : 'gender-chip'} onClick={() => setAge(a.id)}>{a.label}</button>
                      ))}
                    </div>
                    <span className="ia-ctrl-label">Sa taille</span>
                    <div className="gender-row" role="group" aria-label="Taille">
                      {AI_HEIGHTS.map((h) => (
                        <button key={h.id} className={height === h.id ? 'gender-chip active' : 'gender-chip'} onClick={() => setHeight(h.id)}>{h.label}</button>
                      ))}
                    </div>
                    <span className="ia-ctrl-label">Sa carnation</span>
                    <div className="swatches">
                      {AI_SKIN_TONES.map((s) => (
                        <button key={s.id} className={skin === s.id ? 'swatch active' : 'swatch'} aria-label={s.label} title={s.label} style={{ background: s.hex }} onClick={() => setSkin(s.id)} />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {chipGroupsFor(iaTab).length > 0 && (
                <div className="chip-help">
                  {chipGroupsFor(iaTab).map((grp) => (
                    <div key={grp.label} className="chip-group">
                      <span className="chip-group-label"><span aria-hidden>{grp.emoji}</span> {grp.label}</span>
                      {grp.words.map((w) => (
                        <span key={w} className={tags.has(w) ? (reinforced.has(w) ? 'seed-chip chip-pill active starred' : 'seed-chip chip-pill active') : 'seed-chip chip-pill'}>
                          <button className="seed-chip-label" aria-pressed={tags.has(w)} onClick={() => toggleTag(w)}>
                            {tags.has(w) ? (reinforced.has(w) ? '🌟 ' : '✓ ') : ''}{w}
                          </button>
                          {tags.has(w) && (
                            <button
                              className="chip-star"
                              aria-label={reinforced.has(w) ? 'Remettre ce trait en normal' : 'Rendre ce trait super important'}
                              aria-pressed={reinforced.has(w)}
                              onClick={() => toggleReinforce(w)}
                            >
                              {reinforced.has(w) ? '🌟' : '☆'}
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  ))}
                  {reinforced.size > 0 && <p className="chip-legend">🌟 = trait super important pour Plume</p>}
                </div>
              )}

              {iaTab === 'ambiance' && (
                <div className="ia-controls">
                  <span className="ia-ctrl-label">L'ambiance</span>
                  <div className="ambiance-row" role="group" aria-label="Ambiance">
                    {AMBIANCES.map((a) => (
                      <button key={a.id} className={ambiance === a.id ? 'ambiance-chip active' : 'ambiance-chip'} onClick={() => setAmbiance(a.id)}>
                        <span className="ambiance-emoji">{a.emoji}</span>
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {portraitMsg && <p className="hint hint-center">{portraitMsg}</p>}
              {previousPortrait !== undefined && (
                <button className="btn btn-ghost btn-sm" onClick={undoPortrait}>
                  ↩️ Revenir à la photo d’avant
                </button>
              )}
              {portrait && (
                <button className="btn btn-ghost btn-sm clear-photo" onClick={clearPhoto}>
                  🗑 Enlever cette photo
                </button>
              )}

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
            onClick={() => {
              if (!name.trim()) { setSaveWarn('✏️ Donne-lui un prénom avant d’enregistrer !'); return }
              setSaveWarn(null)
              onSave(name.trim(), config, portrait)
            }}
          >
            {saveLabel ?? '💾 Enregistrer'}
          </button>
          </>
          )}
        </div>
      </div>

      {mode === 'ia' && hasAI() && (
        <div className="screen-actions">
          <button className="btn btn-ghost btn-dice" disabled={portraitBusy} onClick={surprise} aria-label="Surprends-moi" title="Surprends-moi">🎲</button>
          <button className="btn btn-primary" disabled={portraitBusy} onClick={genPortrait}>
            {portraitBusy
              ? '🪄 Plume peint…'
              : filledCount === 0
                ? '📸 Ma photo (20 💎)'
                : '📸 Reprendre (20 💎)'}
          </button>
        </div>
      )}

      {viewer && <PortraitViewer src={viewer} onClose={() => setViewer(null)} />}
    </div>
  )
}
