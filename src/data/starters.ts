import type { AvatarConfig, Accessory, HairStyle, Outfit } from '../avatar/types'
import { defaultAvatar } from '../avatar/types'
import type { UniverseId } from '../universes'

/**
 * Les 3 premiers personnages proposés par Plume : chaque enfant part des mêmes
 * archétypes (prompts auto), mais génère des portraits uniques via l'IA — tous
 * dans le style maison cozy (voir STYLE_BASE dans genai.ts), donc cohérents
 * d'une expérience à l'autre. Un dessin de secours (paper-doll) garantit qu'un
 * personnage n'est jamais « vide » même sans IA.
 */
export interface StarterCharacter {
  emoji: string
  name: string
  /** description injectée telle quelle dans le prompt de portrait IA */
  descr: string
  /** traits distinctifs courts — servent d'inverse-prompt pour DIFFÉRENCIER
   *  ce personnage des autres (on exclut les traits des autres) */
  traits: string
  hint: string
  /** apparence de secours si l'IA n'est pas branchée */
  config: AvatarConfig
  /** personnalité (indépendante du physique/de la tenue), utilisée pour composer
   *  les variantes ci-dessous — sans elle, la Cérémonie proposerait toujours
   *  exactement le même physique et la même tenue à chaque partie. */
  personality: string
  /** physiques alternatifs (coiffure/couleur/carnation/regard) : un seul est
   *  tiré au sort à chaque Cérémonie, pour varier d'une partie à l'autre. */
  physiqueVariants: PhysiqueVariant[]
  /** tenue adaptée à chaque univers (au lieu d'une tenue unique et figée). */
  outfitsByUniverse: Record<UniverseId, UniverseOutfit>
}

export interface PhysiqueVariant {
  hairStyle: HairStyle
  hairColor: string
  eyeColor: string
  skin: string
  /** fragment injecté dans le prompt IA (coiffure/carnation/regard) */
  descr: string
  /** fragment court pour l'inverse-prompt (différenciation entre personnages) */
  traits: string
}

export interface UniverseOutfit {
  outfit: Outfit
  outfitColor: string
  outfitColor2: string
  accessory: Accessory
  accessoryColor: string
}

