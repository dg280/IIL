import type { AuthoredOption, AuthoredScene, AuthoredStory } from './types'
import { CHAR_COLORS, allFlags } from './types'
import type { Choice, Ending, Op, Story, StoryCharacter, VarValue } from '../engine/types'
import type { Roster } from '../storage'

const FIN_AUTO = '__fin_auto'

function charName(id: string, roster: Roster): string {
  if (id === 'mc') return 'Toi'
  return roster[id]?.name ?? id
}

function impactLabel(o: AuthoredOption, roster: Roster): string | undefined {
  const parts: string[] = []
  for (const [id, n] of Object.entries(o.hearts)) {
    if (n !== 0) parts.push(`💗 ${charName(id, roster)} ${n > 0 ? '+' : ''}${n}`)
  }
  for (const f of o.setFlags) parts.push(`🚩 ${f}`)
  return parts.length ? parts.join(' · ') : undefined
}

function compileOption(o: AuthoredOption, roster: Roster): Choice {
  const effects: Choice['effects'] = []
  for (const [id, n] of Object.entries(o.hearts)) {
    if (n !== 0) effects.push({ add: `coeur_${id}`, n })
  }
  for (const f of o.setFlags) effects.push({ set: f, to: true })
  return {
    text: o.text || '…',
    jump: o.next ?? FIN_AUTO,
    effects: effects.length ? effects : undefined,
    cond: o.needFlag ? { var: o.needFlag, eq: true } : undefined,
    impact: impactLabel(o, roster),
  }
}

function compileScene(scene: AuthoredScene, roster: Roster): Op[] {
  const ops: Op[] = [{ op: 'scene', bg: scene.bg }]
  for (const c of scene.cast) ops.push({ op: 'show', who: c.who, expr: c.expr, at: c.at })
  for (const l of scene.lines) {
    if (l.text.trim()) ops.push({ op: 'say', who: l.who ?? undefined, text: l.text })
  }
  switch (scene.outcome.kind) {
    case 'suite':
      ops.push({ op: 'jump', label: scene.outcome.next ?? FIN_AUTO })
      break
    case 'choix': {
      const options = scene.outcome.options.filter((o) => o.text.trim() || o.next)
      if (options.length) ops.push({ op: 'menu', choices: options.map((o) => compileOption(o, roster)) })
      else ops.push({ op: 'jump', label: FIN_AUTO })
      break
    }
    case 'fin':
      ops.push({ op: 'end', ending: { id: scene.id, title: scene.outcome.title || 'Fin', emoji: scene.outcome.emoji } })
      break
  }
  return ops
}

/** Transforme une histoire éditée dans la Tisseuse en Story jouable. */
export function compileStory(authored: AuthoredStory, roster: Roster): Story {
  const characters: Record<string, StoryCharacter> = {
    mc: { name: 'Toi', isPlayer: true, color: '#e35d7c' },
  }
  authored.characters.forEach((id, i) => {
    characters[id] = { name: charName(id, roster), color: CHAR_COLORS[i % CHAR_COLORS.length] }
  })

  const variables: Record<string, VarValue> = {}
  for (const id of authored.characters) variables[`coeur_${id}`] = 0
  for (const f of allFlags(authored)) variables[f] = false

  const labels: Record<string, Op[]> = {
    start: [{ op: 'jump', label: authored.startId }],
    [FIN_AUTO]: [
      { op: 'say', text: '… et l’histoire s’arrête ici pour l’instant !' },
      { op: 'end', ending: { id: 'fin_auto', title: 'À suivre…', emoji: '🍃' } },
    ],
  }
  for (const scene of Object.values(authored.scenes)) {
    labels[scene.id] = compileScene(scene, roster)
  }

  const endings: Ending[] = Object.values(authored.scenes)
    .filter((s) => s.outcome.kind === 'fin')
    .map((s) => {
      const o = s.outcome as Extract<AuthoredScene['outcome'], { kind: 'fin' }>
      return { id: s.id, title: o.title || 'Fin', emoji: o.emoji }
    })

  return {
    meta: {
      id: authored.id,
      title: authored.title,
      universe: authored.universe,
      description: '',
    },
    characters,
    variables,
    labels,
    endings: endings.length ? endings : [{ id: 'fin_auto', title: 'À suivre…', emoji: '🍃' }],
  }
}

// ------------------------------------------------------------------ analyse

export interface SceneAnalysis {
  /** 1 = faux choix, 2 = choix correct, 3 = vrai choix (divergence + effets) */
  choiceScore: number | null
  reachable: boolean
}

export interface PlumeTip {
  sceneId: string | null
  emoji: string
  text: string
}

export interface StoryAnalysis {
  scenes: Record<string, SceneAnalysis>
  tips: PlumeTip[]
  endingCount: number
  reachableEndings: number
}

