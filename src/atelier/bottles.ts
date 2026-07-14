import type { AvatarConfig } from '../avatar/types'
import type { GenParams } from './assets'

/**
 * Bouteilles à la mer : quand une création (décor ou personnage) n'est plus
 * utilisée depuis longtemps, on ne garde que son PROMPT (léger) dans une
 * bouteille stylisée — le lourd blob image est libéré. On peut la régénérer
 * à tout moment depuis sa bouteille.
 */
export interface Bottle {
  id: string
  subkind: 'perso' | 'decor'
  label: string
  prompt: string
  universe: string
  /** perso : pour recréer le personnage à l'identique */
  name?: string
  config?: AvatarConfig
  gender?: 'fille' | 'garcon'
  /** paramètres de génération (seed + sélections) → ressortir le MÊME perso */
  gen?: GenParams
  at: number
}

const KEY = 'celestine.bottles'
let seq = 0

export function getBottles(): Bottle[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Bottle[]
  } catch {
    return []
  }
}

function write(list: Bottle[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 200)))
  } catch {
    /* ignore */
  }
}

export function addBottle(b: Omit<Bottle, 'id' | 'at'>): Bottle {
  const full: Bottle = { ...b, id: `bot-${Date.now().toString(36)}-${seq++}`, at: Date.now() }
  write([full, ...getBottles()])
  return full
}

export function removeBottle(id: string) {
  write(getBottles().filter((b) => b.id !== id))
}
