export type BodyType = 'fille' | 'garcon'
export type HairStyle =
  | 'long'
  | 'couettes'
  | 'carre'
  | 'chignon'
  | 'court'
  | 'meche'
  | 'hirsute'
  | 'queue'
  | 'tresse'
  | 'mi_long'
export type Outfit =
  | 'uniforme'
  | 'gakuran'
  | 'sweat'
  | 'etoile'
  | 'pop'
  | 'bal'
  | 'aventure'
  | 'blazer'
  | 'scene_rock'
  | 'prince'
export type Accessory = 'aucun' | 'noeud' | 'diademe' | 'lunettes' | 'etoile'
export type Expression = 'neutre' | 'joie' | 'gene' | 'surprise' | 'triste' | 'colere'

export interface AvatarConfig {
  body: BodyType
  skin: string
  hairStyle: HairStyle
  hairColor: string
  eyeColor: string
  outfit: Outfit
  outfitColor: string
  outfitColor2: string
  accessory: Accessory
  accessoryColor: string
}

export const SKIN_TONES = ['#ffe3d3', '#f8cba9', '#e8ae82', '#c68a5e', '#9c6a44', '#7a4f32']

export const HAIR_COLORS = [
  '#5b4238', '#2e2a33', '#8a3f2e', '#f0c869', '#f49ac1', '#8ec9f2',
  '#a58cf0', '#e07a5f', '#e8e6ef', '#8fd6b8', '#2f3a63', '#c9b8f5',
]

export const EYE_COLORS = ['#5a4632', '#3e5f8a', '#3f6d4e', '#6b4a86', '#a3622f', '#4a4a58', '#8a2f3e', '#2f7a80']

export const OUTFIT_COLORS = [
  '#5a77c9', '#e35d7c', '#f2b33d', '#67b57f', '#8a63d2',
  '#3e3a4a', '#f5f1f7', '#e98a4e', '#59c2c9', '#f6a8c8', '#a83242',
]

export const ACCESSORY_COLORS = [
  '#f2c94c', '#e35d7c', '#5a77c9', '#8a63d2', '#67b57f',
  '#3e3a4a', '#f5f1f7', '#59c2c9', '#f6a8c8',
]

export const BODIES: { id: BodyType; label: string; emoji: string }[] = [
  { id: 'fille', label: 'Fille', emoji: '👧' },
  { id: 'garcon', label: 'Garçon', emoji: '👦' },
]

export interface OutfitInfo {
  id: Outfit
  label: string
  universe: 'sakura' | 'scene' | 'royaumes'
}

export const OUTFITS: OutfitInfo[] = [
  { id: 'uniforme', label: 'Uniforme marin', universe: 'sakura' },
  { id: 'gakuran', label: 'Uniforme gakuran', universe: 'sakura' },
  { id: 'blazer', label: 'Uniforme blazer', universe: 'sakura' },
  { id: 'sweat', label: 'Décontracté', universe: 'sakura' },
  { id: 'etoile', label: 'Robe étoilée', universe: 'scene' },
  { id: 'pop', label: 'Look pop star', universe: 'scene' },
  { id: 'scene_rock', label: 'Veste de scène', universe: 'scene' },
  { id: 'bal', label: 'Robe de bal', universe: 'royaumes' },
  { id: 'prince', label: 'Tenue princière', universe: 'royaumes' },
  { id: 'aventure', label: "Tenue d'aventure", universe: 'royaumes' },
]

export const HAIR_STYLES: { id: HairStyle; label: string }[] = [
  { id: 'long', label: 'Longs' },
  { id: 'mi_long', label: 'Mi-longs' },
  { id: 'queue', label: 'Queue de cheval' },
  { id: 'tresse', label: 'Tresse' },
  { id: 'couettes', label: 'Couettes' },
  { id: 'carre', label: 'Carré' },
  { id: 'chignon', label: 'Chignon' },
  { id: 'court', label: 'Courts' },
  { id: 'meche', label: 'Mèche' },
  { id: 'hirsute', label: 'En bataille' },
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
  { id: 'gene', label: 'Gêné·e' },
  { id: 'surprise', label: 'Surprise' },
  { id: 'triste', label: 'Triste' },
  { id: 'colere', label: 'Fâché·e' },
]

export function defaultAvatar(): AvatarConfig {
  return {
    body: 'fille',
    skin: SKIN_TONES[1],
    hairStyle: 'long',
    hairColor: HAIR_COLORS[0],
    eyeColor: EYE_COLORS[0],
    outfit: 'uniforme',
    outfitColor: OUTFIT_COLORS[0],
    outfitColor2: '#f5f1f7',
    accessory: 'aucun',
    accessoryColor: ACCESSORY_COLORS[0],
  }
}

/** Complète les configs enregistrées avant l'ajout de nouveaux champs. */
export function normalizeAvatar(config: Partial<AvatarConfig> | undefined): AvatarConfig {
  return { ...defaultAvatar(), ...(config ?? {}) }
}
