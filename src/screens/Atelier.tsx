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
import { deleteAsset, getAssetUrl, listAssets, saveAsset } from '../atelier/assets'
import { AIError, generateBackground, generateVideoClip, getAIConfig, quotaLeft } from '../atelier/genai'
import { DECOR_SEEDS } from '../data/starters'
import { isDebug } from '../debug'

const GENERATION_COST = 10

// tuiles d'aide pour composer un prompt sans page blanche
const TENUE_CHIPS: { label: string; words: string[] }[] = [
  { label: 'Type', words: ['une robe de bal', 'un sweat', 'un uniforme', 'une veste de scène', 'une tenue de princesse'] },
  { label: 'Couleur', words: ['bleu nuit', 'rose pâle', 'menthe', 'lavande', 'doré', 'corail'] },
  { label: 'Motif', words: ['avec des étoiles', 'avec des cœurs', 'avec des fleurs', 'avec des paillettes', 'à pois'] },
]
const POSTER_CHIPS: { label: string; words: string[] }[] = [
  { label: 'Thème', words: ['une lune', 'des étoiles', 'un cœur', 'une note de musique', 'un arc-en-ciel'] },
  { label: 'Couleur', words: ['lavande', 'rose', 'bleu ciel', 'doré', 'menthe'] },
]

interface Props {
  roster: Roster
  onBack: () => void
  initialCategory?: 'tenue' | 'poster' | 'decor' | 'clip'
}

