import { useState } from 'react'
import { AvatarView } from '../avatar/AvatarView'
import { getWardrobe, removeFromWardrobe } from '../atelier/wardrobe'
import { addReward, getProgress } from '../progression'
import { getRoom, saveRoom } from '../room/room'
import type { Roster } from '../storage'
import { getPreferredUniverse, getStories } from '../storage'
import { useQuestToast } from '../ui/QuestToast'
import { deleteAsset, getAssetUrl, listDecorAssets, saveAsset } from '../atelier/assets'
import { AIError, generateBackground, generateVideoClip, getAIConfig, quotaLeft } from '../atelier/genai'
import { DECOR_SEEDS } from '../data/starters'
import { isDebug } from '../debug'
import { KEYWORD_PACKS, hasPack, unlockPack } from '../premium'
import { PortraitViewer } from '../ui/PortraitViewer'

const GENERATION_COST = 10

// Poster : composé en touchant, sans champ texte.
const BASE_COLORS = ['bleu nuit', 'rose pâle', 'menthe', 'lavande', 'doré', 'corail', 'blanc', 'noir']
const POSTER_THEMES = ['une lune', 'des étoiles', 'un cœur', 'une note de musique', 'un arc-en-ciel', 'un chat', 'une fleur']

// rangée de choix à sélection unique (re-tap = désélectionne)
function PickRow({ label, options, value, onPick }: { label: string; options: string[]; value: string; onPick: (w: string) => void }) {
  return (
    <div className="chip-group">
      <span className="chip-group-label">{label}</span>
      {options.map((w) => (
        <button key={w} className={value === w ? 'seed-chip active' : 'seed-chip'} onClick={() => onPick(w)}>
          {w}
        </button>
      ))}
    </div>
  )
}

interface Props {
  roster: Roster
  onBack: () => void
  initialCategory?: 'tenue' | 'poster' | 'decor' | 'clip'
  /** créer un look en IA = ouvrir le créateur de personnage (photomaton) */
  onNewCharacter?: () => void
}

