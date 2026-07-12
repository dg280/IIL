import { useMemo, useRef, useState } from 'react'
import { AvatarView } from '../avatar/AvatarView'
import { UNIVERSES } from '../universes'
import type { Roster } from '../storage'
import { deleteStory, getEndingsFound, getStories } from '../storage'
import { demoStory } from '../data/demoStory'
import type { AuthoredStory } from '../builder/types'
import { QUESTS, evaluateQuests, getProgress, levelFor } from '../progression'
import { RoomView } from '../room/RoomView'
import { getRoom } from '../room/room'
import { decodePostcard, downloadBundle, encodeBundle, importBundle, isPostcardCode, makeBundle, parseBundle, scanPII } from '../share'
import { addPostcard, getPostcards } from '../storage'
import { addReward } from '../progression'
import { compileStory } from '../builder/compile'
import { downloadBlob, exportRenpyZip } from '../renpy/export'
import type { Story } from '../engine/types'

interface Props {
  playerName: string
  roster: Roster
  onPlayDemo: () => void
  onPlayStory: (story: AuthoredStory) => void
  onWeave: (story: AuthoredStory) => void
  onNewStory: () => void
  onEditCharacter: (id: string) => void
  onNewCharacter: () => void
  onOpenRoom: () => void
  onOpenAtelier: () => void
  onRefresh: () => void
}

