import { useRef, useState } from 'react'
import type { UniverseId } from '../universes'
import { UNIVERSES } from '../universes'
import { PLUME_STARTERS, DECOR_SEEDS } from '../data/starters'
import { generateBackground, generateCharacterPortrait } from '../atelier/genai'
import { getAssetUrl, saveAsset } from '../atelier/assets'
import { saveRosterEntry } from '../storage'
import { AvatarView } from '../avatar/AvatarView'
import type { AvatarConfig } from '../avatar/types'

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
  /** perso : config paper-doll de secours */
  config?: AvatarConfig
  /** id d'asset une fois peint */
  assetId?: string
  status: StepStatus
}

/**
 * Cérémonie de bienvenue : Plume (LiberTai) peint sous les yeux de l'enfant les
 * 3 premiers personnages et quelques décors de l'univers choisi. Les portraits
 * et décors sont donc de vrais assets IA (cohérents grâce à STYLE_BASE), offerts
 * — la cérémonie ne coûte pas de gemmes. En cas d'échec ponctuel, on retombe sur
 * le paper-doll (perso) ou on saute le décor : la cérémonie se termine toujours.
 */
export function Ceremony({ universe, onDone }: Props) {
  const uni = UNIVERSES.find((u) => u.id === universe)
  const buildSteps = (): Step[] => [
    ...PLUME_STARTERS.map((s) => ({
      kind: 'perso' as const,
      label: s.name,
      emoji: s.emoji,
      descr: s.descr,
      config: s.config,
      status: 'wait' as StepStatus,
    })),
    ...(DECOR_SEEDS[universe] ?? []).slice(0, 3).map((d) => ({
      kind: 'decor' as const,
      label: d.length > 34 ? d.slice(0, 32) + '…' : d,
      emoji: '🏞️',
      descr: d,
      status: 'wait' as StepStatus,
    })),
  ]

  const [steps, setSteps] = useState<Step[]>(buildSteps)
  const [phase, setPhase] = useState<'intro' | 'running' | 'done'>('intro')
  const started = useRef(false)

  const patch = (i: number, p: Partial<Step>) => setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, ...p } : s)))

  const run = async () => {
    if (started.current) return
    started.current = true
    setPhase('running')
    const current = buildSteps()
    let persoN = 0
    for (let i = 0; i < current.length; i++) {
      const step = current[i]
      patch(i, { status: 'painting' })
      try {
        if (step.kind === 'perso') {
          persoN++
          const blob = await generateCharacterPortrait(step.descr, universe)
          const asset = await saveAsset({ kind: 'image', mime: blob.type, label: `Portrait de ${step.label}`, prompt: step.descr, universe }, blob)
          saveRosterEntry(`perso${persoN}`, { name: step.label, config: step.config!, portraitAsset: asset.id })
          patch(i, { status: 'done', assetId: asset.id })
        } else {
          const blob = await generateBackground(step.descr, universe)
          await saveAsset({ kind: 'image', mime: blob.type, label: step.descr, prompt: step.descr, universe }, blob)
          patch(i, { status: 'done' })
        }
      } catch {
        if (step.kind === 'perso') {
          // le personnage existe quand même, avec son dessin de secours
          saveRosterEntry(`perso${persoN}`, { name: step.label, config: step.config! })
        }
        patch(i, { status: 'fail' })
      }
    }
    setPhase('done')
  }

  if (phase === 'intro') {
    return (
      <div className="ceremony ceremony-intro">
        <div className="ceremony-orb" aria-hidden>🪶</div>
        <h1>La grande cérémonie</h1>
        <p className="subtitle">
          Bienvenue dans <strong>{uni?.name}</strong> !
        </p>
        <p className="ceremony-lead">
          Plume va peindre pour toi tes premiers personnages et quelques décors, rien qu’à toi.
          Regarde bien… la magie va opérer ✨
        </p>
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
          ? 'Tes personnages t’attendent dans le studio. Tu pourras en créer d’autres et repeindre ceux-ci quand tu veux.'
          : `Encore un instant… (${doneCount}/${steps.length})`}
      </p>

      <div className="ceremony-grid">
        {steps.map((s, i) => (
          <div key={i} className={`ceremony-card status-${s.status}`}>
            <div className="ceremony-thumb">
              {s.assetId && getAssetUrl(s.assetId) ? (
                <img className="ceremony-img portrait-reveal" src={getAssetUrl(s.assetId)!} alt={s.label} />
              ) : s.kind === 'perso' && s.config ? (
                <AvatarView config={s.config} expr={s.status === 'done' ? 'joie' : 'neutre'} width="100%" />
              ) : (
                <span className="ceremony-emoji">{s.emoji}</span>
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
            </div>
            <span className="ceremony-label">
              {s.emoji} {s.label}
              {s.status === 'fail' && s.kind === 'perso' && <small> (dessin de secours)</small>}
            </span>
          </div>
        ))}
      </div>

      {phase === 'done' && (
        <button className="btn btn-primary btn-big" onClick={onDone}>Entrer dans mon studio →</button>
      )}
    </div>
  )
}