export function Atelier({ roster, onBack, initialCategory = 'tenue' }: Props) {
  const [prompt, setPrompt] = useState('')
  const [category, setCategory] = useState<'tenue' | 'poster' | 'decor' | 'clip'>(initialCategory)
  const [busy, setBusy] = useState(false)
  const [busyMsg, setBusyMsg] = useState('La magie opère…')
  const [designs, setDesigns] = useState<Design[] | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [gems, setGems] = useState(() => getProgress().gems)
  const [wardrobe, setWardrobe] = useState(() => getWardrobe())
  const [aiUniverse, setAiUniverse] = useState('sakura')
  const [assets, setAssets] = useState(() => listAssets())
  const { toast, check } = useQuestToast()
  const self = roster.self?.config
  const ai = getAIConfig()

  const generateAI = async (kind: 'decor' | 'clip') => {
    const cost = kind === 'decor' ? 20 : 40
    if (!isDebug() && getProgress().gems < cost) {
      setMessage(`🪶 Il te faut ${cost} 💎 pour cette magie — accomplis des quêtes !`)
      return
    }
    setBusy(true)
    setBusyMsg(kind === 'decor' ? 'Gemini peint ton décor…' : 'Veo prépare le tournage…')
    setMessage(null)
    setDesigns(null)
    try {
      const blob =
        kind === 'decor'
          ? await generateBackground(prompt, aiUniverse)
          : await generateVideoClip(prompt, aiUniverse, setBusyMsg)
      if (!isDebug()) addReward(0, -cost)
      setGems(getProgress().gems)
      await saveAsset(
        {
          kind: kind === 'decor' ? 'image' : 'video',
          mime: blob.type,
          label: prompt.trim().slice(0, 40) || 'Ma création',
          prompt: prompt.trim(),
          universe: aiUniverse,
        },
        blob,
      )
      setAssets(listAssets())
      setMessage(
        kind === 'decor'
          ? '✨ Ton décor est prêt ! Retrouve-le dans la Tisseuse, choix du décor de chaque scène.'
          : '🎬 Ton clip est prêt ! Utilise-le comme décor animé d’une scène dans la Tisseuse.',
      )
    } catch (e) {
      const detail = e instanceof AIError && e.detail ? ` — détail : ${e.detail.slice(0, 200)}` : ''
      setMessage(`🪶 ${e instanceof Error ? e.message : 'La magie a raté, réessaie !'}${detail}`)
    } finally {
      setBusy(false)
    }
  }

  const generate = async () => {
    const problem = checkPrompt(prompt)
    if (problem) {
      setMessage(`🪶 ${problem}`)
      return
    }
    if (!isDebug() && getProgress().gems < GENERATION_COST) {
      setMessage(`🪶 Il te faut ${GENERATION_COST} 💎 pour une création — accomplis des quêtes !`)
      return
    }
    setBusy(true)
    setMessage(null)
    setDesigns(null)
    try {
      if (category !== 'tenue' && category !== 'poster') return
      const results = await localProvider.generate(prompt, category)
      if (!isDebug()) addReward(0, -GENERATION_COST)
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
          <button className={category === 'poster' ? 'tab active' : 'tab'} onClick={() => setCategory('poster')}>🖼️ Poster</button>
          <button className={category === 'decor' ? 'tab active' : 'tab'} onClick={() => setCategory('decor')}>🏞️ Décor IA</button>
          {(!ai || ai.provider === 'google') && (
            <button className={category === 'clip' ? 'tab active' : 'tab'} onClick={() => setCategory('clip')}>🎬 Clip IA</button>
          )}
        </div>

        {(category === 'decor' || category === 'clip') && !ai && (
          <p className="parents-warning">
            La grande magie IA (vrais décors peints, clips vidéo) demande une clé configurée par un
            parent dans l'<strong>Espace parents</strong> du studio.
          </p>
        )}
        {(category === 'decor' || category === 'clip') && ai && (
          <>
            <div className="atelier-tabs">
              {(['sakura', 'scene', 'royaumes'] as const).map((u) => (
                <button key={u} className={aiUniverse === u ? 'tab active' : 'tab'} onClick={() => setAiUniverse(u)}>
                  {u === 'sakura' ? '🌸 Sakura' : u === 'scene' ? '🎤 Scène' : '👑 Royaumes'}
                </button>
              ))}
            </div>
            {category === 'decor' && (
              <div className="seed-chips">
                <span className="seed-label">🪶 Idées de Plume :</span>
                {(DECOR_SEEDS[aiUniverse] ?? []).map((s) => (
                  <button key={s} className="seed-chip" onClick={() => setPrompt(s)}>{s}</button>
                ))}
              </div>
            )}
          </>
        )}

        <div className="atelier-input-row">
          <input
            className="name-input atelier-input"
            value={prompt}
            maxLength={100}
            placeholder={
              category === 'tenue'
                ? 'Une robe de bal bleu nuit avec des étoiles…'
                : category === 'poster'
                  ? 'Un poster lune couleur lavande…'
                  : category === 'decor'
                    ? 'La bibliothèque de l’école au coucher du soleil…'
                    : 'Des pétales qui tombent sur la cour déserte…'
            }
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !busy && (category === 'decor' || category === 'clip' ? ai && generateAI(category) : generate())}
          />
          {category === 'tenue' || category === 'poster' ? (
            <button className="btn btn-primary" disabled={busy} onClick={generate}>
              {busy ? '🪶 Plume dessine…' : `✨ Créer (${GENERATION_COST} 💎)`}
            </button>
          ) : (
            <button className="btn btn-primary" disabled={busy || !ai} onClick={() => generateAI(category)}>
              {busy ? '⏳…' : category === 'decor' ? '✨ Peindre (20 💎)' : '🎬 Tourner (40 💎)'}
            </button>
          )}
        </div>
        {(category === 'tenue' || category === 'poster') && (
          <div className="chip-help">
            {(category === 'tenue' ? TENUE_CHIPS : POSTER_CHIPS).map((grp) => (
              <div key={grp.label} className="chip-group">
                <span className="chip-group-label">{grp.label}</span>
                {grp.words.map((w) => (
                  <button key={w} className="seed-chip" onClick={() => setPrompt((p) => (p.trim() ? `${p.trim()} ${w}` : w).slice(0, 100))}>
                    {w}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
        {(category === 'decor' || category === 'clip') && ai && (
          <p className="hint">
            Reste aujourd'hui : {quotaLeft(ai, 'image')} image{quotaLeft(ai, 'image') > 1 ? 's' : ''} · {quotaLeft(ai, 'video')} clip{quotaLeft(ai, 'video') > 1 ? 's' : ''}
          </p>
        )}
        {message && <p className="room-message">{message}</p>}

        {busy && (
          <div className="atelier-busy">
            <span className="atelier-feather">🪶</span> {busyMsg}
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

      {assets.length > 0 && (
        <div className="card atelier-card">
          <h2>Tes décors et clips</h2>
          <div className="variant-row">
            {assets.map((a) => (
              <div key={a.id} className="variant-card">
                {a.kind === 'video' ? (
                  <video className="asset-thumb" src={getAssetUrl(a.id) ?? undefined} muted loop autoPlay playsInline />
                ) : (
                  <img className="asset-thumb" src={getAssetUrl(a.id) ?? undefined} alt={a.label} />
                )}
                <span className="wardrobe-label">{a.kind === 'video' ? '🎬 ' : ''}{a.label}</span>
                <button
                  className="btn btn-ghost"
                  onClick={async () => {
                    await deleteAsset(a.id)
                    setAssets(listAssets())
                  }}
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
          <p className="hint">Disponibles comme décors de scène dans la Tisseuse.</p>
        </div>
      )}

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