export const PLUME_STARTERS: StarterCharacter[] = [
  {
    emoji: '🌼',
    name: 'Camille',
    descr: 'une fille douce et souriante, longs cheveux auburn (châtain-roux) ondulés, joues roses, yeux noisette pétillants, un petit nœud dans les cheveux',
    traits: 'fille, longs cheveux auburn ondulés, nœud dans les cheveux, yeux noisette',
    hint: 'Ton amie d’enfance, toujours de bonne humeur',
    config: {
      ...defaultAvatar(),
      body: 'fille',
      skin: '#f8cba9',
      hairStyle: 'couettes',
      hairColor: '#8a3f2e',
      eyeColor: '#5a4632',
      outfit: 'sweat',
      outfitColor: '#f2b33d',
      outfitColor2: '#e98a4e',
      accessory: 'noeud',
      accessoryColor: '#e35d7c',
    },
    personality: 'une fille douce et souriante',
    physiqueVariants: [
      {
        hairStyle: 'couettes',
        hairColor: '#8a3f2e',
        eyeColor: '#5a4632',
        skin: '#f8cba9',
        descr: 'longs cheveux auburn (châtain-roux) ondulés en couettes, joues roses, yeux noisette pétillants, un petit nœud dans les cheveux',
        traits: 'longs cheveux auburn ondulés, nœud dans les cheveux, yeux noisette',
      },
      {
        hairStyle: 'queue',
        hairColor: '#f0c869',
        eyeColor: '#3e5f8a',
        skin: '#ffe3d3',
        descr: 'cheveux blonds noués en queue de cheval, joues roses, grands yeux bleu profond, sourire chaleureux',
        traits: 'cheveux blonds en queue de cheval, yeux bleu profond',
      },
      {
        hairStyle: 'carre',
        hairColor: '#5b4238',
        eyeColor: '#3f6d4e',
        skin: '#c68a5e',
        descr: 'cheveux châtains coupés au carré, teint hâlé, yeux verts pétillants, sourire éclatant',
        traits: 'cheveux châtains au carré, teint hâlé, yeux verts',
      },
    ],
    outfitsByUniverse: {
      sakura: { outfit: 'sweat', outfitColor: '#f2b33d', outfitColor2: '#e98a4e', accessory: 'noeud', accessoryColor: '#e35d7c' },
      scene: { outfit: 'etoile', outfitColor: '#8a63d2', outfitColor2: '#f6a8c8', accessory: 'noeud', accessoryColor: '#f2c94c' },
      royaumes: { outfit: 'bal', outfitColor: '#e35d7c', outfitColor2: '#f2c94c', accessory: 'diademe', accessoryColor: '#f2c94c' },
    },
  },
  {
    emoji: '🌙',
    name: 'Alix',
    descr: 'un garçon calme au regard mystérieux, cheveux noir bleuté mi-longs avec une longue mèche devant un œil, teint pâle, yeux vert d’eau, expression rêveuse',
    traits: 'garçon, cheveux noir bleuté, longue mèche sur l’œil, teint pâle, yeux vert d’eau',
    hint: 'La personne mystérieuse de l’école',
    config: {
      ...defaultAvatar(),
      body: 'garcon',
      skin: '#e8ae82',
      hairStyle: 'meche',
      hairColor: '#2f3a63',
      eyeColor: '#2f7a80',
      outfit: 'blazer',
      outfitColor: '#3e3a4a',
      outfitColor2: '#5a77c9',
      accessory: 'aucun',
      accessoryColor: '#f2c94c',
    },
    personality: 'un garçon calme au regard mystérieux',
    physiqueVariants: [
      {
        hairStyle: 'meche',
        hairColor: '#2f3a63',
        eyeColor: '#2f7a80',
        skin: '#e8ae82',
        descr: 'cheveux noir bleuté mi-longs avec une longue mèche devant un œil, teint pâle, yeux vert d’eau, expression rêveuse',
        traits: 'cheveux noir bleuté, longue mèche sur l’œil, teint pâle, yeux vert d’eau',
      },
      {
        hairStyle: 'mi_long',
        hairColor: '#e8e6ef',
        eyeColor: '#6b4a86',
        skin: '#ffe3d3',
        descr: 'cheveux argentés mi-longs, teint pâle, regard violet mystérieux, expression posée',
        traits: 'cheveux argentés mi-longs, yeux violets',
      },
      {
        hairStyle: 'court',
        hairColor: '#2e2a33',
        eyeColor: '#a3622f',
        skin: '#c68a5e',
        descr: 'cheveux noirs courts bien coiffés, teint hâlé, regard ambré calme et posé',
        traits: 'cheveux noirs courts, teint hâlé, yeux ambrés',
      },
    ],
    outfitsByUniverse: {
      sakura: { outfit: 'blazer', outfitColor: '#3e3a4a', outfitColor2: '#5a77c9', accessory: 'aucun', accessoryColor: '#f2c94c' },
      scene: { outfit: 'scene_rock', outfitColor: '#3e3a4a', outfitColor2: '#59c2c9', accessory: 'aucun', accessoryColor: '#f2c94c' },
      royaumes: { outfit: 'prince', outfitColor: '#3e5f8a', outfitColor2: '#f2c94c', accessory: 'aucun', accessoryColor: '#f2c94c' },
    },
  },
  {
    emoji: '⭐',
    name: 'Robin',
    descr: 'un garçon espiègle et rieur, cheveux roux vif courts et ébouriffés, nombreuses taches de rousseur sur les joues, grand sourire malicieux, yeux verts',
    traits: 'garçon, cheveux roux courts ébouriffés, taches de rousseur, grand sourire, yeux verts',
    hint: 'Le boute-en-train de la bande',
    config: {
      ...defaultAvatar(),
      body: 'garcon',
      skin: '#c68a5e',
      hairStyle: 'hirsute',
      hairColor: '#e07a5f',
      eyeColor: '#3f6d4e',
      outfit: 'pop',
      outfitColor: '#59c2c9',
      outfitColor2: '#f2c94c',
      accessory: 'etoile',
      accessoryColor: '#f2c94c',
    },
    personality: 'un garçon espiègle et rieur',
    physiqueVariants: [
      {
        hairStyle: 'hirsute',
        hairColor: '#e07a5f',
        eyeColor: '#3f6d4e',
        skin: '#c68a5e',
        descr: 'cheveux roux vif courts et ébouriffés, nombreuses taches de rousseur sur les joues, grand sourire malicieux, yeux verts',
        traits: 'cheveux roux courts ébouriffés, taches de rousseur, yeux verts',
      },
      {
        hairStyle: 'court',
        hairColor: '#f0c869',
        eyeColor: '#3e5f8a',
        skin: '#ffe3d3',
        descr: 'cheveux blonds courts en bataille, légères taches de rousseur, sourire malicieux, yeux bleus pétillants',
        traits: 'cheveux blonds courts, yeux bleus',
      },
      {
        hairStyle: 'hirsute',
        hairColor: '#2e2a33',
        eyeColor: '#5a4632',
        skin: '#e8ae82',
        descr: 'cheveux noirs courts et ébouriffés, grand sourire malicieux, taches de rousseur discrètes, yeux marron pétillants',
        traits: 'cheveux noirs ébouriffés, yeux marron',
      },
    ],
    outfitsByUniverse: {
      sakura: { outfit: 'gakuran', outfitColor: '#3e3a4a', outfitColor2: '#f5f1f7', accessory: 'etoile', accessoryColor: '#f2c94c' },
      scene: { outfit: 'pop', outfitColor: '#59c2c9', outfitColor2: '#f2c94c', accessory: 'etoile', accessoryColor: '#f2c94c' },
      royaumes: { outfit: 'aventure', outfitColor: '#67b57f', outfitColor2: '#a83242', accessory: 'etoile', accessoryColor: '#f2c94c' },
    },
  },
]

