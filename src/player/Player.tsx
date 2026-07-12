import { useMemo, useState } from 'react'
import type { Story, Choice } from '../engine/types'
import { advance, choose, formatText, startStory } from '../engine/interpreter'
import type { RuntimeState } from '../engine/interpreter'
import { Background } from '../universes/Background'
import { AvatarView } from '../avatar/AvatarView'
import type { Roster } from '../storage'
import { getEndingsFound, getStories, recordEnding } from '../storage'
import { addReward } from '../progression'
import { encodePostcard } from '../share'
import { useQuestToast } from '../ui/QuestToast'

interface Props {
  story: Story
  roster: Roster
  playerName: string
  onQuit: () => void
  /** playtest : démarrer à une scène précise */
  startLabel?: string
  /** playtest : révèle les options verrouillées et leurs conditions */
  debug?: boolean
  /** onboarding guidé : propose de tisser sa propre histoire à la fin */
  onWeaveInvite?: () => void
}

/** Explique pourquoi une option est verrouillée (mode playtest). */
function lockReason(c: import('../engine/types').Choice, names: Record<string, string>): string {
  const conds = [...(c.cond ? [c.cond] : []), ...(c.condAll ?? [])]
  return conds
    .map((cc) => {
      if (cc.var.startsWith('coeur_')) return `💗 ${names[cc.var.slice(6)] ?? cc.var.slice(6)} ≥ ${cc.gte ?? '?'}`
      return `🚩 ${cc.var}`
    })
    .join(' + ')
}

