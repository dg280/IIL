import { useState } from 'react'
import {
  ANIMAL_ACCESSORIES,
  ANIMAL_COLORS,
  ANIMAL_KINDS,
  ANIMAL_PATTERNS,
  generateAnimal,
  hasAI,
} from '../atelier/genai'
import { deleteAsset, getAssetUrl, saveAsset } from '../atelier/assets'
import { addReward, getProgress } from '../progression'
import { isDebug } from '../debug'
import { defaultAvatar } from '../avatar/types'
import { getPreferredUniverse, getRoster, newCharacterId, removeRosterEntry, saveRosterEntry } from '../storage'
import { PortraitViewer } from '../ui/PortraitViewer'

const ANIMAL_COST = 15

/** Espace « Animaux » : comme le photomaton des personnages, mais pour des animaux
 *  de compagnie créés pour de vrai en IA. Chaque espèce (lapin, hamster, chien,
 *  chat, poney…) a sa propre case ; on choisit un PRÉNOM, la couleur du pelage, le
 *  motif et un petit accessoire. Chaque animal devient un compagnon utilisable dans
 *  les histoires (il rejoint le roster, donc castable dans la Tisseuse). */
export function AnimauxPanel({ onRefresh }: { onRefresh: () => void }) {
  const [picking, setPicking] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState('')
  const [pattern, setPattern] = useState('')
  const [accessory, setAccessory] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [gems, setGems] = useState(() => getProgress().gems)
  const [, force] = useState(0)
  const [viewer, setViewer] = useState<string | null>(null)
  const ai = hasAI()
  const animals = Object.entries(getRoster()).filter(([, e]) => e.kind === 'animal')

  const openCreator = (id: string) => {
    setPicking(picking === id ? null : id)
    setName('')
    setColor('')
    setPattern('')
    setAccessory('')
    setMsg(null)
  }

  const create = async (kindId: string) => {
    if (!ai) {
      setMsg('Demande à un parent d’activer la magie dans l’Espace parents 🪄')
      return
    }
    if (!isDebug() && getProgress().gems < ANIMAL_COST) {
      setMsg(`🪶 Il te faut ${ANIMAL_COST} 💎 — accomplis des quêtes pour en gagner !`)
      return
    }
    const k = ANIMAL_KINDS.find((a) => a.id === kindId)
    const finalName = name.trim() || `Mon ${k?.label.toLowerCase() ?? 'animal'}`
    setBusy(true)
    setMsg(null)
    try {
      const blob = await generateAnimal(kindId, { color: color || undefined, pattern: pattern || undefined, accessory: accessory || undefined })
      if (!isDebug()) addReward(0, -ANIMAL_COST)
      setGems(getProgress().gems)
      const asset = await saveAsset(
        { kind: 'image', mime: blob.type, label: `${k?.emoji ?? '🐾'} ${finalName}`, prompt: kindId, universe: getPreferredUniverse(), tag: 'animal' },
        blob,
      )
      // l'animal rejoint le roster → castable comme compagnon dans les histoires.
      saveRosterEntry(newCharacterId(), {
        name: finalName,
        config: defaultAvatar(),
        portraitAsset: asset.id,
        kind: 'animal',
        animalKind: kindId,
      })
      setMsg(`✨ ${finalName} est né ! Tu peux l’ajouter à tes histoires 📖`)
      setPicking(null)
      onRefresh()
      force((n) => n + 1)
    } catch (e) {
      setMsg(`🪶 ${e instanceof Error ? e.message : 'La magie a raté, réessaie !'}`)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string, label: string, portraitAsset?: string) => {
    if (!window.confirm(`Supprimer ${label} ?`)) return
    if (portraitAsset) await deleteAsset(portraitAsset)
    removeRosterEntry(id)
    onRefresh()
    force((n) => n + 1)
  }

  return (
    <section className="card">
      <div className="stories-head">
        <h2>🐾 Mes animaux</h2>
        <span className="gems-chip">💎 {gems}</span>
      </div>
      <p className="hint">
        Choisis un animal, donne-lui un <strong>prénom</strong> et Plume le dessine <strong>pour de vrai</strong> ✨
        — comme le photomaton, tu choisis la couleur du pelage, le motif et un petit accessoire. Chaque espèce a
        sa case, et ton animal peut devenir un <strong>compagnon dans tes histoires</strong>.
      </p>
      {!ai && <p className="hint">🪄 Un parent peut activer la magie dans l’Espace parents pour créer les animaux.</p>}
      {msg && <p className="room-message">{msg}</p>}
      {busy && (
        <div className="atelier-busy">
          <span className="atelier-feather">🪶</span> Plume dessine ton animal…
        </div>
      )}

      {ANIMAL_KINDS.map((k) => {
        const mine = animals.filter(([, e]) => e.animalKind === k.id)
        const open = picking === k.id
        return (
          <div key={k.id} className="animal-species card">
            <div className="stories-head">
              <h3>
                {k.emoji} {k.label}
                {mine.length > 0 && <span className="animal-count"> · {mine.length}</span>}
              </h3>
              <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => openCreator(k.id)}>
                {open ? 'Annuler' : `＋ Créer un ${k.label.toLowerCase()}`}
              </button>
            </div>

            {open && (
              <div className="animal-creator">
                <input
                  className="name-input"
                  value={name}
                  maxLength={24}
                  placeholder={`Son prénom (ex : ${k.label === 'Lapin' ? 'Caramel' : k.label === 'Chat' ? 'Minou' : 'Choupi'})`}
                  onChange={(e) => setName(e.target.value)}
                />
                <OptionRow label="🎨 Couleur du pelage" options={ANIMAL_COLORS.map((c) => c.label)} value={color} onPick={setColor} />
                <OptionRow label="✨ Motif" options={ANIMAL_PATTERNS.map((p) => p.label)} value={pattern} onPick={setPattern} />
                <OptionRow label="🎀 Petit plus" options={ANIMAL_ACCESSORIES.map((a) => a.label)} value={accessory} onPick={setAccessory} />
                <button className="btn btn-primary btn-big" disabled={busy || !ai} onClick={() => create(k.id)}>
                  {busy ? '🪶…' : `✨ Créer en vrai (${ANIMAL_COST} 💎)`}
                </button>
              </div>
            )}

            {mine.length > 0 && (
              <div className="char-row">
                {mine.map(([id, e]) => {
                  const url = e.portraitAsset ? getAssetUrl(e.portraitAsset) : null
                  return (
                    <div key={id} className="char-tile char-card">
                      <div className="char-portrait" onClick={() => url && setViewer(url)}>
                        <img className="portrait-img fit-contain" src={url ?? undefined} alt={e.name} />
                        <span className="char-zoom" aria-hidden>🔍</span>
                      </div>
                      <span className="char-name">{k.emoji} {e.name}</span>
                      <div className="char-tile-actions">
                        <button className="btn btn-ghost btn-sm" title="Supprimer" onClick={() => remove(id, e.name, e.portraitAsset)}>🗑</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {viewer && <PortraitViewer src={viewer} onClose={() => setViewer(null)} />}
    </section>
  )
}

/** Rangée de choix à sélection unique (re-tap = désélectionne) — même esprit que le photomaton. */
function OptionRow({ label, options, value, onPick }: { label: string; options: string[]; value: string; onPick: (v: string) => void }) {
  return (
    <div className="chip-group">
      <span className="chip-group-label">{label}</span>
      {options.map((w) => (
        <button key={w} className={value === w ? 'seed-chip active' : 'seed-chip'} onClick={() => onPick(value === w ? '' : w)}>
          {w}
        </button>
      ))}
    </div>
  )
}
