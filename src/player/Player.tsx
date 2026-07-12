import { useMemo, useState } from 'react'
import type { Story, Choice } from '../engine/types'
import { advance, choose, formatText, startStory } from '../engine/interpreter'
import type { RuntimeState } from '../engine/interpreter'
import { Background } from '../universes/Background'
import { AvatarView } from '../avatar/AvatarView'
import type { Roster } from '../storage'
import { getEndingsFound, recordEnding } from '../storage'

interface Props {
  story: Story
  roster: Roster
  playerName: string
  onQuit: () => void
  /** playtest : démarrer à une scène précise */
  startLabel?: string
}

export function Player({ story, roster, playerName, onQuit, startLabel }: Props) {
  const [state, setState] = useState<RuntimeState>(() => startStory(story, startLabel))
  const [endingRecorded, setEndingRecorded] = useState(false)

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
    recordEnding(story.meta.id, current.ending.id)
    setEndingRecorded(true)
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

  const speaker = current?.kind === 'say' && current.who ? story.characters[current.who] : null
  const speakerName = current?.kind === 'say' && current.who ? names[current.who] : null

  const avatarFor = (who: string) => {
    if (story.characters[who]?.isPlayer) return roster.self?.config
    return roster[who]?.config ?? story.characters[who]?.defaultAvatar
  }

  return (
    <div className="player" onClick={handleAdvance}>
      <div className="player-stage">
        <Background id={state.bg} />
        <div className="sprites">
          {state.sprites.map((sp) => {
            const cfg = avatarFor(sp.who)
            if (!cfg) return null
            return (
              <div key={sp.who} className={`sprite sprite-${sp.at}`}>
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
              <div className="ending-actions">
                <button className="btn btn-primary" onClick={restart}>
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
          <div className="dialogue" onClick={handleAdvance}>
            {speakerName ? (
              <div className="nametag" style={{ background: speaker?.color ?? '#e35d7c' }}>
                {speakerName}
              </div>
            ) : (
              <div className="nametag nametag-narrator">✧</div>
            )}
            <p>{formatText(current.text, names)}</p>
            <span className="advance-hint">▼</span>
          </div>
        )}

        {current?.kind === 'menu' && (
          <div className="choices">
            <div className="choices-title">Que fais-tu ?</div>
            {current.choices.map((c, i) => (
              <button key={i} className="choice-btn" onClick={() => handleChoice(c)}>
                <span>{formatText(c.text, names)}</span>
                {c.impact && <span className="choice-impact">{c.impact}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <button className="player-quit btn-ghost" onClick={(e) => { e.stopPropagation(); onQuit() }}>
        ✕
      </button>
    </div>
  )
}