export function Player({ story, roster, playerName, onQuit, startLabel, debug, onWeaveInvite }: Props) {
  const [state, setState] = useState<RuntimeState>(() => startStory(story, startLabel))
  const [endingRecorded, setEndingRecorded] = useState(false)
  const [gemsWon, setGemsWon] = useState(0)
  const [postcardCopied, setPostcardCopied] = useState<string | null>(null)
  const { toast, check } = useQuestToast()

  const names = useMemo(() => {
    const n: Record<string, string> = {}
    for (const [id, ch] of Object.entries(story.characters)) {
      if (ch.isPlayer) n[id] = playerName
      else n[id] = roster[id]?.name ?? ch.name
    }
    return n
  }, [story, roster, playerName])

  const current = state.current

  if (current?.kind === 'end' && !endingRecorded) {
    const isNew = recordEnding(story.meta.id, current.ending.id)
    if (isNew) {
      addReward(10, 5)
      setGemsWon(5)
      check({ roster, stories: Object.values(getStories()) })
    } else {
      setGemsWon(0)
    }
    setEndingRecorded(true)
  }

  const sendPostcard = async (sticker: string) => {
    if (current?.kind !== 'end') return
    const code = encodePostcard({
      v: 1,
      storyId: story.meta.id,
      storyTitle: story.meta.title,
      endingId: current.ending.id,
      endingTitle: current.ending.title,
      sticker,
      from: playerName,
    })
    try {
      await navigator.clipboard.writeText(code)
      setPostcardCopied(sticker)
    } catch {
      window.prompt('Copie ce code et envoie-le à la créatrice :', code)
      setPostcardCopied(sticker)
    }
  }

  const handleAdvance = () => {
    if (current?.kind === 'say') setState(advance(story, state))
  }

  const handleChoice = (c: Choice) => {
    setState(choose(story, state, c))
  }

  const restart = () => {
    setEndingRecorded(false)
    setState(startStory(story, startLabel))
  }

  const speakerId = current?.kind === 'say' ? current.who ?? null : null
  const speaker = speakerId ? story.characters[speakerId] : null
  const speakerName = speakerId ? names[speakerId] : null

  const avatarFor = (who: string) => {
    if (story.characters[who]?.isPlayer) return roster.self?.config
    return roster[who]?.config ?? story.characters[who]?.defaultAvatar
  }
  const speakerConfig = speakerId ? avatarFor(speakerId) : null

  return (
    <div className="player" onClick={handleAdvance}>
      <div className="player-stage">
        <Background id={state.bg} />
        <div className="hearts-hud">
          {Object.entries(state.vars)
            .filter(([k, v]) => k.startsWith('coeur_') && typeof v === 'number')
            .map(([k, v]) => {
              const id = k.slice('coeur_'.length)
              const ch = story.characters[id]
              if (!ch) return null
              return (
                <span key={k} className="heart-badge" style={{ borderColor: ch.color ?? '#e35d7c' }}>
                  {names[id]} 💗{v as number}
                </span>
              )
            })}
        </div>
        <div className="sprites">
          {state.sprites.map((sp) => {
            const cfg = avatarFor(sp.who)
            if (!cfg) return null
            const mood = speakerId ? (sp.who === speakerId ? ' speaking' : ' dimmed') : ''
            return (
              <div key={sp.who} className={`sprite sprite-${sp.at}${mood}`}>
                <AvatarView config={cfg} expr={sp.expr} width="100%" />
              </div>
            )
          })}
        </div>

        {current?.kind === 'end' && (
          <div className="ending-overlay" onClick={(e) => e.stopPropagation()}>
            <div className="ending-card">
              <div className="ending-emoji">{current.ending.emoji}</div>
              <div className="ending-kicker">Fin débloquée</div>
              <h2>{current.ending.title}</h2>
              <p className="ending-progress">
                {getEndingsFound(story.meta.id).length} / {story.endings.length} fins découvertes
                {gemsWon > 0 && <span className="gems-won"> · +{gemsWon} 💎 !</span>}
              </p>
              <div className="ending-dots">
                {story.endings.map((e) => (
                  <span
                    key={e.id}
                    className={getEndingsFound(story.meta.id).includes(e.id) ? 'dot found' : 'dot'}
                    title={getEndingsFound(story.meta.id).includes(e.id) ? e.title : '???'}
                  >
                    {getEndingsFound(story.meta.id).includes(e.id) ? e.emoji : '❔'}
                  </span>
                ))}
              </div>
              {!debug && (
                <div className="postcard-box">
                  <span className="postcard-title">💌 Envoie une carte postale à la créatrice :</span>
                  <div className="postcard-stickers">
                    {['💖', '😂', '😱', '🌟', '👏'].map((s) => (
                      <button key={s} className={postcardCopied === s ? 'sticker-btn active' : 'sticker-btn'} onClick={() => sendPostcard(s)} aria-label={`Carte postale ${s}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                  {postcardCopied && <small>✓ Code copié ! Envoie-le-lui, elle l'importera dans son studio.</small>}
                </div>
              )}
              <div className="ending-actions">
                {onWeaveInvite && (
                  <button className="btn btn-primary" onClick={onWeaveInvite}>
                    🕸️ Et si TU décidais de la suite ?
                  </button>
                )}
                <button className={onWeaveInvite ? 'btn btn-ghost' : 'btn btn-primary'} onClick={restart}>
                  ↻ Rejouer pour une autre fin
                </button>
                <button className="btn btn-ghost" onClick={onQuit}>
                  Retour au studio
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="player-bottom" onClick={(e) => e.stopPropagation()}>
        {current?.kind === 'say' && (
          <div
            className="dialogue"
            onClick={handleAdvance}
            style={speaker?.color ? { borderColor: speaker.color } : undefined}
          >
            {speakerName ? (
              <div className="speaker-tag">
                {speakerConfig && (
                  <span className="mini-face" style={{ borderColor: speaker?.color ?? '#e35d7c' }}>
                    <AvatarView config={speakerConfig} expr={state.sprites.find((s) => s.who === speakerId)?.expr ?? 'neutre'} width={92} />
                  </span>
                )}
                <span className="nametag" style={{ background: speaker?.color ?? '#e35d7c' }}>
                  {speakerName}
                </span>
              </div>
            ) : (
              <div className="speaker-tag">
                <span className="nametag nametag-narrator">✧ l'histoire</span>
              </div>
            )}
            <p>{formatText(current.text, names)}</p>
            <span className="advance-hint">▼</span>
          </div>
        )}

        {current?.kind === 'menu' && (
          <div className="choices">
            <div className="choices-title">Que fais-tu ?</div>
            {current.options.map((o, i) =>
              o.locked ? (
                <button key={i} className="choice-btn choice-locked" disabled title={debug ? undefined : 'Il te manque quelque chose pour débloquer ce choix…'}>
                  <span>{debug ? `🔒 ${formatText(o.choice.text, names)}` : '🔒 Option secrète…'}</span>
                  {debug && <span className="choice-impact">{lockReason(o.choice, names)}</span>}
                </button>
              ) : (
                <button key={i} className="choice-btn" onClick={() => handleChoice(o.choice)}>
                  <span>{formatText(o.choice.text, names)}</span>
                  {o.choice.impact && <span className="choice-impact">{o.choice.impact}</span>}
                </button>
              ),
            )}
            {current.options.every((o) => o.locked) && (
              <button className="choice-btn" onClick={() => handleChoice({ ...current.options[0].choice, effects: undefined })}>
                <span>Continuer…</span>
              </button>
            )}
          </div>
        )}
      </div>

      <button className="player-quit btn-ghost" aria-label="Quitter l'histoire" onClick={(e) => { e.stopPropagation(); onQuit() }}>
        ✕
      </button>
      {toast}
    </div>
  )
}
