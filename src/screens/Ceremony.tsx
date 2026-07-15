import { useRef, useState } from 'react'
import type { UniverseId } from '../universes'
import { UNIVERSES } from '../universes'
import { PLUME_STARTERS, pickStarterVariant, pickRandomDecors } from '../data/starters'
import { AMBIANCES, aiPortraitsEnabled, generateBackground, generateCharacterPortrait } from '../atelier/genai'
import { getAssetUrl, saveAsset } from '../atelier/assets'
import { getRoster, saveRosterEntry } from '../storage'
import { Silhouette } from '../ui/Silhouette'
import { PortraitViewer } from '../ui/PortraitViewer'

interface Props {
  universe: UniverseId
  onDone: () => void
}

type StepStatus = 'wait' | 'painting' | 'done' | 'fail'

interface Step {
  kind: 'perso' | 'decor'
  label: string
  emoji: string
  descr: string
  persoId?: string
  gender?: 'fille' | 'garcon'
  /** traits des AUTRES personnages, à exclure pour se différencier */
  avoid?: string
  /** config de base conservée comme donnée (jamais affichée en paper-doll) */
  config?: import('../avatar/types').AvatarConfig
  assetId?: string
  status: StepStatus
}

/**
 * Cérémonie de bienvenue : Plume (LiberTai) peint sous les yeux de l'enfant les
 * 3 premiers personnages (portraits IA, sans paper-doll) et quelques décors de
 * l'univers, dans l'ambiance choisie. Chaque carte peut être refaite. Offert
 * (0 gemme). En cas d'échec, la carte reste en silhouette et peut être relancée
 * — aucun personnage « dessiné à la main » n'est créé.
 */
