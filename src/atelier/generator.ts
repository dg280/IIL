import type { Motif, MotifKind, Outfit } from '../avatar/types'
import { moderatePrompt } from './moderation'

/**
 * Le « moteur magique » v1 : un générateur procédural local qui comprend la
 * description en français (couleurs, motifs, type de vêtement) et compose des
 * variantes cohérentes sur le paper-doll. L'interface DesignProvider permet de
 * brancher plus tard une vraie API d'images (doc 05) sans changer l'UX.
 */

export interface OutfitDesign {
  kind: 'tenue'
  outfit: Outfit
  outfitColor: string
  outfitColor2: string
  motif: Motif | null
}

export interface PosterDesign {
  kind: 'poster'
  motif: Motif
  background: string
}

export type Design = OutfitDesign | PosterDesign

export interface DesignProvider {
  generate(prompt: string, category: 'tenue' | 'poster'): Promise<Design[]>
}

// ------------------------------------------------------------------ parsing

const COLOR_WORDS: [RegExp, string][] = [
  [/bleu(e)? nuit|nuit/i, '#2f3a63'],
  [/turquoise/i, '#59c2c9'],
  [/bleu(e|s)? ciel|ciel/i, '#8ec9f2'],
  [/bleu/i, '#5a77c9'],
  [/rose pâle|rose clair/i, '#f6a8c8'],
  [/rose|fuchsia/i, '#e35d7c'],
  [/rouge|bordeaux/i, '#a83242'],
  [/or|doré(e|s)?|jaune/i, '#f2c94c'],
  [/vert(e)? menthe|menthe/i, '#8fd6b8'],
  [/vert/i, '#67b57f'],
  [/lavande|lilas/i, '#c9b8f5'],
  [/violet(te)?|mauve/i, '#8a63d2'],
  [/noir(e|s)?/i, '#3e3a4a'],
  [/blanc(he|s)?|neige/i, '#f5f1f7'],
  [/argent(é(e|s)?)?|gris(e)?/i, '#e8e6ef'],
  [/corail|orange|pêche/i, '#e98a4e'],
]

const MOTIF_WORDS: [RegExp, MotifKind][] = [
  [/étoile|etoile|stellaire/i, 'etoile'],
  [/c(œ|oe)ur/i, 'coeur'],
  [/fleur|floral/i, 'fleur'],
  [/lune|croissant/i, 'lune'],
  [/éclair|eclair|orage|foudre/i, 'eclair'],
  [/musique|note/i, 'note'],
  [/pois|point/i, 'pois'],
  [/paillette|brillant|scintill|magique/i, 'paillettes'],
]

const BASE_WORDS: [RegExp, Outfit][] = [
  [/robe de bal|princesse|bal\b/i, 'bal'],
  [/robe|jupe/i, 'etoile'],
  [/uniforme marin|marin/i, 'uniforme'],
  [/gakuran|uniforme/i, 'gakuran'],
  [/blazer|collège|college/i, 'blazer'],
  [/veste de scène|rock|concert|scène|scene/i, 'scene_rock'],
  [/prince|royal/i, 'prince'],
  [/aventur|explorat/i, 'aventure'],
  [/sweat|pull|capuche|décontract/i, 'sweat'],
  [/pop|star/i, 'pop'],
]

// filtre de bienveillance mutualisé (voir moderation.ts) — Plume refuse gentiment
export function checkPrompt(prompt: string): string | null {
  return moderatePrompt(prompt, 100)
}

function hash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h
}

function shade(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, Math.max(0, (num >> 16) + amount))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount))
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

const FALLBACK_COLORS = ['#5a77c9', '#e35d7c', '#8a63d2', '#67b57f', '#f2c94c', '#59c2c9']

interface Parsed {
  colors: string[]
  motif: MotifKind | null
  base: Outfit | null
  seed: number
}

export function parsePrompt(prompt: string): Parsed {
  const colors: string[] = []
  for (const [re, hex] of COLOR_WORDS) {
    if (re.test(prompt) && !colors.includes(hex)) colors.push(hex)
    if (colors.length >= 2) break
  }
  let motif: MotifKind | null = null
  for (const [re, m] of MOTIF_WORDS) {
    if (re.test(prompt)) {
      motif = m
      break
    }
  }
  let base: Outfit | null = null
  for (const [re, o] of BASE_WORDS) {
    if (re.test(prompt)) {
      base = o
      break
    }
  }
  return { colors, motif, base, seed: hash(prompt.toLowerCase()) }
}

function motifColorFor(c1: string, motif: MotifKind): string {
  // les motifs clairs sur fond sombre et inversement
  const lum = parseInt(c1.slice(1, 3), 16) + parseInt(c1.slice(3, 5), 16) + parseInt(c1.slice(5, 7), 16)
  if (motif === 'paillettes' || motif === 'etoile' || motif === 'lune') return lum > 420 ? '#f2c94c' : '#ffe28a'
  return lum > 420 ? shade(c1, -70) : '#fff6fa'
}

/** Générateur local : 3 variantes cohérentes. */
export const localProvider: DesignProvider = {
  async generate(prompt, category) {
    const { colors, motif, base, seed } = parsePrompt(prompt)
    const c1 = colors[0] ?? FALLBACK_COLORS[seed % FALLBACK_COLORS.length]
    const c2 = colors[1] ?? shade(c1, 70)
    const m: MotifKind = motif ?? 'paillettes'

    // petite pause théâtrale : la magie prend un instant
    await new Promise((r) => setTimeout(r, 900))

    if (category === 'poster') {
      const designs: PosterDesign[] = [
        { kind: 'poster', motif: { kind: m, color: c1, density: 2 }, background: '#fff' },
        { kind: 'poster', motif: { kind: m, color: '#fff', density: 2 }, background: c1 },
        { kind: 'poster', motif: { kind: m, color: c2, density: 3 }, background: shade(c1, 90) },
      ]
      return designs
    }

    const b1 = base ?? (['etoile', 'sweat', 'pop'] as Outfit[])[seed % 3]
    const alt: Outfit[] = ['bal', 'etoile', 'pop', 'sweat', 'scene_rock', 'aventure']
    const b3 = alt[(seed + 2) % alt.length] === b1 ? alt[(seed + 3) % alt.length] : alt[(seed + 2) % alt.length]

    const designs: OutfitDesign[] = [
      {
        kind: 'tenue',
        outfit: b1,
        outfitColor: c1,
        outfitColor2: c2,
        motif: { kind: m, color: motifColorFor(c1, m), density: 2 },
      },
      {
        kind: 'tenue',
        outfit: b1,
        outfitColor: c2,
        outfitColor2: c1,
        motif: { kind: m, color: motifColorFor(c2, m), density: 3 },
      },
      {
        kind: 'tenue',
        outfit: b3,
        outfitColor: shade(c1, -25),
        outfitColor2: shade(c2, 25),
        motif: { kind: m, color: motifColorFor(shade(c1, -25), m), density: 1 },
      },
    ]
    return designs
  },
}
