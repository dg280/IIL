import { useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { deleteAsset, getAssetMeta, getAssetUrl } from '../atelier/assets'

// position horizontale (%) des anciens emplacements, pour convertir en x libre
const SLOT_X: Record<string, number> = { farleft: 9, left: 27, center: 50, right: 73, farright: 91 }
import type { AuthoredOption, AuthoredScene, AuthoredStory, Outcome } from '../builder/types'
import { FIN_EMOJIS, allFlags, defaultBg, newOption, newScene, nextSceneId } from '../builder/types'
import { analyzeStory, layoutStory } from '../builder/compile'
import { Background, getAllBackgrounds } from '../universes/Background'
import { CharFace } from '../ui/CharFace'
import { Silhouette } from '../ui/Silhouette'
import { EXPRESSIONS } from '../avatar/types'
import type { Roster } from '../storage'
import { getRoster, getStories, removeRosterEntry, saveStory } from '../storage'
import { CHAR_COLORS } from '../builder/types'
import { useQuestToast } from '../ui/QuestToast'
import { draftScene, hasAI, suggestIdeas } from '../atelier/genai'
import { moderatePrompt } from '../atelier/moderation'
import { UNIVERSES } from '../universes'

interface Props {
  story: AuthoredStory
  roster: Roster
  onBack: () => void
  onPlaytest: (story: AuthoredStory, startId?: string) => void
  /** ouvrir un générateur d'asset depuis les Coulisses (réutilise les outils existants) */
  onOpenAtelier?: (cat: 'decor') => void
  onNewCharacter?: () => void
}

const NODE_W = 210
const NODE_H = 130

function heartsScore(n: number | null): string {
  if (n === null) return ''
  return '💗'.repeat(n) + '🤍'.repeat(3 - n)
}

export function Tisseuse({ story: initial, roster, onBack, onPlaytest, onOpenAtelier, onNewCharacter }: Props) {
  const [story, setStory] = useState<AuthoredStory>(initial)
  const [selected, setSelected] = useState<string | null>(null)
  const [showPlume, setShowPlume] = useState(false)
  const [undoState, setUndoState] = useState<{ story: AuthoredStory; label: string } | null>(null)
  const { toast, check } = useQuestToast()

  // ── Coulisses : étagère d'assets de l'univers (persos + décors) ──────────
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const [shelfOpen, setShelfOpen] = useState(false)
  const [shelfTab, setShelfTab] = useState<'decor' | 'perso'>('decor')
  const [assetsVer, setAssetsVer] = useState(0) // force le rafraîchissement après suppression/génération
  const [createdId, setCreatedId] = useState<string | null>(null) // scène tout juste créée → Coulisses ouvertes
  const [flash, setFlash] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ kind: 'decor' | 'perso'; id: string; label: string; x0: number; y0: number; x: number; y: number } | null>(null)

  const showFlash = (m: string) => {
    setFlash(m)
    window.setTimeout(() => setFlash((f) => (f === m ? null : f)), 3500)
  }

  // assets CLOISONNÉS par univers
  const shelfDecors = useMemo(
    () => getAllBackgrounds().filter((b) => b.universe === story.universe),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [story.universe, assetsVer],
  )
  const shelfPersos = useMemo(
    () =>
      Object.entries(getRoster()).filter(([id, e]) => {
        if (id === 'self') return true
        if (!e.portraitAsset) return true // avatar dessiné : universel
        const u = getAssetMeta(e.portraitAsset)?.universe
        return !u || u === story.universe
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [story.universe, assetsVer],
  )

  // crée une NOUVELLE scène pré-remplie d'un décor OU d'un personnage
  const createSceneFrom = (kind: 'decor' | 'perso', id: string) => {
    const sid = nextSceneId(story)
    const bg = kind === 'decor' ? id : story.scenes[story.startId]?.bg ?? defaultBg(story.universe)
    const scene = newScene(sid, bg)
    let characters = story.characters
    if (kind === 'perso') {
      const who = id === 'self' ? 'mc' : id // le joueur s'appelle 'mc' dans les scènes
      scene.cast = [{ who, expr: 'neutre', at: 'center' }]
      if (who !== 'mc' && !characters.includes(who)) characters = [...characters, who] // rejoint le casting de l'histoire
    }
    update({ ...story, characters, scenes: { ...story.scenes, [sid]: scene } })
    setSelected(sid)
    setCreatedId(sid) // → l'éditeur ouvre les Coulisses sur l'élément manquant
    setShelfOpen(false)
    showFlash(kind === 'decor' ? '✨ Scène créée ! Ajoute un personnage dans les 🎬 Coulisses.' : '✨ Scène créée ! Choisis un décor dans les 🎬 Coulisses.')
  }

  const deleteDecor = (id: string, label: string) => {
    if (!id.startsWith('ai:')) {
      showFlash('Ce décor de base ne se supprime pas.')
      return
    }
    if (!window.confirm(`Supprimer le décor « ${label} » ? Les scènes qui l'utilisent reprendront un décor de base.`)) return
    void deleteAsset(id).then(() => setAssetsVer((v) => v + 1))
  }
  const removePerso = (id: string, name: string) => {
    if (id === 'self') return
    if (!window.confirm(`Retirer « ${name} » de tes personnages ? (Les scènes déjà écrites le gardent.)`)) return
    removeRosterEntry(id)
    setAssetsVer((v) => v + 1)
  }
  // fin de glisser : lâché sur le canvas (ou simple tap) → crée la scène
  const endDrag = (x: number, y: number) => {
    if (!drag) return
    const rect = canvasWrapRef.current?.getBoundingClientRect()
    const overCanvas = !!rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
    const moved = Math.hypot(x - drag.x0, y - drag.y0) > 8
    if (overCanvas || !moved) createSceneFrom(drag.kind, drag.id)
    setDrag(null)
  }

  const analysis = useMemo(() => analyzeStory(story), [story])
  const pos = useMemo(() => layoutStory(story), [story])

  const update = (next: AuthoredStory) => {
    setStory(next)
    saveStory(next)
    check({ roster, stories: Object.values(getStories()) })
  }

  const updateScene = (id: string, patch: Partial<AuthoredScene>) => {
    update({ ...story, scenes: { ...story.scenes, [id]: { ...story.scenes[id], ...patch } } })
  }

  const addScene = (linkFrom?: { sceneId: string; optionIndex?: number }): string => {
    const id = nextSceneId(story)
    const scene = newScene(id, story.scenes[story.startId]?.bg ?? 'cour_sakura')
    const scenes = { ...story.scenes, [id]: scene }
    let next: AuthoredStory = { ...story, scenes }
    if (linkFrom) {
      const src = scenes[linkFrom.sceneId]
      if (src.outcome.kind === 'suite' && linkFrom.optionIndex === undefined) {
        scenes[linkFrom.sceneId] = { ...src, outcome: { kind: 'suite', next: id } }
      } else if (src.outcome.kind === 'choix' && linkFrom.optionIndex !== undefined) {
        const options = src.outcome.options.map((o, i) => (i === linkFrom.optionIndex ? { ...o, next: id } : o))
        scenes[linkFrom.sceneId] = { ...src, outcome: { kind: 'choix', options } }
      }
      next = { ...story, scenes }
    }
    update(next)
    setSelected(id)
    return id
  }

  const deleteScene = (id: string) => {
    if (id === story.startId) return
    // undo plutôt que confirm (audit UX) : on garde l'état complet 8 secondes
    setUndoState({ story, label: story.scenes[id].titre })
    window.setTimeout(() => setUndoState((u) => (u?.story === story ? null : u)), 8000)
    const scenes: Record<string, AuthoredScene> = {}
    for (const [sid, sc] of Object.entries(story.scenes)) {
      if (sid === id) continue
      let outcome: Outcome = sc.outcome
      if (outcome.kind === 'suite' && outcome.next === id) outcome = { kind: 'suite', next: null }
      if (outcome.kind === 'choix')
        outcome = { kind: 'choix', options: outcome.options.map((o) => (o.next === id ? { ...o, next: null } : o)) }
      scenes[sid] = { ...sc, outcome }
    }
    setSelected(null)
    update({ ...story, scenes })
  }

  // -- flèches du canevas ------------------------------------------------
  // couleur = personnage dominant de l'option (les « routes » émergent, doc 04)
  const edges: { from: string; to: string; color: string; idx: number; label: string }[] = []
  const OPTION_COLORS = ['#e35d7c', '#8a63d2', '#59c2c9']
  const edgeInfo = (o: AuthoredOption, i: number): { color: string; label: string } => {
    const parts: string[] = []
    let color = OPTION_COLORS[i % 3]
    for (const [cid, n] of Object.entries(o.hearts)) {
      if (n !== 0) {
        parts.push(`💗${n > 0 ? '+' : ''}${n}`)
        const ci = story.characters.indexOf(cid)
        if (ci >= 0) color = CHAR_COLORS[ci % CHAR_COLORS.length]
      }
    }
    if (o.setFlags.length) parts.push('🚩')
    if (o.needFlag || o.needHearts) parts.push('🔒')
    return { color, label: parts.join(' ') }
  }
  for (const sc of Object.values(story.scenes)) {
    if (sc.outcome.kind === 'suite' && sc.outcome.next && story.scenes[sc.outcome.next]) {
      edges.push({ from: sc.id, to: sc.outcome.next, color: '#b8a3c8', idx: 0, label: '' })
    }
    if (sc.outcome.kind === 'choix') {
      sc.outcome.options.forEach((o, i) => {
        if (o.next && story.scenes[o.next]) {
          const info = edgeInfo(o, i)
          edges.push({ from: sc.id, to: o.next, color: info.color, idx: i, label: info.label })
        }
      })
    }
  }
  let canvasW = 400
  let canvasH = 300
  for (const p of Object.values(pos)) {
    canvasW = Math.max(canvasW, p.x + NODE_W + 60)
    canvasH = Math.max(canvasH, p.y + NODE_H + 60)
  }

  const selectedScene = selected ? story.scenes[selected] : null

  return (
    <div className="tisseuse">
      <header className="tiss-header">
        <button className="btn btn-ghost" onClick={onBack}>← Studio</button>
        <div className="tiss-title">
          <strong>{story.title}</strong>
          <small>
            {Object.keys(story.scenes).length} scènes · {analysis.endingCount} fin{analysis.endingCount > 1 ? 's' : ''}
          </small>
        </div>
        <button className={analysis.tips.length ? 'btn btn-ghost plume-btn has-tips' : 'btn btn-ghost plume-btn'} onClick={() => setShowPlume((v) => !v)}>
          🪶 Plume {analysis.tips.length > 0 && <span className="plume-count">{analysis.tips.length}</span>}
        </button>
        <button className="btn btn-primary" onClick={() => onPlaytest(story)}>▶ Tester</button>
      </header>

      <div className="tiss-body">
        <div className={drag ? 'tiss-canvas-wrap drop-armed' : 'tiss-canvas-wrap'} ref={canvasWrapRef}>
          <div className="tiss-canvas" style={{ width: canvasW, height: canvasH }}>
            <svg className="tiss-edges" width={canvasW} height={canvasH}>
              {edges.map((e, i) => {
                const a = pos[e.from]
                const b = pos[e.to]
                if (!a || !b) return null
                const x1 = a.x + NODE_W
                const y1 = a.y + NODE_H / 2 + e.idx * 14 - 7
                const x2 = b.x
                const y2 = b.y + NODE_H / 2
                const mx = (x1 + x2) / 2
                return (
                  <g key={i}>
                    <path d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2 - 8},${y2}`} stroke={e.color} strokeWidth="3" fill="none" opacity="0.8" />
                    <path d={`M${x2 - 10},${y2 - 5} L${x2},${y2} L${x2 - 10},${y2 + 5}`} stroke={e.color} strokeWidth="3" fill="none" strokeLinecap="round" />
                    {e.label && (
                      <text x={mx} y={(y1 + y2) / 2 - 6} textAnchor="middle" className="edge-label" fill={e.color}>
                        {e.label}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>

            {Object.values(story.scenes).map((sc) => {
              const p = pos[sc.id]
              const a = analysis.scenes[sc.id]
              return (
                <div
                  key={sc.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Scène ${sc.titre}`}
                  className={`tiss-node${selected === sc.id ? ' selected' : ''}${a?.reachable ? '' : ' unreachable'}`}
                  style={{ left: p.x, top: p.y, width: NODE_W }}
                  onClick={() => setSelected(sc.id)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelected(sc.id)}
                >
                  <div className="tiss-node-thumb">
                    <Background id={sc.bg} />
                    {sc.id === story.startId && <span className="tiss-start">🏁 Début</span>}
                    <div className="tiss-node-cast">
                      {sc.cast.slice(0, 3).map((c) => {
                        const e = c.who === 'mc' ? roster.self : roster[c.who]
                        if (!e) return null
                        return <CharFace key={c.who} portraitId={e.portraitAsset} name={e.name} size={30} />
                      })}
                    </div>
                  </div>
                  <div className="tiss-node-body">
                    <strong>{sc.titre}</strong>
                    <span className="tiss-node-badge">
                      {sc.outcome.kind === 'fin' && `${sc.outcome.emoji} ${sc.outcome.title || 'Fin'}`}
                      {sc.outcome.kind === 'choix' && (
                        <span title="Score de vrai choix">
                          {sc.outcome.options.length} choix {heartsScore(a?.choiceScore ?? null)}
                        </span>
                      )}
                      {sc.outcome.kind === 'suite' && (sc.outcome.next ? '→ suite' : '→ ∅')}
                    </span>
                  </div>
                  <button
                    className="tiss-node-play"
                    title="Tester depuis cette scène"
                    onClick={(e) => {
                      e.stopPropagation()
                      onPlaytest(story, sc.id)
                    }}
                  >
                    ▶
                  </button>
                </div>
              )
            })}
          </div>
          <button className="btn btn-primary tiss-add" onClick={() => addScene()}>＋ Nouvelle scène</button>
        </div>

        {selectedScene && (
          <SceneEditor
            key={selectedScene.id}
            story={story}
            scene={selectedScene}
            roster={roster}
            onChange={(patch) => updateScene(selectedScene.id, patch)}
            onAddLinkedScene={(optionIndex) => addScene({ sceneId: selectedScene.id, optionIndex })}
            onDelete={() => deleteScene(selectedScene.id)}
            onClose={() => setSelected(null)}
            isStart={selectedScene.id === story.startId}
            openCoulisses={createdId === selectedScene.id}
          />
        )}
      </div>

      {/* ── Coulisses : étagère d'assets (cloisonnée par univers) ── */}
      <div className={shelfOpen ? 'tiss-shelf open' : 'tiss-shelf'}>
        <button className="tiss-shelf-handle" onClick={() => setShelfOpen((v) => !v)}>
          🎬 Coulisses — glisse un décor ou un perso pour créer une scène {shelfOpen ? '▾' : '▸'}
        </button>
        {shelfOpen && (
          <div className="tiss-shelf-body">
            <div className="segmented tiss-shelf-tabs">
              <button className={shelfTab === 'decor' ? 'active' : ''} onClick={() => setShelfTab('decor')}>🖼️ Décors</button>
              <button className={shelfTab === 'perso' ? 'active' : ''} onClick={() => setShelfTab('perso')}>🧑 Personnages</button>
            </div>

            {shelfTab === 'decor' && (
              <div className="shelf-grid">
                {shelfDecors.map((b) => (
                  <div
                    key={b.id}
                    className="shelf-tile"
                    onPointerDown={(e) => {
                      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
                      setDrag({ kind: 'decor', id: b.id, label: b.label, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY })
                    }}
                    onPointerMove={(e) => drag && setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d))}
                    onPointerUp={(e) => endDrag(e.clientX, e.clientY)}
                  >
                    <div className="shelf-thumb"><Background id={b.id} /></div>
                    <span className="shelf-label">{b.label}</span>
                    {b.id.startsWith('ai:') && (
                      <button className="shelf-del" aria-label="Supprimer ce décor" onPointerDown={(e) => e.stopPropagation()} onClick={() => deleteDecor(b.id, b.label)}>🗑</button>
                    )}
                  </div>
                ))}
                {onOpenAtelier && (
                  <button className="shelf-tile shelf-add" onClick={() => onOpenAtelier('decor')}>
                    <span className="shelf-add-plus">＋</span>
                    <span className="shelf-label">Nouveau décor</span>
                  </button>
                )}
              </div>
            )}

            {shelfTab === 'perso' && (
              <div className="shelf-grid">
                {shelfPersos.map(([id, e]) => (
                  <div
                    key={id}
                    className="shelf-tile"
                    onPointerDown={(ev) => {
                      ;(ev.target as HTMLElement).setPointerCapture?.(ev.pointerId)
                      setDrag({ kind: 'perso', id, label: e.name, x0: ev.clientX, y0: ev.clientY, x: ev.clientX, y: ev.clientY })
                    }}
                    onPointerMove={(ev) => drag && setDrag((d) => (d ? { ...d, x: ev.clientX, y: ev.clientY } : d))}
                    onPointerUp={(ev) => endDrag(ev.clientX, ev.clientY)}
                  >
                    <div className="shelf-thumb shelf-thumb-perso"><CharFace portraitId={e.portraitAsset} name={e.name} size={56} /></div>
                    <span className="shelf-label">{e.name}</span>
                    {id !== 'self' && (
                      <button className="shelf-del" aria-label="Retirer ce personnage" onPointerDown={(ev) => ev.stopPropagation()} onClick={() => removePerso(id, e.name)}>🗑</button>
                    )}
                  </div>
                ))}
                {onNewCharacter && (
                  <button className="shelf-tile shelf-add" onClick={onNewCharacter}>
                    <span className="shelf-add-plus">＋</span>
                    <span className="shelf-label">Nouveau perso</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {drag && (
        <div className="shelf-ghost" style={{ left: drag.x, top: drag.y }}>
          {drag.kind === 'decor' ? <Background id={drag.id} /> : <CharFace portraitId={getRoster()[drag.id]?.portraitAsset} name={drag.label} size={48} />}
          <span>{drag.label}</span>
        </div>
      )}
      {flash && <div className="tiss-flash" role="status">{flash}</div>}

      {toast}
      {undoState && (
        <div className="undo-toast" role="status">
          Scène « {undoState.label} » supprimée
          <button
            className="btn btn-primary"
            onClick={() => {
              update(undoState.story)
              setSelected(null)
              setUndoState(null)
            }}
          >
            ↩️ Annuler
          </button>
        </div>
      )}

      {showPlume && (
        <div className="plume-panel card">
          <div className="plume-head">
            <strong>🪶 Plume te souffle…</strong>
            <button className="btn btn-ghost" onClick={() => setShowPlume(false)}>✕</button>
          </div>
          {analysis.tips.length === 0 ? (
            <p className="plume-ok">Rien à signaler : tes choix sont de vrais choix ! ✨</p>
          ) : (
            <ul>
              {analysis.tips.map((t, i) => (
                <li key={i} onClick={() => t.sceneId && setSelected(t.sceneId)}>
                  <span>{t.emoji}</span> {t.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// --------------------------------------------------------------- éditeur

interface EditorProps {
  story: AuthoredStory
  scene: AuthoredScene
  roster: Roster
  isStart: boolean
  onChange: (patch: Partial<AuthoredScene>) => void
  onAddLinkedScene: (optionIndex?: number) => void
  onDelete: () => void
  onClose: () => void
  /** ouvrir d'emblée les Coulisses (scène créée depuis l'étagère → élément à compléter) */
  openCoulisses?: boolean
}

function SceneEditor({ story, scene, roster, isStart, onChange, onAddLinkedScene, onDelete, onClose, openCoulisses }: EditorProps) {
  const castIds = ['mc', ...story.characters]
  const flags = allFlags(story)
  const [coulOpen, setCoulOpen] = useState(Boolean(openCoulisses))
  const sceneList = Object.values(story.scenes).filter((s) => s.id !== scene.id)
  const stageRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{ who: string; x: number; y: number } | null>(null)

  const setOutcome = (outcome: Outcome) => onChange({ outcome })

  const updateOption = (i: number, patch: Partial<AuthoredOption>) => {
    if (scene.outcome.kind !== 'choix') return
    const options = scene.outcome.options.map((o, j) => (j === i ? { ...o, ...patch } : o))
    setOutcome({ kind: 'choix', options })
  }

  const charLabel = (id: string) => (id === 'mc' ? `${roster.self?.name ?? 'Toi'} (héroïne)` : roster[id]?.name ?? id)

  const NextSelect = ({ value, onSelect, optionIndex }: { value: string | null; onSelect: (v: string | null) => void; optionIndex?: number }) => (
    <select
      className="tiss-select"
      value={value ?? ''}
      onChange={(e) => {
        if (e.target.value === '__new__') onAddLinkedScene(optionIndex)
        else onSelect(e.target.value || null)
      }}
    >
      <option value="">— nulle part (à relier !) —</option>
      {sceneList.map((s) => (
        <option key={s.id} value={s.id}>{s.titre}</option>
      ))}
      <option value="__new__">➕ nouvelle scène…</option>
    </select>
  )

  return (
    <aside className="tiss-editor card">
      <div className="tiss-editor-head">
        <input className="tiss-titre" value={scene.titre} maxLength={30} onChange={(e) => onChange({ titre: e.target.value })} />
        <button className="btn btn-ghost" onClick={onClose}>✕</button>
      </div>

      <PlumeSceneWriter story={story} scene={scene} roster={roster} onChange={onChange} />

      <h3>Mise en scène</h3>
      <p className="hint">Glisse un personnage sur la scène pour le placer où tu veux ✋</p>
      <div
        className="mini-stage"
        ref={stageRef}
        onPointerMove={(e) => {
          if (!drag || !stageRef.current) return
          const r = stageRef.current.getBoundingClientRect()
          const x = Math.max(4, Math.min(96, ((e.clientX - r.left) / r.width) * 100))
          const y = Math.max(0, Math.min(40, ((r.bottom - e.clientY) / r.height) * 100))
          setDrag({ who: drag.who, x: Math.round(x), y: Math.round(y) })
        }}
        onPointerUp={() => {
          if (drag) {
            onChange({ cast: scene.cast.map((c) => (c.who === drag.who ? { ...c, x: drag.x, y: drag.y } : c)) })
            setDrag(null)
          }
        }}
        onPointerLeave={() => setDrag(null)}
      >
        <Background id={scene.bg} />
        {scene.cast.map((c) => {
          const entry = c.who === 'mc' ? roster.self : roster[c.who]
          const cfg = entry?.config
          const url = entry?.portraitAsset ? getAssetUrl(entry.portraitAsset) : null
          if (!cfg && !url) return null
          const d = drag?.who === c.who ? drag : null
          const x = d ? d.x : c.x ?? SLOT_X[c.at]
          const y = d ? d.y : c.y ?? 0
          const style = { ['--sprite-scale']: c.scale ?? 1, left: `${x}%`, bottom: `${-3 + y}%` } as CSSProperties
          return (
            <div
              key={c.who}
              className={`mini-sprite draggable${d ? ' dragging' : ''}`}
              style={style}
              onPointerDown={(e) => {
                ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
                setDrag({ who: c.who, x: c.x ?? SLOT_X[c.at], y: c.y ?? 0 })
              }}
            >
              {url ? <img src={url} alt={entry?.name ?? ''} style={{ width: '100%', pointerEvents: 'none' }} /> : <Silhouette kind="perso" />}
            </div>
          )
        })}
        {scene.cast.length === 0 && <span className="mini-stage-empty">Ajoute des personnages 👇</span>}
      </div>

      <h3>Dialogues</h3>
      <div className="lines-list">
        {scene.lines.map((l, i) => (
          <div key={i} className={l.who ? 'dlg-card said' : 'dlg-card narr'}>
            <div className="dlg-head">
              <select
                className="tiss-select dlg-who"
                value={l.who ?? ''}
                onChange={(e) => onChange({ lines: scene.lines.map((x, j) => (j === i ? { ...x, who: e.target.value || null } : x)) })}
              >
                <option value="">✧ Narratrice</option>
                {castIds.map((id) => (
                  <option key={id} value={id}>{charLabel(id)}</option>
                ))}
              </select>
              <button className="dlg-del" aria-label="Supprimer la réplique" onClick={() => onChange({ lines: scene.lines.filter((_, j) => j !== i) })}>🗑</button>
            </div>
            <textarea
              className="dlg-text"
              value={l.text}
              rows={3}
              placeholder={l.who ? 'Que dit ce personnage ?' : 'Que raconte la narratrice ?'}
              onChange={(e) => onChange({ lines: scene.lines.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
            />
          </div>
        ))}
        <button className="btn btn-primary dlg-add" onClick={() => onChange({ lines: [...scene.lines, { who: null, text: '' }] })}>＋ Ajouter une réplique</button>
      </div>

      <PlumeMuse story={story} scene={scene} charLabel={charLabel} onChange={onChange} />

      <h3>Et ensuite ?</h3>
      <div className="outcome-tabs">
        <button className={scene.outcome.kind === 'suite' ? 'tab active' : 'tab'} onClick={() => scene.outcome.kind !== 'suite' && setOutcome({ kind: 'suite', next: null })}>→ Suite</button>
        <button className={scene.outcome.kind === 'choix' ? 'tab active' : 'tab'} onClick={() => scene.outcome.kind !== 'choix' && setOutcome({ kind: 'choix', options: [newOption(), newOption()] })}>🔀 Choix</button>
        <button className={scene.outcome.kind === 'fin' ? 'tab active' : 'tab'} onClick={() => scene.outcome.kind !== 'fin' && setOutcome({ kind: 'fin', title: '', emoji: '⭐' })}>🏁 Fin</button>
      </div>

      {scene.outcome.kind === 'suite' && (
        <div className="outcome-suite">
          <label>La scène continue vers :</label>
          <NextSelect value={scene.outcome.next} onSelect={(v) => setOutcome({ kind: 'suite', next: v })} />
        </div>
      )}

      {scene.outcome.kind === 'choix' && (
        <div className="outcome-choix">
          {scene.outcome.options.map((o, i) => (
            <div key={i} className="option-card">
              <div className="option-head">
                <strong>Option {i + 1}</strong>
                {scene.outcome.kind === 'choix' && scene.outcome.options.length > 2 && (
                  <button className="line-del" onClick={() => scene.outcome.kind === 'choix' && setOutcome({ kind: 'choix', options: scene.outcome.options.filter((_, j) => j !== i) })}>🗑</button>
                )}
              </div>
              <input className="tiss-input" value={o.text} placeholder="Texte du choix…" onChange={(e) => updateOption(i, { text: e.target.value })} />
              <label>mène vers :</label>
              <NextSelect value={o.next} onSelect={(v) => updateOption(i, { next: v })} optionIndex={i} />
              <label>Effets sur les cœurs :</label>
              <div className="hearts-row">
                {story.characters.map((cid) => {
                  const v = o.hearts[cid] ?? 0
                  return (
                    <div key={cid} className="heart-ctrl">
                      <span>{charLabel(cid)}</span>
                      <button onClick={() => updateOption(i, { hearts: { ...o.hearts, [cid]: v - 1 } })}>−</button>
                      <b className={v > 0 ? 'pos' : v < 0 ? 'neg' : ''}>{v > 0 ? `+${v}` : v}</b>
                      <button onClick={() => updateOption(i, { hearts: { ...o.hearts, [cid]: v + 1 } })}>＋</button>
                    </div>
                  )
                })}
                {story.characters.length === 0 && <small>Ajoute des personnages à l'histoire pour utiliser les cœurs.</small>}
              </div>
              <details className="magic-more" open={Boolean(o.setFlags.length || o.needFlag || o.needHearts)}>
                <summary>✨ Plus de magie (souvenirs & options secrètes)</summary>
              <label>🚩 Pose un souvenir :</label>
              <input
                className="tiss-input"
                value={o.setFlags[0] ?? ''}
                placeholder="ex : a_vu_le_mot (optionnel)"
                list="flags-list"
                onChange={(e) => {
                  const v = e.target.value.trim().replace(/\s+/g, '_').toLowerCase()
                  updateOption(i, { setFlags: v ? [v] : [] })
                }}
              />
              <label>Visible seulement si :</label>
              <select className="tiss-select" value={o.needFlag ?? ''} onChange={(e) => updateOption(i, { needFlag: e.target.value || null })}>
                <option value="">— toujours visible —</option>
                {flags.map((f) => (
                  <option key={f} value={f}>🚩 {f}</option>
                ))}
              </select>
              <label>💗 Et si l'affinité suffit :</label>
              <div className="needhearts-row">
                <select
                  className="tiss-select"
                  value={o.needHearts?.who ?? ''}
                  onChange={(e) =>
                    updateOption(i, {
                      needHearts: e.target.value ? { who: e.target.value, min: o.needHearts?.min ?? 2 } : null,
                    })
                  }
                >
                  <option value="">— pas de condition de cœur —</option>
                  {story.characters.map((cid) => (
                    <option key={cid} value={cid}>💗 {charLabel(cid)}</option>
                  ))}
                </select>
                {o.needHearts && (
                  <select
                    className="tiss-select tiss-select-min"
                    value={o.needHearts.min}
                    onChange={(e) => updateOption(i, { needHearts: { who: o.needHearts!.who, min: Number(e.target.value) } })}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>≥ {n}</option>
                    ))}
                  </select>
                )}
              </div>
              </details>
            </div>
          ))}
          {scene.outcome.options.length < 3 && (
            <button className="btn btn-ghost" onClick={() => scene.outcome.kind === 'choix' && setOutcome({ kind: 'choix', options: [...scene.outcome.options, newOption()] })}>＋ Option</button>
          )}
          <datalist id="flags-list">
            {flags.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </div>
      )}

      {scene.outcome.kind === 'fin' && (
        <div className="outcome-fin">
          <input className="tiss-input" value={scene.outcome.title} placeholder="Titre de la fin (ex : Amies pour la vie)" onChange={(e) => scene.outcome.kind === 'fin' && setOutcome({ ...scene.outcome, title: e.target.value })} />
          <div className="emoji-row">
            {FIN_EMOJIS.map((em) => (
              <button key={em} className={scene.outcome.kind === 'fin' && scene.outcome.emoji === em ? 'emoji-btn active' : 'emoji-btn'} onClick={() => scene.outcome.kind === 'fin' && setOutcome({ ...scene.outcome, emoji: em })}>
                {em}
              </button>
            ))}
          </div>
        </div>
      )}

      <details className="tiss-drawer" open={coulOpen} onToggle={(e) => setCoulOpen((e.currentTarget as HTMLDetailsElement).open)}>
        <summary>🎬 Coulisses de cette scène — décor & personnages</summary>
        <div className="tiss-drawer-body">
          <h4>Décor</h4>
          <div className="bg-grid">
            {getAllBackgrounds().map((b) => (
              <button key={b.id} className={scene.bg === b.id ? 'bg-thumb active' : 'bg-thumb'} onClick={() => onChange({ bg: b.id })} title={b.label} aria-label={b.label}>
                <Background id={b.id} />
              </button>
            ))}
          </div>

          <h4>Qui est en scène ?</h4>
          <div className="cast-list">
            {castIds.map((id) => {
              const member = scene.cast.find((c) => c.who === id)
              const entry = id === 'mc' ? roster.self : roster[id]
              return (
                <div key={id} className={member ? 'cast-row on' : 'cast-row'}>
                  <button
                    className="cast-toggle"
                    onClick={() => {
                      if (member) onChange({ cast: scene.cast.filter((c) => c.who !== id) })
                      else onChange({ cast: [...scene.cast, { who: id, expr: 'neutre', at: scene.cast.length === 0 ? 'center' : scene.cast.length === 1 ? 'left' : 'right' }] })
                    }}
                  >
                    <CharFace portraitId={entry?.portraitAsset} name={entry?.name ?? charLabel(id)} size={34} />
                    <span>{charLabel(id)}</span>
                    <span className="cast-check">{member ? '✓' : '＋'}</span>
                  </button>
                  {member && (
                    <div className="cast-opts">
                      <select className="tiss-select" value={member.expr} onChange={(e) => onChange({ cast: scene.cast.map((c) => (c.who === id ? { ...c, expr: e.target.value as typeof c.expr } : c)) })}>
                        {EXPRESSIONS.map((x) => (
                          <option key={x.id} value={x.id}>{x.label}</option>
                        ))}
                      </select>
                      <label className="size-slider" title="Taille du personnage">
                        <span>📏</span>
                        <input
                          type="range"
                          min={0.5}
                          max={1.8}
                          step={0.05}
                          value={member.scale ?? 1}
                          onChange={(e) => onChange({ cast: scene.cast.map((c) => (c.who === id ? { ...c, scale: Number(e.target.value) } : c)) })}
                        />
                      </label>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </details>

      {!isStart && (
        <button className="btn btn-ghost tiss-delete" onClick={onDelete}>🗑 Supprimer cette scène</button>
      )}
    </aside>
  )
}

// ----------------------------------------- Plume écrit une scène entière (IA)

interface WriterProps {
  story: AuthoredStory
  scene: AuthoredScene
  roster: Roster
  onChange: (patch: Partial<AuthoredScene>) => void
}

// Condensé d'une scène (les N dernières répliques) pour donner du contexte à Plume.
function summarizeScene(s: AuthoredScene, nameOf: (id: string) => string, maxLines = 6): string {
  const ls = s.lines.filter((l) => l.text.trim())
  return ls
    .slice(-maxLines)
    .map((l) => `${l.who ? nameOf(l.who) : 'Narratrice'}: ${l.text}`)
    .join('\n')
}

// Scène qui MÈNE à `id` (via une suite ou un choix) → « scène précédente » + le
// texte du choix emprunté, s'il y en a un. On parcourt le graphe de l'histoire.
function predecessorOf(story: AuthoredStory, id: string): { scene: AuthoredScene; via: string | null } | null {
  for (const s of Object.values(story.scenes)) {
    if (s.id === id) continue
    if (s.outcome.kind === 'suite' && s.outcome.next === id) return { scene: s, via: null }
    if (s.outcome.kind === 'choix') {
      const opt = s.outcome.options.find((o) => o.next === id)
      if (opt) return { scene: s, via: opt.text }
    }
  }
  return null
}

// Contexte narratif fourni à Plume : plan global de l'histoire + scène précédente
// (ce qui vient de se passer) → Plume enchaîne au lieu de repartir de zéro.
function buildStoryContext(story: AuthoredStory, scene: AuthoredScene, nameOf: (id: string) => string, castNames: string[]): string {
  const scenes = Object.values(story.scenes)
  const outline = scenes
    .slice(0, 16)
    .map((s) => `${s.id === scene.id ? '➤ ' : '• '}${s.titre}${s.outcome.kind === 'fin' ? ' [fin]' : ''}`)
    .join('\n')
  let ctx = `CONTEXTE DE L'HISTOIRE (respecte-le pour la cohérence, ne recommence pas l'histoire) :\n`
  ctx += `Histoire « ${story.title} ». Personnages : ${castNames.map(nameOf).join(', ')}.\n`
  ctx += `Déroulé des scènes (➤ = celle à écrire) :\n${outline}\n`
  const pred = predecessorOf(story, scene.id)
  if (pred) {
    const prevText = summarizeScene(pred.scene, nameOf)
    ctx += `\nSCÈNE PRÉCÉDENTE « ${pred.scene.titre} » — ce qui vient de se passer :\n${prevText || '(scène encore vide)'}\n`
    if (pred.via) ctx += `La joueuse arrive dans la scène à écrire en ayant choisi : « ${pred.via} ».\n`
    ctx += `ENCHAÎNE naturellement à partir de là : reprends le fil, les personnages présents et le ton.\n`
  } else if (scene.id === story.startId) {
    ctx += `\nC'est la PREMIÈRE scène : plante le décor et lance gentiment l'histoire.\n`
  }
  return ctx
}

// tuiles d'aide : pas de prompt vide, on propose des amorces d'intention
const SCENE_INTENT_CHIPS = [
  'une rencontre gênante à la récré',
  'une confidence sous les cerisiers',
  'une dispute puis une réconciliation',
  'un secret révélé par accident',
  'préparer une surprise ensemble',
  'un moment de fou rire',
  'se perdre et se retrouver',
  'une déclaration timide',
]

function PlumeSceneWriter({ story, scene, roster, onChange }: WriterProps) {
  const [intent, setIntent] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  if (!hasAI()) return null

  const castNames = ['mc', ...story.characters]
  const nameOf = (id: string) => (id === 'mc' ? roster.self?.name ?? 'Toi' : roster[id]?.name ?? id)
  // nom (tel que rendu par le modèle) → id du roster
  const resolveWho = (name: string | null): string | null => {
    if (!name) return null
    const norm = name.toLowerCase().trim()
    for (const id of castNames) {
      const label = nameOf(id).toLowerCase()
      if (label === norm || id.toLowerCase() === norm) return id
    }
    for (const id of castNames) {
      const label = nameOf(id).toLowerCase()
      if (norm.includes(label) || label.includes(norm)) return id
    }
    return null // narratrice par défaut
  }

  const uni = UNIVERSES.find((u) => u.id === story.universe)
  const names = castNames.map(nameOf)

  const write = async () => {
    const guard = intent.trim() ? moderatePrompt(intent) : null
    if (guard) {
      setMsg(`🪶 ${guard}`)
      return
    }
    setBusy(true)
    setMsg(null)
    const system =
      `Tu es Plume, une mascotte qui aide une enfant de 11 ans à écrire un otome game (histoire d'amitié et de tendres béguins, pour enfants). ` +
      `Univers : ${uni?.name ?? 'lycée'}. ` +
      `Personnages disponibles — utilise EXACTEMENT ces noms dans le champ "who", ou null pour la narratrice : ${names.join(', ')}. ` +
      `On te donne le CONTEXTE de l'histoire et la SCÈNE PRÉCÉDENTE : tiens-en compte pour la continuité (mêmes personnages, même fil, mêmes prénoms), n'introduis pas de contradiction et ne recommence pas l'histoire. ` +
      `Contenu toujours doux et adapté aux enfants : jamais de violence, de peur intense, ni de romance au-delà d'un béguin mignon. ` +
      `Réponds UNIQUEMENT par un objet JSON valide, sans aucun texte autour, au format exact : ` +
      `{"titre":"court titre","lines":[{"who":"Nom ou null","text":"réplique"}],"choix":[{"text":"choix","hearts":{"Nom":1}}]}. ` +
      `Écris 3 à 6 répliques vivantes. Si l'intention appelle une décision, propose 2 choix bien différents (sinon "choix":[]).`
    const storyCtx = buildStoryContext(story, scene, nameOf, castNames)
    const contexte = scene.lines.filter((l) => l.text.trim()).map((l) => `${l.who ? nameOf(l.who) : 'Narratrice'}: ${l.text}`).join('\n')
    const user =
      `${storyCtx}\n` +
      `SCÈNE À ÉCRIRE : « ${scene.titre} ». ` +
      (contexte ? `Ce qui y est déjà écrit :\n${contexte}\n` : '') +
      `Écris cette scène en continuité avec ce qui précède. Intention de l'autrice : ${intent.trim() || 'une jolie scène qui fait avancer l’histoire'}.`
    try {
      const draft = await draftScene(system, user)
      const patch: Partial<AuthoredScene> = {}
      if (draft.titre && scene.titre === 'Nouvelle scène') patch.titre = draft.titre
      if (draft.lines.length) patch.lines = draft.lines.map((l) => ({ who: resolveWho(l.who), text: l.text }))
      // ajoute au casting les personnages qui prennent la parole
      const speakers = new Set((patch.lines ?? scene.lines).map((l) => l.who).filter((w): w is string => Boolean(w)))
      const cast = [...scene.cast]
      let idx = cast.length
      for (const w of speakers) {
        if (!cast.some((c) => c.who === w)) {
          cast.push({ who: w, expr: 'neutre', at: idx === 0 ? 'center' : idx === 1 ? 'left' : 'right' })
          idx++
        }
      }
      if (cast.length !== scene.cast.length) patch.cast = cast
      // choix proposés → outcome (seulement si Plume en a écrit)
      if (draft.choix.length >= 2) {
        patch.outcome = {
          kind: 'choix',
          options: draft.choix.map((c) => {
            const hearts: Record<string, number> = {}
            for (const [nm, n] of Object.entries(c.hearts)) {
              const id = resolveWho(nm)
              if (id && id !== 'mc') hearts[id] = n
            }
            return { ...newOption(), text: c.text, hearts }
          }),
        }
      }
      onChange(patch)
      setIntent('')
      setMsg('✨ Plume a écrit la scène ! Retouche tout ce que tu veux ci-dessous.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'La magie a raté.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="scene-writer">
      <button className="scene-writer-toggle" onClick={() => setOpen((v) => !v)}>
        ✍️ Plume écrit la scène pour toi {open ? '▾' : '▸'}
      </button>
      {open && (
        <div className="scene-writer-body">
          <input
            className="tiss-input"
            value={intent}
            maxLength={120}
            placeholder="Que se passe-t-il ? (ou touche une idée)"
            onChange={(e) => setIntent(e.target.value)}
          />
          <div className="chip-help">
            {SCENE_INTENT_CHIPS.map((c) => (
              <button key={c} className="seed-chip" onClick={() => setIntent(c)}>{c}</button>
            ))}
          </div>
          <button className="btn btn-primary" disabled={busy} onClick={write}>
            {busy ? '✍️ Plume écrit…' : '✍️ Écrire la scène'}
          </button>
          {msg && <p className="hint">{msg}</p>}
        </div>
      )}
    </div>
  )
}

// --------------------------------------------------- Plume : idées via IA

interface MuseProps {
  story: AuthoredStory
  scene: AuthoredScene
  charLabel: (id: string) => string
  onChange: (patch: Partial<AuthoredScene>) => void
}

type MuseMode = 'replique' | 'scene' | 'suite' | 'choix'

function PlumeMuse({ story, scene, charLabel, onChange }: MuseProps) {
  const [busy, setBusy] = useState<MuseMode | null>(null)
  const [ideas, setIdeas] = useState<{ mode: MuseMode; items: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!hasAI()) {
    return (
      <p className="muse-off">
        🪶 Active la magie de Plume dans l’Espace parents pour recevoir des idées de dialogues et de scènes.
      </p>
    )
  }

  const uni = UNIVERSES.find((u) => u.id === story.universe)
  const persos = story.characters.map((id) => charLabel(id)).join(', ') || 'ton héroïne'
  const resume = scene.lines.filter((l) => l.text.trim()).map((l) => `${l.who ? charLabel(l.who) : 'Narratrice'}: ${l.text}`).join('\n') || '(scène encore vide)'

  const system =
    `Tu es Plume, une mascotte douce qui aide une enfant de 11 ans à écrire un otome game (histoire d'amitié et de romance adaptée aux enfants). ` +
    `Univers : ${uni?.name}. Personnages : ${persos}. ` +
    `Réponds en français, ton chaleureux et adapté aux enfants, jamais de contenu inapproprié. ` +
    `Donne EXACTEMENT 3 propositions courtes, une par ligne, sans numéro ni explication.`

  const ask = async (mode: MuseMode) => {
    setBusy(mode)
    setError(null)
    setIdeas(null)
    const prompts: Record<MuseMode, string> = {
      replique: `Voici la scène « ${scene.titre} » :\n${resume}\nPropose 3 répliques que pourrait dire un personnage maintenant.`,
      scene: `Propose 3 idées de courtes scènes pour l'histoire « ${story.title} » dans l'univers ${uni?.name}.`,
      suite: `Voici la scène « ${scene.titre} » :\n${resume}\nPropose 3 idées de ce qui pourrait se passer juste après.`,
      choix: `Voici la scène « ${scene.titre} » :\n${resume}\nPropose 3 options de choix courtes et différentes que la joueuse pourrait faire ici (une décision par ligne).`,
    }
    try {
      const items = await suggestIdeas(system, prompts[mode])
      if (!items.length) setError('Plume n’a pas trouvé d’idée — réessaie !')
      else setIdeas({ mode, items })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'La magie a raté.')
    } finally {
      setBusy(null)
    }
  }

  const useIdea = (mode: MuseMode, text: string) => {
    if (mode === 'choix' && scene.outcome.kind === 'choix') {
      // remplit la première option vide, sinon en ajoute une
      const opts = scene.outcome.options
      const emptyIdx = opts.findIndex((o) => !o.text.trim())
      const next = emptyIdx >= 0
        ? opts.map((o, i) => (i === emptyIdx ? { ...o, text } : o))
        : [...opts, { ...newOption(), text }]
      onChange({ outcome: { kind: 'choix', options: next } })
    } else if (mode === 'replique') {
      const lastWho = [...scene.lines].reverse().find((l) => l.who)?.who ?? null
      onChange({ lines: [...scene.lines, { who: lastWho, text }] })
    } else {
      onChange({ lines: [...scene.lines, { who: null, text }] })
    }
    setIdeas(null)
  }

  return (
    <div className="muse">
      <div className="muse-buttons">
        <button className="btn btn-ghost" disabled={busy !== null} onClick={() => ask('replique')}>
          {busy === 'replique' ? '🪶…' : '🪶 Idée de réplique'}
        </button>
        <button className="btn btn-ghost" disabled={busy !== null} onClick={() => ask('suite')}>
          {busy === 'suite' ? '🪶…' : '🪶 Et après ?'}
        </button>
        <button className="btn btn-ghost" disabled={busy !== null} onClick={() => ask('scene')}>
          {busy === 'scene' ? '🪶…' : '🪶 Idée de scène'}
        </button>
        {scene.outcome.kind === 'choix' && (
          <button className="btn btn-ghost" disabled={busy !== null} onClick={() => ask('choix')}>
            {busy === 'choix' ? '🪶…' : '🪶 Idée de choix'}
          </button>
        )}
      </div>
      {error && <p className="muse-error">🪶 {error}</p>}
      {ideas && (
        <div className="muse-ideas">
          {ideas.items.map((t, i) => (
            <button key={i} className="muse-idea" onClick={() => useIdea(ideas.mode, t)}>
              <span>{t}</span>
              <span className="muse-add">＋</span>
            </button>
          ))}
          <p className="hint">Touche une idée pour l’ajouter à ta scène (tu pourras la modifier).</p>
        </div>
      )}
    </div>
  )
}
