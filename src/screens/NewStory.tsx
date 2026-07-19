import { useEffect, useState } from 'react'
import { UNIVERSES } from '../universes'
import type { UniverseId } from '../universes'
import { TEMPLATES } from '../builder/types'
import type { TemplateId } from '../builder/types'
import { AvatarView } from '../avatar/AvatarView'
import type { Roster } from '../storage'
import { getPreferredUniverse } from '../storage'
import { hasAI, suggestIdeas } from '../atelier/genai'
import { getAssetMeta } from '../atelier/assets'

interface Props {
  roster: Roster
  onCreate: (title: string, universe: UniverseId, template: TemplateId, characters: string[]) => void
  onCancel: () => void
}

export function NewStory({ roster, onCreate, onCancel }: Props) {
  const [title, setTitle] = useState('')
  const [universe, setUniverse] = useState<UniverseId>(getPreferredUniverse() as UniverseId)
  const [template, setTemplate] = useState<TemplateId>('secret')
  // seuls les persos dessinés (universels) ou générés pour CET univers peuvent rejoindre l'histoire
  const available = Object.keys(roster).filter((id) => {
    if (id === 'self') return false
    const entry = roster[id]
    if (!entry.portraitAsset) return true
    const u = getAssetMeta(entry.portraitAsset)?.universe
    return !u || u === universe
  })
  const [chars, setChars] = useState<string[]>(available.slice(0, 2))
  const [ideas, setIdeas] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)

  // en changeant d'univers, retire les persos qui n'existent que dans l'ancien
  useEffect(() => {
    setChars((cs) => cs.filter((id) => available.includes(id)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universe])

  const askPlume = async () => {
    setBusy(true)
    setIdeas(null)
    const uni = UNIVERSES.find((u) => u.id === universe)
    try {
      const items = await suggestIdeas(
        `Tu es Plume, une mascotte qui aide une enfant de 11 ans à inventer un otome game (histoire d'amitié/romance douce, adaptée aux enfants). Réponds en français, 3 titres d'histoire courts et jolis, un par ligne, sans numéro.`,
        `Propose 3 titres d'histoire dans l'univers « ${uni?.name} » (${uni?.tagline}).`,
      )
      setIdeas(items)
    } catch {
      setIdeas([])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="newstory">
      <div className="card newstory-card">
        <header className="maker-header">
          <button className="btn btn-ghost" onClick={onCancel}>← Retour</button>
          <h1>Nouvelle histoire</h1>
        </header>

        <h3>Son titre</h3>
        <input className="name-input" value={title} maxLength={40} placeholder="Le titre de ton histoire…" onChange={(e) => setTitle(e.target.value)} />
        {hasAI() && (
          <div className="seed-chips">
            <button className="btn btn-ghost" disabled={busy} onClick={askPlume}>
              {busy ? '🪶 Plume réfléchit…' : '🪶 Plume invente un titre'}
            </button>
            {ideas?.map((t) => (
              <button key={t} className="seed-chip" onClick={() => setTitle(t)}>{t}</button>
            ))}
            {ideas?.length === 0 && <span className="hint">Plume n’a pas trouvé — réessaie !</span>}
          </div>
        )}

        <h3>Son univers</h3>
        <div className="uni-row">
          {UNIVERSES.map((u) => (
            <button key={u.id} className={universe === u.id ? 'uni-tile uni-select active' : 'uni-tile uni-select'} style={{ borderColor: u.color }} onClick={() => setUniverse(u.id)}>
              <span className="uni-emoji">{u.emoji}</span>
              <strong>{u.name}</strong>
              <small>{u.tagline}</small>
            </button>
          ))}
        </div>

        <h3>Son point de départ</h3>
        <div className="uni-row">
          {TEMPLATES.map((t) => (
            <button key={t.id} className={template === t.id ? 'uni-tile uni-select active' : 'uni-tile uni-select'} style={{ borderColor: '#c9a8f0' }} onClick={() => setTemplate(t.id)}>
              <span className="uni-emoji">{t.emoji}</span>
              <strong>{t.label}</strong>
              <small>{t.desc}</small>
            </button>
          ))}
        </div>

        <h3>Ses personnages (en plus de toi)</h3>
        <div className="char-row">
          {available.map((id) => {
            const entry = roster[id]
            const on = chars.includes(id)
            return (
              <button key={id} className={on ? 'char-tile char-select on' : 'char-tile char-select'} onClick={() => setChars(on ? chars.filter((c) => c !== id) : [...chars, id])}>
                <AvatarView config={entry.config} expr={on ? 'joie' : 'neutre'} width="100%" />
                <span className="char-name">{entry.name}</span>
                <span className="char-edit">{on ? '✓ dans l’histoire' : '＋ ajouter'}</span>
              </button>
            )
          })}
        </div>

        <button className="btn btn-primary btn-big btn-save" disabled={!title.trim()} onClick={() => onCreate(title.trim(), universe, template, chars)}>
          🕸️ Tisser cette histoire !
        </button>
      </div>
    </div>
  )
}