export function Studio({ playerName, roster, onPlayDemo, onPlayStory, onWeave, onNewStory, onEditCharacter, onNewCharacter, onOpenRoom, onOpenAtelier, onRefresh }: Props) {
  const stories = Object.values(getStories())

  const freshQuests = useMemo(
    () => evaluateQuests({ roster, stories }),
    // évalué à chaque retour au studio
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const progress = getProgress()
  const { current: level, next } = levelFor(progress.xp)

  const [shareStory, setShareStory] = useState<AuthoredStory | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)

  const foundDemo = getEndingsFound(demoStory.meta.id)
  const uniDemo = UNIVERSES.find((u) => u.id === demoStory.meta.universe)

  const exportRenpy = async (story: Story, filename: string) => {
    setExporting(story.meta.id)
    try {
      const blob = await exportRenpyZip(story, playerName, roster)
      downloadBlob(blob, filename)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="studio">
      <div className="petals" aria-hidden>
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className="petal" style={{ left: `${(i * 8.5) % 100}%`, animationDelay: `${i * 1.7}s`, animationDuration: `${9 + (i % 5) * 2}s` }} />
        ))}
      </div>

      <header className="studio-header">
        <h1>
          Le studio de <span className="accent">{playerName}</span>
        </h1>
        <div className="progress-bar-row">
          <span className="level-chip">{level.emoji} {level.title}</span>
          {next && (
            <span className="xp-track" title={`${progress.xp} XP — prochain titre à ${next.xp} XP`}>
              <span className="xp-fill" style={{ width: `${Math.min(100, (progress.xp / next.xp) * 100)}%` }} />
            </span>
          )}
          <span className="gems-chip">💎 {progress.gems}</span>
        </div>
      </header>

      {freshQuests.length > 0 && (
        <div className="quest-banner card">
          🎉 Quête{freshQuests.length > 1 ? 's' : ''} accomplie{freshQuests.length > 1 ? 's' : ''} :{' '}
          {freshQuests.map((q) => `${q.emoji} ${q.title} (+${q.gems} 💎)`).join(' · ')}
        </div>
      )}

      <main className="studio-grid">
        <section className="card">
          <div className="stories-head">
            <h2>Mes histoires</h2>
            <div className="stories-actions">
              <button className="btn btn-ghost" onClick={() => setShowImport(true)}>📥 Importer</button>
              <button className="btn btn-primary" onClick={onNewStory}>＋ Nouvelle histoire</button>
            </div>
          </div>
          <div className="stories-row">
            <div className="story-tile" style={{ borderColor: uniDemo?.color }}>
              <span className="story-uni" style={{ background: uniDemo?.color }}>
                {uniDemo?.emoji} {uniDemo?.name}
              </span>
              <strong>{demoStory.meta.title}</strong>
              <small>Histoire d'exemple · {foundDemo.length}/{demoStory.endings.length} fins {demoStory.endings.map((e) => (foundDemo.includes(e.id) ? e.emoji : '❔')).join(' ')}</small>
              <div className="story-actions">
                <button className="btn btn-primary" onClick={onPlayDemo}>▶ Jouer</button>
                <button
                  className="btn btn-ghost"
                  disabled={exporting === demoStory.meta.id}
                  onClick={() => exportRenpy(demoStory, 'le-secret-du-cerisier-renpy.zip')}
                >
                  {exporting === demoStory.meta.id ? '⏳…' : '🎮 Ren\'Py'}
                </button>
              </div>
            </div>
            {stories.map((s) => {
              const uni = UNIVERSES.find((u) => u.id === s.universe)
              const found = getEndingsFound(s.id)
              const finCount = Object.values(s.scenes).filter((sc) => sc.outcome.kind === 'fin').length
              const cards = getPostcards().filter((c) => c.storyId === s.id)
              return (
                <div key={s.id} className="story-tile" style={{ borderColor: uni?.color }}>
                  <span className="story-uni" style={{ background: uni?.color }}>
                    {uni?.emoji} {uni?.name}
                  </span>
                  <strong>{s.title}</strong>
                  <small>
                    {Object.keys(s.scenes).length} scènes · {finCount} fin{finCount > 1 ? 's' : ''} · {found.length} trouvée{found.length > 1 ? 's' : ''}
                    {cards.length > 0 && (
                      <span title={cards.map((c) => `${c.from} ${c.sticker} (${c.endingTitle})`).join('\n')}>
                        {' '}· 💌 {cards.length} carte{cards.length > 1 ? 's' : ''} {cards.slice(0, 4).map((c) => c.sticker).join('')}
                      </span>
                    )}
                  </small>
                  <div className="story-actions">
                    <button className="btn btn-primary" onClick={() => onPlayStory(s)}>▶ Jouer</button>
                    <button className="btn btn-ghost" onClick={() => onWeave(s)}>🕸️ Tisser</button>
                    <button className="btn btn-ghost" onClick={() => setShareStory(s)}>💌 Partager</button>
                    <button
                      className="btn btn-ghost"
                      disabled={exporting === s.id}
                      onClick={() => exportRenpy(compileStory(s, roster), `${s.id}-renpy.zip`)}
                    >
                      {exporting === s.id ? '⏳…' : '🎮'}
                    </button>
                    <button
                      className="btn btn-ghost"
                      title="Supprimer"
                      onClick={() => {
                        if (window.confirm(`Supprimer « ${s.title} » ? Cette histoire sera perdue.`)) {
                          deleteStory(s.id)
                          onRefresh()
                        }
                      }}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <div className="studio-duo">
          <section className="card room-card">
            <h2>Ta chambre</h2>
            <button className="room-thumb" onClick={onOpenRoom} title="Décorer ma chambre">
              <RoomView room={getRoom()} avatar={roster.self?.config} className="room-thumb-svg" />
            </button>
            <button className="btn btn-primary" onClick={onOpenRoom}>🎀 Décorer</button>
          </section>

          <section className="card quests-card">
            <h2>Quêtes créatives</h2>
            <ul className="quest-list">
              {QUESTS.map((q) => {
                const done = progress.done.includes(q.id)
                return (
                  <li key={q.id} className={done ? 'done' : ''}>
                    <span className="quest-emoji">{done ? '✅' : q.emoji}</span>
                    <span className="quest-text">
                      <strong>{q.title}</strong>
                      <small>{q.desc}</small>
                    </span>
                    <span className="quest-reward">+{q.gems} 💎</span>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>

        <section className="card characters-card">
          <h2>Les personnages</h2>
          <p className="hint">Touche un personnage pour changer sa coiffure, sa tenue, tout !</p>
          <div className="char-row">
            {Object.entries(roster)
              .sort(([a], [b]) => (a === 'self' ? -1 : b === 'self' ? 1 : 0))
              .map(([id, entry]) => (
                <button key={id} className="char-tile" onClick={() => onEditCharacter(id)}>
                  <AvatarView config={entry.config} expr={id === 'self' ? 'joie' : 'neutre'} width="100%" />
                  <span className="char-name">{id === 'self' ? `${entry.name} (toi !)` : entry.name}</span>
                  <span className="char-edit">✏️ Personnaliser</span>
                </button>
              ))}
            <button className="char-tile char-new" onClick={onNewCharacter}>
              <span className="char-new-plus">＋</span>
              <span className="char-name">Nouveau personnage</span>
              <span className="char-edit">Invente quelqu'un !</span>
            </button>
          </div>
        </section>

        <section className="card atelier-promo" onClick={onOpenAtelier} role="button">
          <div className="atelier-promo-text">
            <h2>L'Atelier magique</h2>
            <p>Décris une tenue ou un poster à Plume… et elle le dessine ! « Une robe de bal bleu nuit avec des étoiles… »</p>
          </div>
          <button className="btn btn-primary" onClick={onOpenAtelier}>Entrer</button>
        </section>

        <section className="card locked-card">
          <h2>La suite de l'aventure</h2>
          <div className="locked-row">
            <div className="locked-tile">
              <span className="locked-emoji">🏘️</span>
              <strong>Le Village</strong>
              <small>Les avatars de tes amies vivent ensemble</small>
              <span className="locked-badge">🔒 v2</span>
            </div>
          </div>
        </section>
      </main>

      {shareStory && (
        <ShareModal story={shareStory} roster={roster} playerName={playerName} onClose={() => setShareStory(null)} />
      )}
      {showImport && (
        <ImportModal
          roster={roster}
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false)
            onRefresh()
          }}
        />
      )}
    </div>
  )
}

function ShareModal({ story, roster, playerName, onClose }: { story: AuthoredStory; roster: Roster; playerName: string; onClose: () => void }) {
  const pii = useMemo(() => scanPII(story), [story])
  const bundle = useMemo(() => makeBundle(story, roster, playerName), [story, roster, playerName])
  const code = useMemo(() => (pii ? '' : encodeBundle(bundle)), [bundle, pii])
  const [copied, setCopied] = useState(false)

  if (pii) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="card modal" onClick={(e) => e.stopPropagation()}>
          <h2>🪶 Oh là, attends !</h2>
          <p>
            Plume a repéré <strong>{pii}</strong> dans ton histoire. On ne partage jamais de vraies
            informations personnelles — remplace-la par quelque chose d'inventé, et on l'envoie !
          </p>
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={onClose}>D'accord, je corrige</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <h2>Partager « {story.title} »</h2>
        <p className="hint">
          Envoie ce code à une copine : dans son studio, elle clique sur « 📥 Importer », le colle,
          et ton histoire (avec tes personnages !) apparaît chez elle.
        </p>
        <textarea className="share-code" readOnly value={code} rows={5} onFocus={(e) => e.target.select()} />
        <div className="modal-actions">
          <button
            className="btn btn-primary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(code)
                setCopied(true)
              } catch {
                setCopied(false)
              }
            }}
          >
            {copied ? '✓ Copié !' : '📋 Copier le code'}
          </button>
          <button className="btn btn-ghost" onClick={() => downloadBundle(bundle)}>💾 Fichier</button>
          <button className="btn btn-ghost" onClick={onClose}>Fermer</button>
        </div>
        <p className="share-warning">🪶 Plume rappelle : pas de vrai nom de famille, d'école ou d'adresse dans les histoires partagées !</p>
      </div>
    </div>
  )
}

