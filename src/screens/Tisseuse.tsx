import { useMemo, useState } from 'react'
import type { AuthoredOption, AuthoredScene, AuthoredStory, Outcome } from '../builder/types'
import { FIN_EMOJIS, allFlags, newOption, newScene, nextSceneId } from '../builder/types'
import { analyzeStory, layoutStory } from '../builder/compile'
import { Background, getAllBackgrounds } from '../universes/Background'
import { AvatarView } from '../avatar/AvatarView'
import { EXPRESSIONS } from '../avatar/types'
import type { Roster } from '../storage'
import { getStories, saveStory } from '../storage'
import { CHAR_COLORS } from '../builder/types'
import { useQuestToast } from '../ui/QuestToast'
import { hasAI, suggestIdeas } from '../atelier/genai'
import { UNIVERSES } from '../universes'

interface Props {
  story: AuthoredStory
  roster: Roster
  onBack: () => void
  onPlaytest: (story: AuthoredStory, startId?: string) => void
}

const NODE_W = 210
const NODE_H = 130

function heartsScore(n: number | null): string {
  if (n === null) return ''
  return '💗'.repeat(n) + '🤍'.repeat(3 - n)
}

export function Tisseuse({ story: initial, roster, onBack, onPlaytest }: Props) {
  const [story, setStory] = useState<AuthoredStory>(initial)
  const [selected, setSelected] = useState<string | null>(null)
  const [showPlume, setShowPlume] = useState(false)
  const [undoState, setUndoState] = useState<{ story: AuthoredStory; label: string } | null>(null)
  const { toast, check } = useQuestToast()

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
        <div className="tiss-canvas-wrap">
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
                        const cfg = c.who === 'mc' ? roster.self?.config : roster[c.who]?.config
                        return cfg ? <AvatarView key={c.who} config={cfg} expr={c.expr} width={30} /> : null
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
          />
        )}
      </div>

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
}

function SceneEditor({ story, scene, roster, isStart, onChange, onAddLinkedScene, onDelete, onClose }: EditorProps) {
  const castIds = ['mc', ...story.characters]
  const flags = allFlags(story)
  const sceneList = Object.values(story.scenes).filter((s) => s.id !== scene.id)

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

      <h3>Mise en scène</h3>
      <div className="mini-stage">
        <Background id={scene.bg} />
        {scene.cast.map((c) => {
          const cfg = c.who === 'mc' ? roster.self?.config : roster[c.who]?.config
          if (!cfg) return null
          return (
            <div key={c.who} className={`mini-sprite pos-${c.at}`}>
              <AvatarView config={cfg} expr={c.expr} width="100%" />
            </div>
          )
        })}
        {scene.cast.length === 0 && <span className="mini-stage-empty">Ajoute des personnages 👇</span>}
      </div>

      <h3>Décor</h3>
      <div className="bg-grid">
        {getAllBackgrounds().map((b) => (
          <button key={b.id} className={scene.bg === b.id ? 'bg-thumb active' : 'bg-thumb'} onClick={() => onChange({ bg: b.id })} title={b.label} aria-label={b.label}>
            <Background id={b.id} />
          </button>
        ))}
      </div>

      <h3>Qui est en scène ?</h3>
      <div className="cast-list">
        {castIds.map((id) => {
          const member = scene.cast.find((c) => c.who === id)
          const cfg = id === 'mc' ? roster.self?.config : roster[id]?.config
          return (
            <div key={id} className={member ? 'cast-row on' : 'cast-row'}>
              <button
                className="cast-toggle"
                onClick={() => {
                  if (member) onChange({ cast: scene.cast.filter((c) => c.who !== id) })
                  else onChange({ cast: [...scene.cast, { who: id, expr: 'neutre', at: scene.cast.length === 0 ? 'center' : scene.cast.length === 1 ? 'left' : 'right' }] })
                }}
              >
                {cfg && <AvatarView config={cfg} expr={member?.expr ?? 'neutre'} width={34} />}
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
                  <div className="pos-btns">
                    {(['farleft', 'left', 'center', 'right', 'farright'] as const).map((p) => (
                      <button
                        key={p}
                        title={{ farleft: 'Tout à gauche', left: 'À gauche', center: 'Au centre', right: 'À droite', farright: 'Tout à droite' }[p]}
                        className={member.at === p ? 'pos-btn active' : 'pos-btn'}
                        onClick={() => onChange({ cast: scene.cast.map((c) => (c.who === id ? { ...c, at: p } : c)) })}
                      >
                        {{ farleft: '⏮', left: '◀', center: '●', right: '▶', farright: '⏭' }[p]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <h3>Dialogues</h3>
      <div className="lines-list">
        {scene.lines.map((l, i) => (
          <div key={i} className="line-row">
            <select
              className="tiss-select line-who"
              value={l.who ?? ''}
              onChange={(e) => onChange({ lines: scene.lines.map((x, j) => (j === i ? { ...x, who: e.target.value || null } : x)) })}
            >
              <option value="">✧ Narratrice</option>
              {castIds.map((id) => (
                <option key={id} value={id}>{charLabel(id)}</option>
              ))}
            </select>
            <textarea
              className="line-text"
              value={l.text}
              rows={2}
              placeholder="Écris la réplique ici…"
              onChange={(e) => onChange({ lines: scene.lines.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
            />
            <button className="line-del" onClick={() => onChange({ lines: scene.lines.filter((_, j) => j !== i) })}>🗑</button>
          </div>
        ))}
        <button className="btn btn-ghost" onClick={() => onChange({ lines: [...scene.lines, { who: null, text: '' }] })}>＋ Réplique</button>
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

      {!isStart && (
        <button className="btn btn-ghost tiss-delete" onClick={onDelete}>🗑 Supprimer cette scène</button>
      )}
    </aside>
  )
}

// --------------------------------------------------- Plume : idées via IA

interface MuseProps {
  story: AuthoredStory
  scene: AuthoredScene
  charLabel: (id: string) => string
  onChange: (patch: Partial<AuthoredScene>) => void
}

type MuseMode = 'replique' | 'scene' | 'suite'

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
    if (mode === 'replique') {
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
