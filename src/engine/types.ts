import type { AvatarConfig, Expression } from '../avatar/types'

export type VarValue = number | boolean | string

export interface Condition {
  var: string
  eq?: VarValue
  gte?: number
  lte?: number
  gt?: number
  lt?: number
}

export type Effect = { set: string; to: VarValue } | { add: string; n: number }

export interface Choice {
  text: string
  jump: string
  effects?: Effect[]
  cond?: Condition
  /** conditions multiples (toutes requises), ex. souvenir + affinité */
  condAll?: Condition[]
  /** Badge d'impact affiché dans le builder (doc 04) et discrètement dans le player */
  impact?: string
}

export type SpritePos = 'farleft' | 'left' | 'center' | 'right' | 'farright'

export type Op =
  | { op: 'scene'; bg: string }
  | { op: 'show'; who: string; expr?: Expression; at?: SpritePos; scale?: number; x?: number; y?: number }
  | { op: 'hide'; who: string }
  | { op: 'say'; who?: string; text: string }
  | { op: 'menu'; choices: Choice[] }
  | { op: 'if'; cond: Condition; then: string; else: string }
  | { op: 'jump'; label: string }
  | { op: 'end'; ending: Ending }

export interface Ending {
  id: string
  title: string
  emoji: string
}

export interface StoryCharacter {
  name: string
  isPlayer?: boolean
  color?: string
  defaultAvatar?: AvatarConfig
}

export interface Story {
  meta: {
    id: string
    title: string
    universe: string
    description: string
  }
  characters: Record<string, StoryCharacter>
  variables: Record<string, VarValue>
  labels: Record<string, Op[]>
  endings: Ending[]
}
