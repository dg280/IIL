import type { Expression } from '../avatar/types'
import type { SpritePos } from '../engine/types'
import type { UniverseId } from '../universes'

export interface AuthoredOption {
  text: string
  next: string | null
  /** deltas d'affinité par personnage, ex: { yuki: 1 } */
  hearts: Record<string, number>
  /** souvenirs (drapeaux) posés en prenant cette option */
  setFlags: string[]
  /** option visible seulement si ce souvenir est posé */
  needFlag: string | null
}

export type Outcome =
  | { kind: 'suite'; next: string | null }
  | { kind: 'choix'; options: AuthoredOption[] }
  | { kind: 'fin'; title: string; emoji: string }

export interface CastMember {
  who: string
  expr: Expression
  at: SpritePos
}

export interface Line {
  who: string | null // null = narratrice
  text: string
}

export interface AuthoredScene {
  id: string
  titre: string
  bg: string
  cast: CastMember[]
  lines: Line[]
  outcome: Outcome
}

export interface AuthoredStory {
  id: string
  title: string
  universe: UniverseId
  /** ids roster des personnages de l'histoire (hors mc/self) */
  characters: string[]
  scenes: Record<string, AuthoredScene>
  startId: string
}

export const FIN_EMOJIS = ['⭐', '🌟', '🌸', '💖', '🍃', '🎭', '👑', '🎤', '🔮', '🌙']

export const CHAR_COLORS = ['#5a77c9', '#d2568f', '#67b57f', '#e98a4e', '#8a63d2', '#59c2c9']

export function nextSceneId(story: AuthoredStory): string {
  let n = 1
  while (story.scenes[`sc${n}`]) n++
  return `sc${n}`
}

export function newScene(id: string, bg: string): AuthoredScene {
  return {
    id,
    titre: 'Nouvelle scène',
    bg,
    cast: [],
    lines: [{ who: null, text: '' }],
    outcome: { kind: 'suite', next: null },
  }
}

export function defaultBg(universe: UniverseId): string {
  switch (universe) {
    case 'scene':
      return 'scene_concert'
    case 'royaumes':
      return 'salle_bal'
    default:
      return 'cour_sakura'
  }
}

export function newOption(): AuthoredOption {
  return { text: '', next: null, hearts: {}, setFlags: [], needFlag: null }
}

/** Tous les souvenirs (drapeaux) utilisés quelque part dans l'histoire. */
export function allFlags(story: AuthoredStory): string[] {
  const flags = new Set<string>()
  for (const scene of Object.values(story.scenes)) {
    if (scene.outcome.kind === 'choix') {
      for (const o of scene.outcome.options) {
        o.setFlags.forEach((f) => flags.add(f))
        if (o.needFlag) flags.add(o.needFlag)
      }
    }
  }
  return [...flags]
}

// ---------------------------------------------------------------- templates

export type TemplateId = 'vierge' | 'secret'

export const TEMPLATES: { id: TemplateId; emoji: string; label: string; desc: string }[] = [
  {
    id: 'vierge',
    emoji: '📄',
    label: 'Page blanche',
    desc: 'Une seule scène de départ : à toi d’inventer toute la suite.',
  },
  {
    id: 'secret',
    emoji: '🤫',
    label: 'Le Secret',
    desc: 'Un squelette à 2 branches et 2 fins, avec les trous à remplir. Idéal pour commencer !',
  },
]

export function createStory(id: string, title: string, universe: UniverseId, template: TemplateId, characters: string[]): AuthoredStory {
  const bg = defaultBg(universe)
  if (template === 'vierge') {
    const start = newScene('sc1', bg)
    start.titre = 'Début'
    return { id, title, universe, characters, scenes: { sc1: start }, startId: 'sc1' }
  }

  // Squelette « Le Secret »
  const perso = characters[0] ?? null
  const hearts1: Record<string, number> = perso ? { [perso]: 1 } : {}
  const scenes: Record<string, AuthoredScene> = {
    sc1: {
      id: 'sc1',
      titre: 'La découverte',
      bg,
      cast: perso ? [{ who: perso, expr: 'neutre', at: 'center' }] : [],
      lines: [
        { who: null, text: 'Écris ici comment tout commence… Ton héroïne découvre un secret !' },
        { who: perso, text: 'Remplace cette réplique : que dit ce personnage ?' },
      ],
      outcome: {
        kind: 'choix',
        options: [
          { text: 'Garder le secret', next: 'sc2', hearts: hearts1, setFlags: ['secret_garde'], needFlag: null },
          { text: 'Révéler le secret', next: 'sc3', hearts: {}, setFlags: [], needFlag: null },
        ],
      },
    },
    sc2: {
      id: 'sc2',
      titre: 'Le secret bien gardé',
      bg,
      cast: perso ? [{ who: perso, expr: 'joie', at: 'center' }] : [],
      lines: [{ who: null, text: 'Que se passe-t-il quand on garde le secret ? Écris cette scène !' }],
      outcome: { kind: 'suite', next: 'sc4' },
    },
    sc3: {
      id: 'sc3',
      titre: 'Le secret révélé',
      bg,
      cast: perso ? [{ who: perso, expr: 'surprise', at: 'center' }] : [],
      lines: [{ who: null, text: 'Et si le secret est révélé, que change-t-il ? Écris cette scène !' }],
      outcome: { kind: 'suite', next: 'sc5' },
    },
    sc4: {
      id: 'sc4',
      titre: 'Fin complice',
      bg,
      cast: [],
      lines: [{ who: null, text: 'La belle fin de la branche « secret gardé »… à toi de l’écrire !' }],
      outcome: { kind: 'fin', title: 'Complices pour toujours', emoji: '💖' },
    },
    sc5: {
      id: 'sc5',
      titre: 'Fin vérité',
      bg,
      cast: [],
      lines: [{ who: null, text: 'La fin de la branche « vérité »… surprenante ? émouvante ? À toi !' }],
      outcome: { kind: 'fin', title: 'La vérité éclate', emoji: '🌟' },
    },
  }
  return { id, title, universe, characters, scenes, startId: 'sc1' }
}
