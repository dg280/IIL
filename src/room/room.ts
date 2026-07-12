import type { Motif } from '../avatar/types'

export interface RoomConfig {
  wall: string
  bed: string
  rug: string | null
  poster: 'etoile' | 'coeur' | 'musique' | null
  /** poster créé à l'Atelier magique (prioritaire sur poster) */
  posterCustom?: { motif: Motif; background: string } | null
  plante: boolean
  guirlande: boolean
  lampe: boolean
  etagere: boolean
  peluche: boolean
}

export const WALL_COLORS = ['#fbeef4', '#eef4fb', '#f0fbee', '#fdf6e3', '#f3eefb', '#fbeeee']
export const BED_COLORS = ['#f28fb4', '#8fb4f2', '#9fd6a8', '#f2c94c', '#b89ff0', '#f0a58c']
export const RUG_COLORS = ['#e35d7c', '#5a77c9', '#67b57f', '#f2b33d', '#8a63d2']

export function defaultRoom(): RoomConfig {
  return {
    wall: WALL_COLORS[0],
    bed: BED_COLORS[0],
    rug: null,
    poster: null,
    posterCustom: null,
    plante: false,
    guirlande: false,
    lampe: false,
    etagere: false,
    peluche: false,
  }
}

export interface ShopItem {
  id: string
  emoji: string
  label: string
  price: number
  apply: (room: RoomConfig, on: boolean) => RoomConfig
  isOn: (room: RoomConfig) => boolean
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'poster_etoile',
    emoji: '⭐',
    label: 'Poster étoile',
    price: 0,
    apply: (r, on) => ({ ...r, posterCustom: null, poster: on ? 'etoile' : null }),
    isOn: (r) => r.poster === 'etoile',
  },
  {
    id: 'poster_coeur',
    emoji: '💖',
    label: 'Poster cœur',
    price: 20,
    apply: (r, on) => ({ ...r, posterCustom: null, poster: on ? 'coeur' : null }),
    isOn: (r) => r.poster === 'coeur',
  },
  {
    id: 'poster_musique',
    emoji: '🎵',
    label: 'Poster musique',
    price: 20,
    apply: (r, on) => ({ ...r, posterCustom: null, poster: on ? 'musique' : null }),
    isOn: (r) => r.poster === 'musique',
  },
  {
    id: 'plante',
    emoji: '🪴',
    label: 'Plante verte',
    price: 15,
    apply: (r, on) => ({ ...r, plante: on }),
    isOn: (r) => r.plante,
  },
  {
    id: 'guirlande',
    emoji: '✨',
    label: 'Guirlande lumineuse',
    price: 30,
    apply: (r, on) => ({ ...r, guirlande: on }),
    isOn: (r) => r.guirlande,
  },
  {
    id: 'lampe',
    emoji: '🛋️',
    label: 'Lampe champignon',
    price: 15,
    apply: (r, on) => ({ ...r, lampe: on }),
    isOn: (r) => r.lampe,
  },
  {
    id: 'etagere',
    emoji: '📚',
    label: 'Étagère à livres',
    price: 25,
    apply: (r, on) => ({ ...r, etagere: on }),
    isOn: (r) => r.etagere,
  },
  {
    id: 'peluche',
    emoji: '🧸',
    label: 'Peluche lapin',
    price: 40,
    apply: (r, on) => ({ ...r, peluche: on }),
    isOn: (r) => r.peluche,
  },
]

const KEY_ROOM = 'celestine.room'
let memoryRoom: RoomConfig | null = null

export function getRoom(): RoomConfig {
  try {
    const raw = localStorage.getItem(KEY_ROOM)
    if (raw) return { ...defaultRoom(), ...JSON.parse(raw) }
  } catch {
    /* repli mémoire */
  }
  return memoryRoom ?? defaultRoom()
}

export function saveRoom(room: RoomConfig) {
  memoryRoom = room
  try {
    localStorage.setItem(KEY_ROOM, JSON.stringify(room))
  } catch {
    /* mémoire seulement */
  }
}
