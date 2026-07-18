import { useEffect, useMemo, useRef, useState } from 'react'
import { AvatarView } from '../avatar/AvatarView'
import { UNIVERSES } from '../universes'
import type { Roster } from '../storage'
import { deleteStory, getEndingsFound, getStories } from '../storage'
import { buildDemoStory } from '../data/demoStory'
import { getPreferredUniverse } from '../storage'
import type { AuthoredStory } from '../builder/types'
import { QUESTS, claimDaily, dailyStatus, evaluateQuests, getProgress, levelFor } from '../progression'
import { RoomView } from '../room/RoomView'
import { getRoom } from '../room/room'
import { decodePostcard, downloadBundle, encodeBundle, importBundle, isPostcardCode, makeBundle, parseBundle, scanPII } from '../share'
import { addPostcard, getPostcards } from '../storage'
import { addReward } from '../progression'
import { compileStory } from '../builder/compile'
import { downloadBlob, exportRenpyZip } from '../renpy/export'
import type { Story } from '../engine/types'
import { PLUME_STARTERS } from '../data/starters'
import type { StarterCharacter } from '../data/starters'
import { deleteAsset, getAssetMeta, getAssetUrl, listAssets, saveAsset, staleDecorAssets } from '../atelier/assets'
import { addBottle, getBottles, removeBottle } from '../atelier/bottles'
import type { Bottle } from '../atelier/bottles'
import { getWardrobe } from '../atelier/wardrobe'
import { generateBackground, generateCharacterPortrait, hasAI } from '../atelier/genai'
import { newCharacterId, removeRosterEntry, saveRosterEntry } from '../storage'
import { Silhouette } from '../ui/Silhouette'
import { PortraitViewer } from '../ui/PortraitViewer'
import { persoSlots } from '../premium'

type AtelierCat = 'tenue' | 'poster' | 'decor' | 'clip'

interface Props {
  playerName: string
  roster: Roster
  onPlayDemo: () => void
  onPlayStory: (story: AuthoredStory) => void
  onWeave: (story: AuthoredStory) => void
  onNewStory: () => void
  onEditCharacter: (id: string) => void
  onNewCharacter: () => void
  onRemoveCharacter: (id: string) => void
  onCreateStarter: (starter: StarterCharacter) => void
  onOpenRoom: () => void
  onOpenAtelier: (cat?: AtelierCat) => void
  onOpenParents: () => void
  onOpenBoutique: () => void
  onOpenCeremony: () => void
  onRefresh: () => void
}

type Tab = 'histoires' | 'creations' | 'progression'
type CreaTab = 'persos' | 'tenues' | 'decors' | 'bouteilles' | 'chambre'

// Le Studio est démonté/remonté à chaque aller-retour vers un autre écran (ex :
// enregistrer/annuler un personnage dans le photomaton). Sans mémoriser l'onglet
// ailleurs que dans le state local, chaque retour renvoyait sur « Histoires » :
// l'enfant qui venait de créer/modifier un personnage dans l'onglet Créations
// ne voyait plus son travail et avait l'impression que « ça ne marche pas ».
let lastTab: Tab = 'histoires'
let lastCreaTab: CreaTab = 'persos'

