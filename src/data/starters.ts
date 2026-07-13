import type { AvatarConfig } from '../avatar/types'
import { defaultAvatar } from '../avatar/types'

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
  },
]

/** Décors que Plume propose de faire peindre à l'IA, par univers (même style maison). */
export const DECOR_SEEDS: Record<string, string[]> = {
  sakura: [
    'la cour de l’école sous les cerisiers en fleurs',
    'une salle de classe ensoleillée le matin',
    'le toit de l’école au coucher du soleil',
    'la rue commerçante décorée pour le festival',
  ],
  scene: [
    'une grande scène de concert avec des projecteurs colorés',
    'les coulisses avant le spectacle, pleines de costumes',
    'une salle de répétition cosy avec des instruments',
    'la foule qui applaudit vue depuis la scène',
  ],
  royaumes: [
    'une salle de bal de château avec des lustres dorés',
    'un jardin royal fleuri avec une fontaine',
    'une bibliothèque ancienne pleine de grimoires',
    'un balcon de château au clair de lune',
  ],
}