function targetsOf(scene: AuthoredScene): (string | null)[] {
  switch (scene.outcome.kind) {
    case 'suite':
      return [scene.outcome.next]
    case 'choix':
      return scene.outcome.options.map((o) => o.next)
    case 'fin':
      return []
  }
}

export function analyzeStory(story: AuthoredStory): StoryAnalysis {
  const reachable = new Set<string>()
  const queue = [story.startId]
  while (queue.length) {
    const id = queue.pop()!
    if (reachable.has(id) || !story.scenes[id]) continue
    reachable.add(id)
    for (const t of targetsOf(story.scenes[id])) if (t) queue.push(t)
  }

  const scenes: Record<string, SceneAnalysis> = {}
  const tips: PlumeTip[] = []
  let endingCount = 0
  let reachableEndings = 0

  for (const scene of Object.values(story.scenes)) {
    let choiceScore: number | null = null
    if (scene.outcome.kind === 'choix') {
      const opts = scene.outcome.options
      const targets = new Set(opts.map((o) => o.next ?? '∅'))
      const diverges = targets.size > 1
      const hasEffects = opts.some(
        (o) => Object.values(o.hearts).some((n) => n !== 0) || o.setFlags.length > 0,
      )
      choiceScore = diverges && hasEffects ? 3 : diverges || hasEffects ? 2 : 1
      if (choiceScore === 1 && opts.length > 1) {
        tips.push({
          sceneId: scene.id,
          emoji: '🪶',
          text: `Le choix de « ${scene.titre} » ne change rien pour l'instant… Et si une réponse touchait le cœur d'un personnage, ou menait ailleurs ?`,
        })
      }
      opts.forEach((o) => {
        if (!o.next) {
          tips.push({
            sceneId: scene.id,
            emoji: '➡️',
            text: `Dans « ${scene.titre} », l'option « ${o.text || '…'} » ne mène nulle part. Relie-la à une scène !`,
          })
        }
      })
    }
    if (scene.outcome.kind === 'suite' && !scene.outcome.next) {
      tips.push({
        sceneId: scene.id,
        emoji: '➡️',
        text: `« ${scene.titre} » s'arrête dans le vide. Relie-la à une scène suivante, ou transforme-la en fin.`,
      })
    }
    if (scene.outcome.kind === 'fin') {
      endingCount++
      if (reachable.has(scene.id)) reachableEndings++
      else
        tips.push({
          sceneId: scene.id,
          emoji: '⚠️',
          text: `La fin « ${scene.outcome.title} » est inatteignable : aucun chemin n'y mène.`,
        })
    }
    if (!reachable.has(scene.id) && scene.outcome.kind !== 'fin') {
      tips.push({
        sceneId: scene.id,
        emoji: '🏝️',
        text: `« ${scene.titre} » est isolée : aucune flèche n'y arrive.`,
      })
    }
    scenes[scene.id] = { choiceScore, reachable: reachable.has(scene.id) }
  }

  if (endingCount === 0) {
    tips.push({ sceneId: null, emoji: '🪶', text: 'Ton histoire n’a pas encore de fin. Ajoute une scène et choisis « Fin » !' })
  } else if (endingCount === 1) {
    tips.push({ sceneId: null, emoji: '💡', text: 'Une seule fin pour l’instant. Les meilleures histoires en cachent plusieurs…' })
  }

  return { scenes, tips, endingCount, reachableEndings }
}

/** Positions des nœuds pour le canevas : colonnes par profondeur depuis le départ. */
export function layoutStory(story: AuthoredStory): Record<string, { x: number; y: number }> {
  const depth = new Map<string, number>()
  const queue: [string, number][] = [[story.startId, 0]]
  while (queue.length) {
    const [id, d] = queue.shift()!
    if (!story.scenes[id] || depth.has(id)) continue
    depth.set(id, d)
    for (const t of targetsOf(story.scenes[id])) if (t) queue.push([t, d + 1])
  }
  let maxDepth = 0
  for (const d of depth.values()) maxDepth = Math.max(maxDepth, d)
  // scènes isolées : dernière colonne
  for (const id of Object.keys(story.scenes)) {
    if (!depth.has(id)) depth.set(id, maxDepth + 1)
  }
  const columns = new Map<number, string[]>()
  for (const id of Object.keys(story.scenes)) {
    const d = depth.get(id)!
    if (!columns.has(d)) columns.set(d, [])
    columns.get(d)!.push(id)
  }
  const pos: Record<string, { x: number; y: number }> = {}
  for (const [d, ids] of columns) {
    ids.forEach((id, i) => {
      pos[id] = { x: 30 + d * 270, y: 30 + i * 170 }
    })
  }
  return pos
}
