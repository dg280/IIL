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
  /** option visible seulement si l'affinité d'un personnage atteint un seuil */
  needHearts?: { who: string; min: number } | null
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
  return { text: '', next: null, hearts: {}, setFlags: [], needFlag: null, needHearts: null }
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

export type TemplateId = 'vierge' | 'secret' | 'trois_coeurs' | 'enquete'

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
  {
    id: 'trois_coeurs',
    emoji: '💗',
    label: 'Les Trois Cœurs',
    desc: 'Une route par personnage : les fins se débloquent avec l’affinité, comme dans les vrais otome !',
  },
  {
    id: 'enquete',
    emoji: '🕵️',
    label: "L'Enquête",
    desc: 'Récolte des indices (souvenirs 🚩) — la confrontation finale dépend de ce que tu as trouvé.',
  },
]

export function createStory(id: string, title: string, universe: UniverseId, template: TemplateId, characters: string[]): AuthoredStory {
  const bg = defaultBg(universe)
  if (template === 'vierge') {
    const start = newScene('sc1', bg)
    start.titre = 'Début'
    return { id, title, universe, characters, scenes: { sc1: start }, startId: 'sc1' }
  }

  if (template === 'trois_coeurs') {
    const cast = characters.slice(0, 3)
    const scenes: Record<string, AuthoredScene> = {}
    const routeIds = cast.map((_, i) => `sc${i + 2}`)
    scenes.sc1 = {
      id: 'sc1',
      titre: 'Le grand jour',
      bg,
      cast: cast.map((who, i) => ({ who, expr: 'neutre', at: (['left', 'center', 'right'] as const)[i] ?? 'center' })),
      lines: [{ who: null, text: 'Une journée spéciale commence… Avec qui vas-tu la passer ? Écris le décor de départ !' }],
      outcome: {
        kind: 'choix',
        options: cast.map((who, i) => ({
          text: `Passer la journée ensemble (personnage ${i + 1})`,
          next: routeIds[i],
          hearts: { [who]: 2 },
          setFlags: [],
          needFlag: null,
          needHearts: null,
        })),
      },
    }
    cast.forEach((who, i) => {
      scenes[routeIds[i]] = {
        id: routeIds[i],
        titre: `Route ${i + 1}`,
        bg,
        cast: [{ who, expr: 'joie', at: 'center' }],
        lines: [{ who, text: 'Écris ici le moment fort de cette route : un souvenir, un fou rire, une confidence…' }],
        outcome: { kind: 'suite', next: 'scfinal' },
      }
    })
    scenes.scfinal = {
      id: 'scfinal',
      titre: 'Le coucher de soleil',
      bg,
      cast: [],
      lines: [{ who: null, text: 'La journée se termine… La fin dépend du cœur que tu as fait battre !' }],
      outcome: {
        kind: 'choix',
        options: [
          ...cast.map((who, i) => ({
            text: `Fin spéciale (personnage ${i + 1})`,
            next: `scfin${i + 1}`,
            hearts: {},
            setFlags: [],
            needFlag: null,
            needHearts: { who, min: 2 },
          })),
          { text: 'Rentrer tranquillement', next: 'scfin0', hearts: {}, setFlags: [], needFlag: null, needHearts: null },
        ],
      },
    }
    scenes.scfin0 = {
      id: 'scfin0',
      titre: 'Fin douce',
      bg,
      cast: [],
      lines: [{ who: null, text: 'Une fin toute simple et jolie — écris-la !' }],
      outcome: { kind: 'fin', title: 'Une belle journée', emoji: '🍃' },
    }
    cast.forEach((who, i) => {
      scenes[`scfin${i + 1}`] = {
        id: `scfin${i + 1}`,
        titre: `Fin route ${i + 1}`,
        bg,
        cast: [{ who, expr: 'gene', at: 'center' }],
        lines: [{ who: null, text: 'La fin réservée à cette route… le grand moment d’émotion, à toi de l’écrire !' }],
        outcome: { kind: 'fin', title: `Cœur à cœur ${i + 1}`, emoji: '💖' },
      }
    })
    return { id, title, universe, characters, scenes, startId: 'sc1' }
  }

  if (template === 'enquete') {
    const temoin = characters[0] ?? null
    const scenes: Record<string, AuthoredScene> = {
      sc1: {
        id: 'sc1',
        titre: 'Le mystère',
        bg,
        cast: temoin ? [{ who: temoin, expr: 'surprise', at: 'center' }] : [],
        lines: [{ who: null, text: 'Quelque chose a disparu ! Décris le mystère à résoudre…' }],
        outcome: { kind: 'suite', next: 'sc2' },
      },
      sc2: {
        id: 'sc2',
        titre: 'Le premier indice',
        bg,
        cast: [],
        lines: [{ who: null, text: 'Un détail bizarre attire ton attention…' }],
        outcome: {
          kind: 'choix',
          options: [
            { text: 'Fouiller pour trouver un indice 🔍', next: 'sc3', hearts: {}, setFlags: ['indice_lieu'], needFlag: null, needHearts: null },
            { text: 'Continuer sans regarder', next: 'sc3', hearts: {}, setFlags: [], needFlag: null, needHearts: null },
          ],
        },
      },
      sc3: {
        id: 'sc3',
        titre: 'Le témoin',
        bg,
        cast: temoin ? [{ who: temoin, expr: 'gene', at: 'center' }] : [],
        lines: [{ who: temoin, text: 'Écris ce que le témoin a vu… si on pense à lui demander !' }],
        outcome: {
          kind: 'choix',
          options: [
            { text: 'Poser LA bonne question 💬', next: 'sc4', hearts: {}, setFlags: ['indice_temoin'], needFlag: null, needHearts: null },
            { text: 'Ne pas oser déranger', next: 'sc4', hearts: {}, setFlags: [], needFlag: null, needHearts: null },
          ],
        },
      },
      sc4: {
        id: 'sc4',
        titre: 'La confrontation',
        bg,
        cast: [],
        lines: [{ who: null, text: 'L’heure de vérité ! Tes options dépendent des indices 🚩 récoltés en chemin.' }],
        outcome: {
          kind: 'choix',
          options: [
            { text: 'Révéler toute la vérité, preuves à l’appui !', next: 'sc5', hearts: {}, setFlags: [], needFlag: 'indice_lieu', needHearts: null },
            { text: 'Citer le témoin', next: 'sc5', hearts: {}, setFlags: [], needFlag: 'indice_temoin', needHearts: null },
            { text: 'Accuser au hasard…', next: 'sc6', hearts: {}, setFlags: [], needFlag: null, needHearts: null },
          ],
        },
      },
      sc5: {
        id: 'sc5',
        titre: 'Mystère résolu',
        bg,
        cast: [],
        lines: [{ who: null, text: 'Bravo, détective ! Écris la révélation finale.' }],
        outcome: { kind: 'fin', title: 'Mystère résolu', emoji: '🌟' },
      },
      sc6: {
        id: 'sc6',
        titre: 'Fausse piste',
        bg,
        cast: [],
        lines: [{ who: null, text: 'Raté… mais l’enquêtrice apprend de ses erreurs. Écris cette fin (et rejoue en fouinant plus) !' }],
        outcome: { kind: 'fin', title: 'Fausse piste', emoji: '🍂' },
      },
    }
    return { id, title, universe, characters, scenes, startId: 'sc1' }
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
          { text: 'Garder le secret', next: 'sc2', hearts: hearts1, setFlags: ['secret_garde'], needFlag: null, needHearts: null },
          { text: 'Révéler le secret', next: 'sc3', hearts: {}, setFlags: [], needFlag: null, needHearts: null },
        ],
      },
    },
    sc2: {
      id: 'sc2',
      titre: 'Le secret bien gardé',
      bg,
      cast: perso ? [{ who: perso, expr: 'joie', at: 'center' }] : [],
      lines: [{ who: null, text: 'Que se passe-t-il quand on garde le secret ? Écris cette scène !' }],
      outcome: { kind: 'suite', next: 'sc6' },
    },
    sc3: {
      id: 'sc3',
      titre: 'Le secret révélé',
      bg,
      cast: perso ? [{ who: perso, expr: 'surprise', at: 'center' }] : [],
      lines: [{ who: null, text: 'Et si le secret est révélé, que change-t-il ? Écris cette scène !' }],
      outcome: { kind: 'suite', next: 'sc6' },
    },
    sc6: {
      id: 'sc6',
      titre: 'Le grand jour',
      bg,
      cast: perso ? [{ who: perso, expr: 'neutre', at: 'center' }] : [],
      lines: [
        { who: null, text: 'Les deux chemins se retrouvent ici… mais le souvenir 🚩 change ce qui est possible !' },
      ],
      outcome: {
        kind: 'choix',
        options: [
          {
            text: '« Ton secret est en sécurité avec moi. » (option secrète !)',
            next: 'sc4',
            hearts: hearts1,
            setFlags: [],
            needFlag: 'secret_garde',
            needHearts: null,
          },
          { text: 'Profiter de la journée ensemble', next: 'sc5', hearts: {}, setFlags: [], needFlag: null, needHearts: null },
        ],
      },
    },
    sc4: {
      id: 'sc4',
      titre: 'Fin complice',
      bg,
      cast: [],
      lines: [{ who: null, text: 'La belle fin réservée à celles qui ont gardé le secret… à toi de l’écrire !' }],
      outcome: { kind: 'fin', title: 'Complices pour toujours', emoji: '💖' },
    },
    sc5: {
      id: 'sc5',
      titre: 'Fin douce',
      bg,
      cast: [],
      lines: [{ who: null, text: 'Une jolie fin, plus simple… surprenante ? émouvante ? À toi !' }],
      outcome: { kind: 'fin', title: 'Une belle journée', emoji: '🌟' },
    },
  }
  return { id, title, universe, characters, scenes, startId: 'sc1' }
}