export function Atelier({ roster, onBack, initialCategory = 'tenue', onNewCharacter }: Props) {
  const [prompt, setPrompt] = useState('')
  const [category, setCategory] = useState<'tenue' | 'poster' | 'decor' | 'clip'>(initialCategory)
  const [busy, setBusy] = useState(false)
  const [busyMsg, setBusyMsg] = useState('La magie opère…')
  const [posterUrl, setPosterUrl] = useState<string | null>(() => {
    const r = getRoom()
    return r.posterImage ? getAssetUrl(r.posterImage) : null
  })
  const [message, setMessage] = useState<string | null>(null)
  const [gems, setGems] = useState(() => getProgress().gems)
  const [wardrobe, setWardrobe] = useState(() => getWardrobe())
  const [aiUniverse, setAiUniverse] = useState(() => getPreferredUniverse())
  const [assets, setAssets] = useState(() => listDecorAssets())
  const [viewer, setViewer] = useState<string | null>(null)
  const { toast, check } = useQuestToast()
  const self = roster.self?.config
  const ai = getAIConfig()

  // ── Création par SÉLECTION (plus de champ texte) ──────────────────────────
  const [selType, setSelType] = useState('')
  const [selColor, setSelColor] = useState('')
  const [, setPacksVer] = useState(0) // rafraîchit après déblocage d'un pack
  const pick = (cur: string, w: string, set: (v: string) => void) => set(cur === w ? '' : w) // toggle (re-tap = désélectionne)

  // mots des packs POSSÉDÉS du bon groupe
  const packWords = (group: 'style' | 'type' | 'motif') => KEYWORD_PACKS.filter((p) => p.group === group && hasPack(p.id)).flatMap((p) => p.words)
  // tuiles de style pour le Décor IA : mots des packs de style débloqués, ajoutables/retirables du prompt
  const decorStyleWords = packWords('style')
  const lockedStylePacks = KEYWORD_PACKS.filter((p) => p.group === 'style' && !hasPack(p.id))
  const toggleStyleWord = (w: string) => {
    const parts = prompt.split(',').map((s) => s.trim()).filter(Boolean)
    const idx = parts.indexOf(w)
    if (idx >= 0) parts.splice(idx, 1)
    else parts.push(w)
    setPrompt(parts.join(', '))
  }

  const buildPoster = () => [selType /* thème du poster */, selColor].filter(Boolean).join(' couleur ').trim()

  const tryUnlock = (id: string, label: string, cost: number) => {
    const r = unlockPack(id)
    if (r.ok) {
      setPacksVer((v) => v + 1)
      setMessage(`✅ Pack « ${label} » débloqué ! Ses choix sont maintenant disponibles.`)
      setGems(getProgress().gems)
    } else if (r.reason === 'gems') {
      setMessage(`🔒 Il te faut ${cost} 💎 pour le pack « ${label} ». Gagne des gemmes avec les quêtes, ou demande à un parent dans la Boutique.`)
    }
  }

  const generateAI = async (kind: 'decor' | 'clip') => {
    const cost = kind === 'decor' ? 20 : 40
    if (!isDebug() && getProgress().gems < cost) {
      setMessage(`🪶 Il te faut ${cost} 💎 pour cette magie — accomplis des quêtes !`)
      return
    }
    setBusy(true)
    setBusyMsg(kind === 'decor' ? 'Gemini peint ton décor…' : 'Veo prépare le tournage…')
    setMessage(null)
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
      setAssets(listDecorAssets())
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

  // Poster = image IA (plus de dessin vectoriel) : le thème + la couleur composent le prompt.
  const generate = async () => {
    const p = buildPoster()
    if (!p.trim()) {
      setMessage('🪶 Choisis un thème et une couleur !')
      return
    }
    if (!ai) {
      setMessage('🪶 La magie n’est pas encore prête — un parent peut la brancher dans l’Espace parents.')
      return
    }
    if (!isDebug() && getProgress().gems < GENERATION_COST) {
      setMessage(`🪶 Il te faut ${GENERATION_COST} 💎 pour une création — accomplis des quêtes !`)
      return
    }
    setBusy(true)
    setBusyMsg('Plume peint ton poster…')
    setMessage(null)
    try {
      const blob = await generateBackground(
        `affiche murale décorative pour une chambre, ${p}, illustration centrée, style poster kawaii doux`,
        aiUniverse,
      )
      if (!isDebug()) addReward(0, -GENERATION_COST)
      setGems(getProgress().gems)
      const asset = await saveAsset(
        { kind: 'image', mime: blob.type, label: `Poster ${p}`.slice(0, 40), prompt: p, universe: aiUniverse },
        blob,
      )
      const room = getRoom()
      saveRoom({ ...room, poster: null, posterCustom: null, posterImage: asset.id })
      setPosterUrl(getAssetUrl(asset.id))
      setMessage('✨ Ton poster est accroché dans ta chambre !')
      check({ roster, stories: Object.values(getStories()) })
    } catch (e) {
      const detail = e instanceof AIError && e.detail ? ` — détail : ${e.detail.slice(0, 200)}` : ''
      setMessage(`🪶 ${e instanceof Error ? e.message : 'La magie a raté, réessaie !'}${detail}`)
    } finally {
      setBusy(false)
    }
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
          {category === 'tenue' || category === 'poster'
            ? 'Touche tes options pour composer ta création — pas besoin d’écrire ✨ Débloque des packs pour encore plus de choix !'
            : 'Choisis une idée ou décris le lieu, Plume le peint pour toi.'}
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
                  <button key={s} className={prompt === s ? 'seed-chip active' : 'seed-chip'} onClick={() => setPrompt(s)}>{s}</button>
                ))}
              </div>
            )}
            {category === 'decor' && decorStyleWords.length > 0 && (
              <div className="seed-chips">
                <span className="seed-label">🎨 Styles débloqués (touche pour ajouter/retirer) :</span>
                {decorStyleWords.map((w) => (
                  <button
                    key={w}
                    className={prompt.split(',').map((s) => s.trim()).includes(w) ? 'seed-chip active' : 'seed-chip'}
                    onClick={() => toggleStyleWord(w)}
                  >
                    {w}
                  </button>
                ))}
              </div>
            )}
            {category === 'decor' && lockedStylePacks.length > 0 && (
              <div className="chip-group">
                <span className="chip-group-label">🎁 Packs de styles à débloquer (plus d'idées pour tes décors)</span>
                {lockedStylePacks.map((p) => (
                  <button key={p.id} className="seed-chip pack-locked" onClick={() => tryUnlock(p.id, p.label, p.cost)}>
                    🔒 {p.emoji} {p.label} · {p.cost}💎
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {category === 'decor' || category === 'clip' ? (
          <div className="atelier-input-row">
            <input
              className="name-input atelier-input"
              value={prompt}
              maxLength={100}
              placeholder={category === 'decor' ? 'La bibliothèque de l’école au coucher du soleil…' : 'Des pétales qui tombent sur la cour déserte…'}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !busy && ai && generateAI(category)}
            />
            <button className="btn btn-primary" disabled={busy || !ai} onClick={() => generateAI(category)}>
              {busy ? '⏳…' : category === 'decor' ? '✨ Peindre (20 💎)' : '🎬 Tourner (40 💎)'}
            </button>
          </div>
        ) : category === 'tenue' ? (
          <div className="atelier-picker atelier-redirect">
            <p className="hint">
              Les tenues et les looks se créent désormais <strong>avec l’IA</strong>, dans le créateur de personnage : tu
              choisis la tenue, les couleurs et le <strong>style</strong> (packs : pixel art, aquarelle, manga…), et Plume peint
              un vrai personnage habillé ✨
            </p>
            <button className="btn btn-primary btn-big" disabled={!onNewCharacter} onClick={() => onNewCharacter?.()}>
              🪄 Créer un look en IA
            </button>
            <p className="hint">
              Astuce : débloque des <strong>styles</strong> dans la Boutique — ils apparaissent dans l’onglet « Style » du photomaton.
            </p>
          </div>
        ) : (
          <div className="atelier-picker">
            <PickRow label="🌙 Thème" options={POSTER_THEMES} value={selType} onPick={(w) => pick(selType, w, setSelType)} />
            <PickRow label="🎨 Couleur" options={BASE_COLORS} value={selColor} onPick={(w) => pick(selColor, w, setSelColor)} />
            <p className="atelier-recap">
              🪶 Ton poster : <strong>{buildPoster() || '… touche tes options ci-dessus'}</strong>
            </p>
            <button className="btn btn-primary btn-big atelier-create" disabled={busy || !ai} onClick={generate}>
              {busy ? '🪶 Plume peint…' : `✨ Créer (${GENERATION_COST} 💎)`}
            </button>
            {!ai && <p className="hint">Un parent peut brancher la magie dans l’Espace parents pour créer des posters.</p>}
            {posterUrl && (
              <div className="poster-preview">
                <img className="asset-thumb asset-thumb-clickable" src={posterUrl} alt="Ton poster" onClick={() => setViewer(posterUrl)} />
                <span className="wardrobe-label">🖼️ Accroché dans ta chambre</span>
              </div>
            )}
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
                  <img
                    className="asset-thumb asset-thumb-clickable"
                    src={getAssetUrl(a.id) ?? undefined}
                    alt={a.label}
                    onClick={() => setViewer(getAssetUrl(a.id))}
                  />
                )}
                <span className="wardrobe-label">{a.kind === 'video' ? '🎬 ' : ''}{a.label}</span>
                <button
                  className="btn btn-ghost"
                  onClick={async () => {
                    await deleteAsset(a.id)
                    setAssets(listDecorAssets())
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
      {viewer && <PortraitViewer src={viewer} onClose={() => setViewer(null)} />}
    </div>
  )
}
