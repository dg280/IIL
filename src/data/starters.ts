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
  hint: string
  /** apparence de secours si l'IA n'est pas branchée */
  config: AvatarConfig
}

export const PLUME_STARTERS: StarterCharacter[] = [
  {
    emoji: '🌼',
    name: 'Camille',
    descr: 'une amie d’enfance chaleureuse, cheveux bouclés châtains, grand sourire, joues roses',
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
    descr: 'un·e élève mystérieux·se aux cheveux sombres et aux yeux clairs, air rêveur et calme',
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
    descr: 'un·e camarade drôle et pétillant·e, cheveux en bataille, taches de rousseur, air malicieux',
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