export function Ceremony({ universe, onDone }: Props) {
  const uni = UNIVERSES.find((u) => u.id === universe)
  // ids stables : réutilise le personnage existant du même nom (re-jouer la FTUE
  // ne crée pas de doublon) et n'écrase jamais les autres créations.
  const resolvePersoIds = (): string[] => {
    const roster = getRoster()
    const taken = new Set(Object.keys(roster))
    return PLUME_STARTERS.map((s) => {
      const found = Object.entries(roster).find(([id, e]) => id !== 'self' && e.name.toLowerCase() === s.name.toLowerCase())
      if (found) return found[0]
      let n = 1
      while (taken.has(`perso${n}`)) n++
      taken.add(`perso${n}`)
      return `perso${n}`
    })
  }

  const buildSteps = (): Step[] => {
    const ids = resolvePersoIds()
    // un physique + une tenue adaptée à l'univers sont tirés au sort par personnage,
    // une seule fois pour toute la Cérémonie (utilisé à la fois pour l'affichage et
    // la génération, et pour différencier les personnages entre eux via « avoid »).
    const variants = PLUME_STARTERS.map((s) => pickStarterVariant(s, universe))
    return [
      ...PLUME_STARTERS.map((s, i) => ({
        kind: 'perso' as const,
        label: s.name,
        emoji: s.emoji,
        descr: variants[i].descr,
        persoId: ids[i],
        gender: s.config.body === 'garcon' ? ('garcon' as const) : ('fille' as const),
        avoid: variants.filter((_, j) => j !== i).map((v) => v.traits).join(', '),
        config: variants[i].config,
        status: 'wait' as StepStatus,
      })),
      ...pickRandomDecors(universe, 3).map((d) => ({
        kind: 'decor' as const,
        label: d.length > 34 ? d.slice(0, 32) + '…' : d,
        emoji: '🏞️',
        descr: d,
        status: 'wait' as StepStatus,
      })),
    ]
  }

  const [steps, setSteps] = useState<Step[]>(buildSteps)
  const [phase, setPhase] = useState<'intro' | 'running' | 'done'>('intro')
  const [ambiance, setAmbiance] = useState('doux')
  const [viewer, setViewer] = useState<string | null>(null)
  const started = useRef(false)

  const patch = (i: number, p: Partial<Step>) => setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, ...p } : s)))

  /** en cas d'échec (réseau, modération…), Plume retente automatiquement quelques
   *  fois avant d'afficher un échec nécessitant une action manuelle (bouton 🔄). */
  const MAX_AUTO_RETRIES = 2

  const paintStep = async (i: number, step: Step, attempt = 0) => {
    patch(i, { status: 'painting' })
    try {
      if (step.kind === 'perso') {
        // Portraits IA en pause (sécurité) : on crée quand même le personnage avec
        // son avatar dessiné (sûr), sans image IA.
        if (!aiPortraitsEnabled()) {
          saveRosterEntry(step.persoId!, { name: step.label, config: step.config! })
          patch(i, { status: 'done' })
          return
        }
        // seed aléatoire à CHAQUE peinture (y compris refaire 🔄) : sans elle, le
        // fournisseur IA régénère une image quasi identique à la précédente pour
        // la même description.
        const seed = Math.floor(Math.random() * 1_000_000_000)
        const blob = await generateCharacterPortrait(step.descr, universe, { ambiance, gender: step.gender, avoid: step.avoid, seed, free: true })
        // on persiste seed + sélections → le casting du FTUE reste reproductible à l'identique
        const asset = await saveAsset(
          { kind: 'image', mime: blob.type, label: `Portrait de ${step.label}`, prompt: step.descr, universe, gen: { seed, gender: step.gender, ambiance } },
          blob,
        )
        // le personnage n'est enregistré QUE s'il a un vrai portrait IA
        saveRosterEntry(step.persoId!, { name: step.label, config: step.config!, portraitAsset: asset.id })
        patch(i, { status: 'done', assetId: asset.id })
      } else {
        const blob = await generateBackground(step.descr, universe, ambiance, true)
        const asset = await saveAsset({ kind: 'image', mime: blob.type, label: step.descr, prompt: step.descr, universe }, blob)
        patch(i, { status: 'done', assetId: asset.id })
      }
    } catch {
      if (attempt < MAX_AUTO_RETRIES) {
        await paintStep(i, step, attempt + 1)
      } else {
        patch(i, { status: 'fail' }) // pas de repli paper-doll : on garde la silhouette
      }
    }
  }

  const run = async () => {
    if (started.current) return
    started.current = true
    setPhase('running')
    // on peint les étapes déjà tirées au sort à l'initialisation (buildSteps ne doit
    // PAS être rappelé ici : un second tirage donnerait un physique/décor différent
    // de celui affiché à l'écran).
    for (let i = 0; i < steps.length; i++) await paintStep(i, steps[i])
    setPhase('done')
  }

  if (phase === 'intro') {
    return (
      <div className="ceremony ceremony-intro">
        <div className="ceremony-orb" aria-hidden>🪶</div>
        <h1>La grande cérémonie</h1>
        <p className="subtitle">Bienvenue dans <strong>{uni?.name}</strong> !</p>
        <p className="ceremony-lead">
          Plume va peindre pour toi tes premiers personnages et quelques décors, rien qu’à toi.
          Choisis d’abord l’ambiance… puis regarde la magie opérer ✨
        </p>
        <div className="ambiance-row" role="group" aria-label="Ambiance">
          {AMBIANCES.map((a) => (
            <button key={a.id} className={ambiance === a.id ? 'ambiance-chip active' : 'ambiance-chip'} onClick={() => setAmbiance(a.id)}>
              <span className="ambiance-emoji">{a.emoji}</span>
              {a.label}
            </button>
          ))}
        </div>
        <button className="btn btn-primary btn-big" onClick={run}>Que la magie commence ✨</button>
        <button className="btn btn-ghost" onClick={onDone}>Passer</button>
      </div>
    )
  }

  const doneCount = steps.filter((s) => s.status === 'done' || s.status === 'fail').length

  return (
    <div className="ceremony">
      <h1>{phase === 'done' ? 'Ton monde est prêt ! 🎉' : '🪶 Plume peint ton monde…'}</h1>
      <p className="subtitle">
        {phase === 'done'
          ? 'Tu peux refaire une carte qui ne te plaît pas, ou entrer dans ton studio.'
          : `Encore un instant… (${doneCount}/${steps.length})`}
      </p>

      <div className="ceremony-grid">
        {steps.map((s, i) => (
          <div key={i} className={`ceremony-card status-${s.status}`}>
            <div className="ceremony-thumb">
              {s.assetId && getAssetUrl(s.assetId) ? (
                <img
                  className={`ceremony-img portrait-reveal ${s.kind === 'perso' ? 'fit-contain' : 'fit-cover'}`}
                  src={getAssetUrl(s.assetId)!}
                  alt={s.label}
                  onClick={() => phase === 'done' && setViewer(getAssetUrl(s.assetId!))}
                />
              ) : (
                <Silhouette kind={s.kind} />
              )}
              {s.status === 'painting' && (
                <div className="paint-overlay" aria-hidden>
                  <span className="paint-shimmer" />
                  <span className="paint-label">🪄</span>
                </div>
              )}
              {s.status === 'done' && (
                <div className="reveal-sparkles" aria-hidden>
                  {['✨', '⭐', '💫', '🌟'].map((x, k) => (
                    <span key={k} className={`sparkle sparkle-${k}`}>{x}</span>
                  ))}
                </div>
              )}
              {phase === 'done' && s.status !== 'painting' && (
                <button
                  className="ceremony-reroll"
                  title={s.status === 'fail' ? 'Réessayer' : 'Refaire — Plume proposera une image différente de celle-ci'}
                  onClick={() => {
                    if (s.status === 'fail' || window.confirm('Plume va peindre une toute nouvelle proposition, différente de celle-ci — continuer ?')) {
                      paintStep(i, s)
                    }
                  }}
                >
                  🔄
                </button>
              )}
            </div>
            <span className="ceremony-label">
              {s.emoji} {s.label}
              {s.status === 'fail' && <small> (à refaire)</small>}
            </span>
          </div>
        ))}
      </div>

      {phase === 'done' && (
        <button className="btn btn-primary btn-big" onClick={onDone}>Entrer dans mon studio →</button>
      )}

      {viewer && <PortraitViewer src={viewer} onClose={() => setViewer(null)} />}
    </div>
  )
}