export function Studio(props: Props) {
  const { playerName, roster, onOpenParents, onOpenBoutique } = props
  const [tab, setTabState] = useState<Tab>(lastTab)
  const [creaTab, setCreaTabState] = useState<CreaTab>(lastCreaTab)
  const setTab = (t: Tab) => { lastTab = t; setTabState(t) }
  const setCreaTab = (t: CreaTab) => { lastCreaTab = t; setCreaTabState(t) }
  const [claimMsg, setClaimMsg] = useState<string | null>(null)

  const stories = Object.values(getStories())
  const progress = getProgress()
  const { current: level, next } = levelFor(progress.xp)
  const daily = dailyStatus()

  const claimGift = () => {
    const r = claimDaily()
    if (r.claimed > 0) {
      setClaimMsg(`🎁 Cadeau du jour : +${r.claimed} 💎${r.streak > 1 ? ` · série de ${r.streak} jours 🔥` : ''} !`)
    }
  }

  // quêtes fraîchement accomplies (célébration au retour au studio)
  const freshQuests = useMemo(
    () => evaluateQuests({ roster, stories }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  return (
    <div className="studio hub">
      <div className="petals" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className="petal" style={{ left: `${(i * 10) % 100}%`, animationDelay: `${i * 1.9}s`, animationDuration: `${10 + (i % 4) * 2}s` }} />
        ))}
      </div>

      <header className="hub-header">
        <div className="hub-title">
          <span className="hub-hello">Le studio de</span>
          <strong className="accent">{playerName}</strong>
        </div>
        <div className="hub-stats">
          <span className="level-chip" title={`${progress.xp} XP`}>{level.emoji} {level.title}</span>
          {daily.canClaim && (
            <button className="daily-gift" onClick={claimGift} title={`+${daily.amount} 💎`}>🎁 Cadeau</button>
          )}
          <span className="gems-chip">💎 {progress.gems}</span>
          <button className="hub-parents" aria-label="Boutique" title="Boutique" onClick={onOpenBoutique}>✨</button>
          <button className="hub-parents" aria-label="Espace parents" onClick={onOpenParents}>⚙️</button>
        </div>
      </header>

      {claimMsg && <div className="quest-banner card">{claimMsg}</div>}

      {freshQuests.length > 0 && (
        <div className="quest-banner card">
          🎉 {freshQuests.map((q) => `${q.emoji} ${q.title} (+${q.gems} 💎)`).join(' · ')}
        </div>
      )}

      <main className="hub-body">
        {tab === 'histoires' && <HistoiresTab {...props} />}
        {tab === 'creations' && <CreationsTab {...props} creaTab={creaTab} setCreaTab={setCreaTab} />}
        {tab === 'progression' && <ProgressionTab progress={progress} nextXp={next?.xp} />}
      </main>

      <nav className="hub-tabbar" role="tablist">
        <button role="tab" aria-selected={tab === 'histoires'} className={tab === 'histoires' ? 'hub-tab active' : 'hub-tab'} onClick={() => setTab('histoires')}>
          <span className="hub-tab-emoji">📖</span>Histoires
        </button>
        <button role="tab" aria-selected={tab === 'creations'} className={tab === 'creations' ? 'hub-tab active' : 'hub-tab'} onClick={() => setTab('creations')}>
          <span className="hub-tab-emoji">🎨</span>Créations
        </button>
        <button role="tab" aria-selected={tab === 'progression'} className={tab === 'progression' ? 'hub-tab active' : 'hub-tab'} onClick={() => setTab('progression')}>
          <span className="hub-tab-emoji">🏆</span>Progrès
        </button>
      </nav>
    </div>
  )
}

// ------------------------------------------------------------ onglet Histoires

function HistoiresTab({ playerName, roster, onPlayDemo, onPlayStory, onWeave, onNewStory, onRefresh }: Props) {
  const stories = Object.values(getStories())
  const [shareStory, setShareStory] = useState<AuthoredStory | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)
  const demoStory = buildDemoStory(getPreferredUniverse() as import('../universes').UniverseId)
  const foundDemo = getEndingsFound(demoStory.meta.id)
  const uniDemo = UNIVERSES.find((u) => u.id === demoStory.meta.universe)

  const exportRenpy = async (story: Story, filename: string) => {
    setExporting(story.meta.id)
    try {
      downloadBlob(await exportRenpyZip(story, playerName, roster), filename)
    } finally {
      setExporting(null)
    }
  }

  return (
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
          <span className="story-uni" style={{ background: uniDemo?.color }}>{uniDemo?.emoji} {uniDemo?.name}</span>
          <strong>{demoStory.meta.title}</strong>
          <small>Histoire d'exemple · {foundDemo.length}/{demoStory.endings.length} fins {demoStory.endings.map((e) => (foundDemo.includes(e.id) ? e.emoji : '❔')).join(' ')}</small>
          <div className="story-actions">
            <button className="btn btn-primary" onClick={onPlayDemo}>▶ Jouer</button>
            <button className="btn btn-ghost" disabled={exporting === demoStory.meta.id} onClick={() => exportRenpy(demoStory, 'le-secret-du-cerisier-renpy.zip')}>
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
              <span className="story-uni" style={{ background: uni?.color }}>{uni?.emoji} {uni?.name}</span>
              <strong>{s.title}</strong>
              <small>
                {Object.keys(s.scenes).length} scènes · {finCount} fin{finCount > 1 ? 's' : ''} · {found.length} trouvée{found.length > 1 ? 's' : ''}
                {cards.length > 0 && <span title={cards.map((c) => `${c.from} ${c.sticker}`).join('\n')}> · 💌 {cards.length} {cards.slice(0, 4).map((c) => c.sticker).join('')}</span>}
              </small>
              <div className="story-actions">
                <button className="btn btn-primary" onClick={() => onPlayStory(s)}>▶ Jouer</button>
                <button className="btn btn-ghost" onClick={() => onWeave(s)}>🕸️ Tisser</button>
                <button className="btn btn-ghost" onClick={() => setShareStory(s)}>💌 Partager</button>
                <button className="btn btn-ghost" disabled={exporting === s.id} onClick={() => exportRenpy(compileStory(s, roster), `${s.id}-renpy.zip`)}>{exporting === s.id ? '⏳…' : '🎮'}</button>
                <button className="btn btn-ghost" title="Supprimer" onClick={() => { if (window.confirm(`Supprimer « ${s.title} » ?`)) { deleteStory(s.id); onRefresh() } }}>🗑</button>
              </div>
            </div>
          )
        })}
      </div>

      {shareStory && <ShareModal story={shareStory} roster={roster} playerName={playerName} onClose={() => setShareStory(null)} />}
      {showImport && <ImportModal roster={roster} onClose={() => setShowImport(false)} onImported={() => { setShowImport(false); onRefresh() }} />}
    </section>
  )
}

