export type UniverseId = 'sakura' | 'scene' | 'royaumes'

export interface UniverseInfo {
  id: UniverseId
  emoji: string
  name: string
  tagline: string
  color: string
}

export const UNIVERSES: UniverseInfo[] = [
  {
    id: 'sakura',
    emoji: '🌸',
    name: 'Académie Sakura',
    tagline: 'Amitiés, clubs et festival sous les cerisiers',
    color: '#f6a8c8',
  },
  {
    id: 'scene',
    emoji: '🎤',
    name: 'Lumière de Scène',
    tagline: 'Monte sur scène avec ton groupe',
    color: '#8a63d2',
  },
  {
    id: 'royaumes',
    emoji: '👑',
    name: 'Bal des Royaumes',
    tagline: 'Bals masqués et intrigues de cour',
    color: '#c98a3d',
  },
]