function ImportModal({ roster, onClose, onImported }: { roster: Roster; onClose: () => void; onImported: () => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const doImport = (raw: string) => {
    try {
      if (isPostcardCode(raw)) {
        const card = decodePostcard(raw)
        const isNew = addPostcard({ storyId: card.storyId, endingId: card.endingId, endingTitle: card.endingTitle, sticker: card.sticker, from: card.from })
        if (isNew) {
          addReward(3, 3)
          setSuccess(`💌 ${card.from || 'Une copine'} a trouvé la fin « ${card.endingTitle} » de « ${card.storyTitle} » et t'envoie ${card.sticker} — +3 💎 !`)
        } else {
          setSuccess('Tu as déjà reçu cette carte postale 💌')
        }
        setCode('')
        return
      }
      const bundle = parseBundle(raw)
      const story = importBundle(bundle, roster)
      setSuccess(`✨ « ${story.title} »${bundle.authorPseudo ? ` de ${bundle.authorPseudo}` : ''} a rejoint tes histoires !`)
      setCode('')
      window.setTimeout(onImported, 1400)
    } catch {
      setError("Hmm, ce code ne ressemble pas à une histoire Célestine. Vérifie qu'il est copié en entier !")
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <h2>Importer</h2>
        <p className="hint">Colle ici un code d'histoire (CEL1.) ou une carte postale (CELR1.) qu'une copine t'a envoyé.</p>
        {success && <p className="room-message">{success}</p>}
        <textarea
          className="share-code"
          value={code}
          rows={5}
          placeholder="CEL1.…"
          onChange={(e) => {
            setCode(e.target.value)
            setError(null)
          }}
        />
        {error && <p className="import-error">{error}</p>}
        <div className="modal-actions">
          <button className="btn btn-primary" disabled={!code.trim()} onClick={() => doImport(code)}>
            ✨ Importer
          </button>
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>📂 Ouvrir un fichier</button>
          <button className="btn btn-ghost" onClick={onClose}>Fermer</button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (f) doImport(await f.text())
          }}
        />
      </div>
    </div>
  )
}