/** Tire au sort un physique + une tenue adaptée à l'univers pour un starter :
 *  sans ce tirage, la Cérémonie proposait toujours EXACTEMENT le même physique
 *  et la même tenue (fixe, jamais adaptée à l'univers choisi) à chaque partie. */
export function pickStarterVariant(s: StarterCharacter, universe: UniverseId): { descr: string; traits: string; config: AvatarConfig } {
  const physique = s.physiqueVariants[Math.floor(Math.random() * s.physiqueVariants.length)]
  const outfit = s.outfitsByUniverse[universe] ?? s.outfitsByUniverse.sakura
  const genderWord = s.config.body === 'garcon' ? 'garçon' : 'fille'
  return {
    descr: `${s.personality}, ${physique.descr}`,
    traits: `${genderWord}, ${physique.traits}`,
    config: {
      ...defaultAvatar(),
      body: s.config.body,
      skin: physique.skin,
      hairStyle: physique.hairStyle,
      hairColor: physique.hairColor,
      eyeColor: physique.eyeColor,
      ...outfit,
    },
  }
}

/** Décors que Plume propose de faire peindre à l'IA, par univers (même style maison). */
export const DECOR_SEEDS: Record<string, string[]> = {
  sakura: [
    'une salle de classe ensoleillée le matin, intérieur',
    'la bibliothèque de l’école, calme et lumineuse, intérieur',
    'la salle de musique avec un grand piano, intérieur',
    'le réfectoire de l’école à l’heure du déjeuner, intérieur',
    'un couloir d’école avec des casiers, intérieur',
    'une chambre d’ado cosy et bien rangée, intérieur',
    'un petit café douillet en ville, intérieur',
    'la supérette du quartier le soir, intérieur',
    'le gymnase de l’école, intérieur',
    'la cour de l’école au printemps',
    'le toit de l’école au coucher du soleil',
    'le bord de la rivière en fin de journée',
    'la gare de la petite ville',
    'la rue commerçante décorée pour le festival',
  ],
  scene: [
    'une grande scène de concert avec des projecteurs colorés',
    'les coulisses avant le spectacle, pleines de costumes, intérieur',
    'une salle de répétition cosy avec des instruments, intérieur',
    'la foule qui applaudit vue depuis la scène',
    'une loge d’artiste avec un miroir entouré d’ampoules, intérieur',
    'un studio d’enregistrement feutré, intérieur',
  ],
  royaumes: [
    'une salle de bal de château avec des lustres dorés, intérieur',
    'un jardin royal fleuri avec une fontaine',
    'une bibliothèque ancienne pleine de grimoires, intérieur',
    'un balcon de château au clair de lune',
    'une grande cuisine de château animée, intérieur',
    'une salle du trône majestueuse, intérieur',
  ],
}

/** Tire au sort `count` décors parmi ceux de l'univers (sans répétition) : sans ce
 *  tirage, la Cérémonie proposait toujours les 3 mêmes décors (les premiers de la
 *  liste) à chaque partie. */
export function pickRandomDecors(universe: UniverseId, count = 3): string[] {
  const pool = [...(DECOR_SEEDS[universe] ?? [])]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count)
}
