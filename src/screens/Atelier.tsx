import { useState } from 'react'
import { AvatarView } from '../avatar/AvatarView'
import { MotifGlyph } from '../avatar/Motifs'
import type { Design, OutfitDesign, PosterDesign } from '../atelier/generator'
import { checkPrompt, localProvider } from '../atelier/generator'
import { getWardrobe, removeFromWardrobe, saveToWardrobe } from '../atelier/wardrobe'
import { addReward, getProgress } from '../progression'
import { getRoom, saveRoom } from '../room/room'
import type { Roster } from '../storage'
import { getStories } from '../storage'
import { useQuestToast } from '../ui/QuestToast'

const GENERATION_COST = 10

interface Props {
  roster: Roster
  onBack: () => void
}

export function Atelier({ roster, onBack }: Props) {
  const [prompt, setPrompt] = useState('')
  const [category, setCategory] = useState<'tenue' | 'poster'>('tenue')
  const [busy, setBusy] = useState(false)
  const [designs, setDesigns] = useState<Design[] | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [gems, setGems] = useState(() => getProgress().gems)
  const [wardrobe, setWardrobe] = useState(() => getWardrobe())
  const { toast, check } = useQuestToast()
  const self = roster.self?.config

  const generate = async () => {
    const problem = checkPrompt(prompt)
    if (problem) {
      setMessage(`🪶 ${problem}`)
      return
    }
    if (getProgress().gems < GENERATION_COST) {
      setMessage(`🪶 Il te faut ${GENERATION_COST} 💎 pour une création — accomplis des quêtes !`)
      return
    }
    setBusy(true)
    setMessage(null)
    setDesigns(null)
    try {
      const results = await localProvider.generate(prompt, category)
      addReward(0, -GENERATION_COST)
      setGems(getProgress().gems)
      setDesigns(results)
    } finally {
      setBusy(false)
    }
  }

  const keepOutfit = (d: OutfitDesign) => {
    const label = prompt.trim().slice(0, 40) || 'Ma création'
    saveToWardrobe(d, label)
    setWardrobe(getWardrobe())
    setMessage(`✨ « ${label} » rejoint ta garde-robe ! Retrouve-la dans l'atelier des personnages, onglet Tenue.`)
    setDesigns(null)
    check({ roster, stories: Object.values(getStories()) })
  }

  const keepPoster = (d: PosterDesign) => {
    const room = getRoom()
    saveRoom({ ...room, poster: null, posterCustom: { motif: d.motif, background: d.background } })
    setMessage('✨ Ton poster est accroché dans ta chambre !')
    setDesigns(null)
  }

  return (
    <div className="atelier">
      <header className="maker-header">
        <button className="btn btn-ghost" onClick={onBack}>← Studio</button>
        <h1>L'Atelier magique</h1>
        <span className="gems-chip">💎 {gems}</span>
      </header>

      <div className="card atelier-card">
        <p className="hint">
          Décris ta création à Plume : elle comprend les couleurs (« bleu nuit », « menthe »…), les
          motifs (étoiles, cœurs, fleurs, éclairs…) et le style (robe de bal, veste de scène, sweat…).
        </p>
        <div className="atelier-tabs">
          <button className={category === 'tenue' ? 'tab active' : 'tab'} onClick={() => setCategory('tenue')}>👗 Tenue</button>
          <button className={category === 'poster' ? 'tab active' : 'tab'} onClick={() => setCategory('poster')}>🖼️ Poster de chambre</button>
        </div>
        <div className="atelier-input-row">
          <input
            className="name-input atelier-input"
            value={prompt}
            maxLength={100}
            placeholder={category === 'tenue' ? 'Une robe de bal bleu nuit avec des étoiles…' : 'Un poster lune couleur lavande…'}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !busy && generate()}
          />
          <button className="btn btn-primary" disabled={busy} onClick={generate}>
            {busy ? '🪶 Plume dessine…' : `✨ Créer (${GENERATION_COST} 💎)`}
          </button>
        </div>
        {message && <p className="room-message">{message}</p>}

        {busy && (
          <div className="atelier-busy">
            <span className="atelier-feather">🪶</span> La magie opère…
          </div>
        )}

        {designs && (
          <div className="variant-row">
            {designs.map((d, i) => (
              <div key={i} className="variant-card">
                {d.kind === 'tenue' && self ? (
                  <AvatarView
                    config={{ ...self, outfit: d.outfit, outfitColor: d.outfitColor, outfitColor2: d.outfitColor2, motif: d.motif }}
                    expr="joie"
                    width="100%"
                  />
                ) : d.kind === 'poster' ? (
                  <svg viewBox="0 0 110 140" width="100%">
                    <rect width="110" height="140" rx="8" fill={d.background} stroke="#e5cfdc" strokeWidth="4" />
                    <g transform="translate(55,70) scale(6)">
                      <MotifGlyph kind={d.motif.kind} color={d.motif.color} />
                    </g>
                    <g transform="translate(25,30) scale(2.4)"><MotifGlyph kind={d.motif.kind} color={d.motif.color} /></g>
                    <g transform="translate(85,105) scale(2.4)"><MotifGlyph kind={d.motif.kind} color={d.motif.color} /></g>
                  </svg>
                ) : null}
                <button className="btn btn-primary" onClick={() => (d.kind === 'tenue' ? keepOutfit(d) : keepPoster(d))}>
                  💾 Garder
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {wardrobe.length > 0 && (
        <div className="card atelier-card">
          <h2>Ta garde-robe magique</h2>
          <div className="variant-row">
            {wardrobe.map((w) => (
              <div key={w.id} className="variant-card">
                {self && (
                  <AvatarView
                    config={{ ...self, outfit: w.outfit, outfitColor: w.outfitColor, outfitColor2: w.outfitColor2, motif: w.motif }}
                    expr="neutre"
                    width="100%"
                  />
                )}
                <span className="wardrobe-label">{w.label}</span>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    removeFromWardrobe(w.id)
                    setWardrobe(getWardrobe())
                  }}
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
          <p className="hint">Ces tenues sont disponibles pour TOUS tes personnages, dans l'onglet Tenue de leur atelier.</p>
        </div>
      )}
      {toast}
    </div>
  )
}