// ----------------------------------------------------------- onglet Créations

function CreationsTab(props: Props & { creaTab: CreaTab; setCreaTab: (t: CreaTab) => void }) {
  const { roster, creaTab, setCreaTab, onEditCharacter, onNewCharacter, onRemoveCharacter, onCreateStarter, onOpenAtelier, onOpenRoom, onOpenCeremony, onOpenBoutique, onRefresh } = props
  const [viewer, setViewer] = useState<string | null>(null)
  const [, force] = useState(0)
  const refresh = () => { force((n) => n + 1); onRefresh() }
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const createdCount = Object.keys(roster).filter((id) => id !== 'self').length

  // ── Gérer les assets : multi-sélection + suppression groupée ──────────────
  const [manage, setManage] = useState(false)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const toggleSel = (id: string) =>
    setSel((p) => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const exitManage = () => {
    setManage(false)
    setSel(new Set())
  }
  useEffect(exitManage, [creaTab]) // on change d'onglet → on sort du mode gérer (les ids diffèrent)
  const selectAll = () => {
    if (creaTab === 'persos') setSel(new Set(Object.keys(roster).filter((id) => id !== 'self')))
    else setSel(new Set(listAssets('image').filter((a) => !a.label.startsWith('Portrait')).map((a) => a.id)))
  }
  const bulkDelete = async () => {
    if (!sel.size) return
    if (!window.confirm(`Supprimer définitivement ${sel.size} élément${sel.size > 1 ? 's' : ''} ? C'est sans retour.`)) return
    if (creaTab === 'persos') {
      for (const id of sel) {
        if (id === 'self') continue
        const e = roster[id]
        if (e?.portraitAsset) await deleteAsset(e.portraitAsset)
        removeRosterEntry(id)
      }
    } else {
      for (const id of sel) await deleteAsset(id)
    }
    setMsg(`🗑 ${sel.size} élément${sel.size > 1 ? 's' : ''} supprimé${sel.size > 1 ? 's' : ''}.`)
    exitManage()
    refresh()
  }

  // rangement auto : les décors non utilisés depuis 30 j passent en bouteille (1 fois/session)
  useMemo(() => {
    const stale = staleDecorAssets(30)
    if (stale.length && !getBottles().some((b) => b.at > Date.now() - 3000)) {
      stale.forEach((a) => {
        addBottle({ subkind: 'decor', label: a.label, prompt: a.prompt || a.label, universe: a.universe })
        void deleteAsset(a.id)
      })
      setMsg(`🫙 ${stale.length} décor(s) rangé(s) en bouteille (inutilisés depuis longtemps).`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const bottleDecor = async (id: string) => {
    const m = getAssetMeta(id)
    if (!m) return
    addBottle({ subkind: 'decor', label: m.label, prompt: m.prompt || m.label, universe: m.universe })
    await deleteAsset(id)
    refresh()
  }

  const bottlePerso = async (id: string, entry: { name: string; config: import('../avatar/types').AvatarConfig; portraitAsset?: string }) => {
    const m = entry.portraitAsset ? getAssetMeta(entry.portraitAsset) : null
    addBottle({
      subkind: 'perso',
      label: entry.name,
      name: entry.name,
      prompt: m?.prompt || entry.name,
      universe: m?.universe || getPreferredUniverse(),
      config: entry.config,
      gender: entry.config.body === 'garcon' ? 'garcon' : 'fille',
      // on garde les paramètres de génération → la bouteille redonnera le MÊME perso
      gen: m?.gen,
    })
    if (entry.portraitAsset) await deleteAsset(entry.portraitAsset)
    onRemoveCharacter(id)
    refresh()
  }

  const regen = async (b: Bottle) => {
    if (!hasAI()) { setMsg('Active la magie IA pour ressortir une bouteille.'); return }
    setBusy(b.id)
    setMsg(null)
    try {
      if (b.subkind === 'decor') {
        const blob = await generateBackground(b.prompt, b.universe, undefined, true)
        await saveAsset({ kind: 'image', mime: blob.type, label: b.label, prompt: b.prompt, universe: b.universe }, blob)
      } else {
        // reproduire le MÊME perso : on réutilise seed + sélections persistés (b.gen),
        // sinon (vieilles bouteilles) on retombe sur le genre + un seed aléatoire.
        const g = b.gen
        const seed = g?.seed ?? Math.floor(Math.random() * 1_000_000_000)
        const blob = await generateCharacterPortrait(b.prompt, b.universe, {
          gender: g?.gender ?? b.gender,
          skin: g?.skin,
          age: g?.age,
          height: g?.height,
          ambiance: g?.ambiance,
          tags: g?.tags,
          reinforced: g?.reinforced,
          seed,
          free: true,
        })
        const asset = await saveAsset({ kind: 'image', mime: blob.type, label: `Portrait de ${b.name}`, prompt: b.prompt, universe: b.universe, gen: { ...g, seed } }, blob)
        saveRosterEntry(newCharacterId(), { name: b.name ?? 'Perso', config: b.config!, portraitAsset: asset.id })
      }
      removeBottle(b.id)
      setMsg('✨ Ressorti de sa bouteille !')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'La magie a raté.')
    } finally {
      setBusy(null)
    }
  }
  const createdNames = new Set(Object.entries(roster).filter(([id]) => id !== 'self').map(([, e]) => e.name.toLowerCase()))
  const ai = hasAI()
  const wardrobe = getWardrobe()
  const decors = listAssets('image').filter((a) => !a.label.startsWith('Portrait'))

  return (
    <div className="crea">
      <nav className="crea-tabs">
        {([['persos', '🎭 Personnages'], ['tenues', '👗 Garde-robe'], ['decors', '🏞️ Décors'], ['bouteilles', '🫙 Bouteilles'], ['chambre', '🛋️ Ma chambre']] as [CreaTab, string][]).map(([id, label]) => (
          <button key={id} className={creaTab === id ? 'tab active' : 'tab'} onClick={() => setCreaTab(id)}>{label}</button>
        ))}
      </nav>
      {msg && <p className="room-message">{msg}</p>}

      {(creaTab === 'persos' || creaTab === 'decors') && (
        <div className="manage-bar">
          {!manage ? (
            <button className="btn btn-ghost btn-sm" onClick={() => setManage(true)}>🧹 Gérer / nettoyer</button>
          ) : (
            <>
              <button className="btn btn-ghost btn-sm" onClick={selectAll}>Tout</button>
              <span className="manage-count">{sel.size} sélectionné{sel.size > 1 ? 's' : ''}</span>
              <button className="btn btn-primary btn-sm" disabled={!sel.size} onClick={bulkDelete}>🗑 Supprimer ({sel.size})</button>
              <button className="btn btn-ghost btn-sm" onClick={exitManage}>Terminé</button>
            </>
          )}
        </div>
      )}

      {creaTab === 'persos' && (
        <section className="card">
          {ai ? (
            <p className="hint">Décris un personnage, Plume le dessine dans le style du jeu ✨ — tes personnages restent tous cohérents.</p>
          ) : (
            <p className="hint">Crée tes personnages ! (Active la magie IA dans l’Espace parents pour des portraits uniques.)</p>
          )}
          {ai && createdCount === 0 && (
            <button className="ceremony-launch" onClick={onOpenCeremony}>
              🪶 Grande cérémonie : laisse Plume peindre tes 3 premiers personnages et des décors ✨
            </button>
          )}
          <div className="char-row">
            {Object.entries(roster).sort(([a], [b]) => (a === 'self' ? -1 : b === 'self' ? 1 : 0)).map(([id, entry]) => {
              const url = entry.portraitAsset ? getAssetUrl(entry.portraitAsset) : null
              const selectable = manage && id !== 'self'
              return (
                <div
                  key={id}
                  className={`char-tile char-card${manage && id === 'self' ? ' asset-locked' : ''}${sel.has(id) ? ' asset-selected' : ''}`}
                  onClick={selectable ? () => toggleSel(id) : undefined}
                >
                  {selectable && <span className="asset-check">{sel.has(id) ? '✅' : '⬜'}</span>}
                  <div className="char-portrait" onClick={manage ? undefined : () => (url ? setViewer(url) : onEditCharacter(id))}>
                    {url ? (
                      <img className="portrait-img fit-contain" src={url} alt={entry.name} />
                    ) : id === 'self' ? (
                      <AvatarView config={entry.config} expr="joie" width="100%" />
                    ) : (
                      <Silhouette kind="perso" />
                    )}
                    {url && !manage && <span className="char-zoom" aria-hidden>🔍</span>}
                  </div>
                  <span className="char-name">{id === 'self' ? `${entry.name} (toi !)` : entry.name}</span>
                  {!manage && <div className="char-tile-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => onEditCharacter(id)}>✏️ Modifier</button>
                    {id !== 'self' && (
                      <>
                        <button
                          className="btn btn-ghost btn-sm"
                          title="Ranger en bouteille (garde le prompt, libère la place)"
                          onClick={() => { if (window.confirm(`Ranger ${entry.name} en bouteille ? Tu pourras le ressortir plus tard.`)) bottlePerso(id, entry) }}
                        >
                          🫙
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          title="Supprimer"
                          onClick={() => { if (window.confirm(`Supprimer ${entry.name} ?`)) onRemoveCharacter(id) }}
                        >
                          🗑
                        </button>
                      </>
                    )}
                  </div>}
                </div>
              )
            })}
            {!manage && createdCount < 3 && PLUME_STARTERS.filter((s) => !createdNames.has(s.name.toLowerCase())).slice(0, 3 - createdCount).map((s) => (
              <button key={s.name} className="char-tile char-starter" onClick={() => onCreateStarter(s)}>
                <div className="starter-preview"><AvatarView config={s.config} expr="joie" width="100%" /></div>
                <span className="char-name">{s.emoji} {s.name}</span>
                <span className="char-edit">🪶 {s.hint}</span>
              </button>
            ))}
            {!manage &&
              (createdCount < persoSlots() ? (
                <button className="char-tile char-new" onClick={onNewCharacter}>
                  <span className="char-new-plus">{ai ? '🪄' : '＋'}</span>
                  <span className="char-name">{ai ? 'Créer avec l’IA' : 'Nouveau personnage'}</span>
                  <span className="char-edit">Invente quelqu'un !</span>
                </button>
              ) : (
                <button className="char-tile char-new" onClick={onOpenBoutique}>
                  <span className="char-new-plus">🎒</span>
                  <span className="char-name">Slots pleins</span>
                  <span className="char-edit">Range-en un (🫙) ou agrandis dans la Boutique ✨</span>
                </button>
              ))}
          </div>
        </section>
      )}

      {creaTab === 'tenues' && (
        <section className="card">
          <div className="stories-head">
            <h2>Garde-robe magique</h2>
            <button className="btn btn-primary" onClick={() => onOpenAtelier('tenue')}>🪄 Créer une tenue</button>
          </div>
          {wardrobe.length === 0 ? (
            <p className="hint">Aucune tenue pour l’instant. Invente-en une avec Plume : « une robe de bal bleu nuit avec des étoiles » !</p>
          ) : (
            <div className="char-row">
              {wardrobe.map((w) => (
                <button key={w.id} className="char-tile" onClick={() => onOpenAtelier('tenue')}>
                  {roster.self && <AvatarView config={{ ...roster.self.config, outfit: w.outfit, outfitColor: w.outfitColor, outfitColor2: w.outfitColor2, motif: w.motif }} expr="neutre" width="100%" />}
                  <span className="char-name">{w.label}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {creaTab === 'decors' && (
        <section className="card">
          <div className="stories-head">
            <h2>Mes décors</h2>
            <button className="btn btn-primary" onClick={() => onOpenAtelier('decor')}>🪄 Peindre un décor</button>
          </div>
          {decors.length === 0 ? (
            <p className="hint">Aucun décor IA encore. Fais peindre un lieu par Plume pour tes histoires !</p>
          ) : (
            <div className="char-row">
              {decors.map((d) => {
                const url = getAssetUrl(d.id)
                return (
                  <div
                    key={d.id}
                    className={`char-tile char-card${sel.has(d.id) ? ' asset-selected' : ''}`}
                    onClick={manage ? () => toggleSel(d.id) : undefined}
                  >
                    {manage && <span className="asset-check">{sel.has(d.id) ? '✅' : '⬜'}</span>}
                    <div className="char-portrait" onClick={manage ? undefined : () => url && setViewer(url)}>
                      <img className="decor-thumb" src={url ?? undefined} alt={d.label} />
                      {!manage && <span className="char-zoom" aria-hidden>🔍</span>}
                    </div>
                    <span className="char-name">{d.label}</span>
                    {!manage && (
                      <div className="char-tile-actions">
                        <button className="btn btn-ghost btn-sm" title="Ranger en bouteille" onClick={() => bottleDecor(d.id)}>🫙 Ranger</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {creaTab === 'bouteilles' && (
        <section className="card">
          <h2>🫙 Bouteilles</h2>
          <p className="hint">
            Les créations rangées ici ne gardent que leur formule magique (le prompt) — ça libère de la
            place. Touche une bouteille pour faire ressortir la création !
          </p>
          {getBottles().length === 0 ? (
            <p className="hint">Aucune bouteille pour l’instant. Range un décor ou un perso avec 🫙 pour en créer une.</p>
          ) : (
            <div className="bottle-row">
              {getBottles().map((b) => (
                <button key={b.id} className="bottle-card" disabled={busy === b.id} onClick={() => regen(b)}>
                  <svg viewBox="0 0 60 90" className="bottle-svg" aria-hidden>
                    <path d="M24 6 h12 v10 l6 10 v52 a6 6 0 0 1-6 6 h-12 a6 6 0 0 1-6-6 v-52 l6-10 Z" fill={b.subkind === 'perso' ? '#e7d3ff' : '#cdeadd'} stroke="#b79fe0" strokeWidth="2" />
                    <rect x="22" y="2" width="16" height="6" rx="2" fill="#c8a06c" />
                    <text x="30" y="58" textAnchor="middle" fontSize="20">{b.subkind === 'perso' ? '🧑' : '🏞️'}</text>
                  </svg>
                  <span className="bottle-label">{busy === b.id ? '✨…' : b.label}</span>
                  <span className="bottle-hint">{b.subkind === 'perso' ? 'personnage' : 'décor'} · ressortir</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {creaTab === 'chambre' && (
        <section className="card room-card">
          <h2>Ta chambre</h2>
          <button className="room-thumb" onClick={onOpenRoom}>
            <RoomView room={getRoom()} avatar={roster.self?.config} className="room-thumb-svg" />
          </button>
          <button className="btn btn-primary" onClick={onOpenRoom}>🎀 Décorer</button>
        </section>
      )}

      {viewer && <PortraitViewer src={viewer} onClose={() => setViewer(null)} />}
    </div>
  )
}

// --------------------------------------------------------- onglet Progression

function ProgressionTab({ progress, nextXp }: { progress: ReturnType<typeof getProgress>; nextXp?: number }) {
  return (
    <div className="crea">
      <section className="card">
        <h2>Ma progression</h2>
        <div className="progress-bar-row">
          <span className="gems-chip">💎 {progress.gems}</span>
          {nextXp && (
            <span className="xp-track" title={`${progress.xp} / ${nextXp} XP`}>
              <span className="xp-fill" style={{ width: `${Math.min(100, (progress.xp / nextXp) * 100)}%` }} />
            </span>
          )}
        </div>
        <h2 style={{ marginTop: 16 }}>Quêtes créatives</h2>
        <ul className="quest-list">
          {QUESTS.map((q) => {
            const done = progress.done.includes(q.id)
            return (
              <li key={q.id} className={done ? 'done' : ''}>
                <span className="quest-emoji">{done ? '✅' : q.emoji}</span>
                <span className="quest-text"><strong>{q.title}</strong><small>{q.desc}</small></span>
                <span className="quest-reward">+{q.gems} 💎</span>
              </li>
            )
          })}
        </ul>
      </section>
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
