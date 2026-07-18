/**
 * Modèle de monétisation « juste » :
 *  - Gratuit et généreux : slots de base, mots-clés de base, gemmes gagnées en jouant.
 *  - À la carte (gemmes gagnées) : +slots, packs de mots-clés stylés → progression sans argent.
 *  - Passe Créatrice (premium) : tout débloqué, activé par un CODE saisi par un parent
 *    (l'achat réel se fait hors-app → le parent garde le contrôle des dépenses).
 */
import { addReward, getProgress } from './progression'

const KEY_PREMIUM = 'celestine.premium'
const KEY_PACKS = 'celestine.packs'
const KEY_SLOTBONUS = 'celestine.slotbonus'

// slots « vivants » (au-delà → à ranger en bouteille)
export const FREE_PERSO_SLOTS = 6
export const FREE_DECOR_SLOTS = 8
export const PREMIUM_PERSO_SLOTS = 40
export const PREMIUM_DECOR_SLOTS = 50
export const SLOT_BUNDLE = 5
export const SLOT_COST = 80

// codes du Passe Créatrice (achat géré par le parent hors application)
const PREMIUM_CODES = ['PASSE-CREATRICE', 'CELESTINE-PREMIUM', 'PLUME-OR']

/** `group` classe le pack dans l'Atelier :
 *  - 'style'  → styles d'illustration (rendu) sélectionnables ;
 *  - 'type'   → ajoute des TYPES de vêtements dans la rangée « Type » ;
 *  - 'motif'  → ajoute des MOTIFS dans la rangée « Motif ». */
export interface KeywordPack {
  id: string
  label: string
  emoji: string
  cost: number
  words: string[]
  group?: 'style' | 'type' | 'motif'
}

export const KEYWORD_PACKS: KeywordPack[] = [
  // styles d'illustration (rendu)
  { id: 'neon', label: 'Néon', emoji: '🌈', cost: 100, group: 'style', words: ['style néon lumineux', 'reflets holographiques'] },
  { id: 'aquarelle', label: 'Aquarelle', emoji: '🎨', cost: 100, group: 'style', words: ['rendu aquarelle doux', 'contours flous poétiques'] },
  { id: 'manga', label: 'Manga N&B', emoji: '🖤', cost: 100, group: 'style', words: ['style manga noir et blanc', 'trames de points'] },
  { id: 'pixel', label: 'Pixel Art', emoji: '👾', cost: 120, group: 'style', words: ['style pixel art rétro', 'petits carrés colorés'] },
  { id: 'goth', label: 'Pastel Goth', emoji: '🦇', cost: 120, group: 'style', words: ['ambiance pastel goth', 'couronne d’étoiles sombres'] },
  { id: 'conte', label: 'Conte de fées', emoji: '👑', cost: 100, group: 'style', words: ['style conte de fées lumineux', 'décor scintillant'] },
  // catégories de vêtements (débloquent de nouveaux TYPES de tenue)
  { id: 'chic', label: 'Grandes occasions', emoji: '🤵', cost: 120, group: 'type', words: ['une robe de soirée élégante', 'un smoking chic', 'un kimono de fête', 'une tenue de gala'] },
  { id: 'animaux', label: 'Costumes animaux', emoji: '🐾', cost: 120, group: 'type', words: ['un costume de chat mignon', 'un costume de lapin', 'un costume de renard', 'un onesie panda tout doux'] },
  { id: 'sport', label: 'Sport & aventure', emoji: '⚽', cost: 100, group: 'type', words: ['un survêtement de sport', 'une tenue d’exploratrice', 'un maillot d’équipe', 'une combinaison d’aventure'] },
  // motifs premium
  { id: 'motifs_magiques', label: 'Motifs magiques', emoji: '✨', cost: 100, group: 'motif', words: ['avec un motif galaxie', 'avec un arc-en-ciel', 'avec des licornes', 'avec des flammes douces'] },
]

export function isPremium(): boolean {
  try {
    return localStorage.getItem(KEY_PREMIUM) === '1'
  } catch {
    return false
  }
}

/** Active le Passe Créatrice avec un code (saisi par un parent). */
export function redeemCode(code: string): boolean {
  const norm = code.trim().toUpperCase().replace(/\s+/g, '-')
  if (!PREMIUM_CODES.includes(norm)) return false
  try {
    localStorage.setItem(KEY_PREMIUM, '1')
  } catch {
    /* ignore */
  }
  return true
}

export function setPremium(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY_PREMIUM, '1')
    else localStorage.removeItem(KEY_PREMIUM)
  } catch {
    /* ignore */
  }
}

function readArr(key: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as string[]
  } catch {
    return []
  }
}

export function ownedPacks(): string[] {
  return isPremium() ? KEYWORD_PACKS.map((p) => p.id) : readArr(KEY_PACKS)
}

export function hasPack(id: string): boolean {
  return isPremium() || readArr(KEY_PACKS).includes(id)
}

/** Débloque un pack : gratuit si premium, sinon coûte des gemmes. */
export function unlockPack(id: string): { ok: boolean; reason?: 'owned' | 'gems' } {
  if (hasPack(id)) return { ok: true, reason: 'owned' }
  const pack = KEYWORD_PACKS.find((p) => p.id === id)
  if (!pack) return { ok: false }
  if (getProgress().gems < pack.cost) return { ok: false, reason: 'gems' }
  addReward(0, -pack.cost)
  try {
    localStorage.setItem(KEY_PACKS, JSON.stringify([...readArr(KEY_PACKS), id]))
  } catch {
    /* ignore */
  }
  return { ok: true }
}

function slotBundles(): number {
  try {
    return Number(localStorage.getItem(KEY_SLOTBONUS) ?? '0') || 0
  } catch {
    return 0
  }
}

export function persoSlots(): number {
  return isPremium() ? PREMIUM_PERSO_SLOTS : FREE_PERSO_SLOTS + slotBundles() * SLOT_BUNDLE
}

export function decorSlots(): number {
  return isPremium() ? PREMIUM_DECOR_SLOTS : FREE_DECOR_SLOTS + slotBundles() * SLOT_BUNDLE
}

/** Achète un lot de +5 slots (perso ET décor) contre des gemmes. */
export function buySlotBundle(): { ok: boolean; reason?: 'gems' } {
  if (isPremium()) return { ok: true }
  if (getProgress().gems < SLOT_COST) return { ok: false, reason: 'gems' }
  addReward(0, -SLOT_COST)
  try {
    localStorage.setItem(KEY_SLOTBONUS, String(slotBundles() + 1))
  } catch {
    /* ignore */
  }
  return { ok: true }
}
