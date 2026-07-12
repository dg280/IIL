export type HairStyle = 'long' | 'couettes' | 'carre' | 'chignon'
export type Outfit = 'uniforme' | 'sweat' | 'etoile' | 'pop' | 'bal' | 'aventure'
export type Accessory = 'aucun' | 'noeud' | 'diademe' | 'lunettes' | 'etoile'
export type Expression = 'neutre' | 'joie' | 'gene' | 'surprise' | 'triste' | 'colere'

export interface AvatarConfig {
  skin: string
  hairStyle: HairStyle
  hairColor: string
  outfit: Outfit
  outfitColor: string
  outfitColor2: string
  accessory: Accessory
}

export const SKIN_TONES = ['#ffe3d3', '#f8cba9', '#e8ae82', '#c68a5e', '#9c6a44', '#7a4f32']

export const HAIR_COLORS = [
  '#5b4238', '#2e2a33', '#f0c869', '#f49ac1', '#8ec9f2',
  '#a58cf0', '#e07a5f', '#e8e6ef', '#8fd6b8',
]

export const OUTFIT_COLORS = [
  '#5a77c9', '#e35d7c', '#f2b33d', '#67b57f', '#8a63d2',
  '#3e3a4a', '#f5f1f7', '#e98a4e', '#59c2c9',
]

export interface OutfitInfo {
  id: Outfit
  label: string
  universe: 'sakura' | 'scene' | 'royaumes'
}

export const OUTFITS: OutfitInfo[] = [
  { id: 'uniforme', label: 'Uniforme Sakura', universe: 'sakura' },
  { id: 'sweat', label: 'Tenue décontractée', universe: 'sakura' },
  { id: 'etoile', label: 'Robe étoilée', universe: 'scene' },
  { id: 'pop', label: 'Look pop star', universe: 'scene' },
  { id: 'bal', label: 'Robe de bal', universe: 'royaumes' },
  { id: 'aventure', label: "Tenue d'aventurière", universe: 'royaumes' },
]

export const HAIR_STYLES: { id: HairStyle; label: string }[] = [
  { id: 'long', label: 'Cheveux longs' },
  { id: 'couettes', label: 'Couettes' },
  { id: 'carre', label: 'Carré' },
  { id: 'chignon', label: 'Chignon' },
]

export const ACCESSORIES: { id: Accessory; label: string }[] = [
  { id: 'aucun', label: 'Aucun' },
  { id: 'noeud', label: 'Nœud' },
  { id: 'diademe', label: 'Diadème' },
  { id: 'lunettes', label: 'Lunettes' },
  { id: 'etoile', label: 'Barrette étoile' },
]

export const EXPRESSIONS: { id: Expression; label: string }[] = [
  { id: 'neutre', label: 'Neutre' },
  { id: 'joie', label: 'Joie' },
  { id: 'gene', label: 'Gênée' },
  { id: 'surprise', label: 'Surprise' },
  { id: 'triste', label: 'Triste' },
  { id: 'colere', label: 'Fâchée' },
]

export function defaultAvatar(): AvatarConfig {
  return {
    skin: SKIN_TONES[1],
    hairStyle: 'long',
    hairColor: HAIR_COLORS[0],
    outfit: 'uniforme',
    outfitColor: OUTFIT_COLORS[0],
    outfitColor2: '#f5f1f7',
    accessory: 'aucun',
  }
}
