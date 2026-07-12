import type { AuthoredStory } from './builder/types'
import type { Roster, RosterEntry } from './storage'
import { getStories, newStoryId, saveRosterEntry, saveStory } from './storage'
import { normalizeAvatar } from './avatar/types'

/**
 * Partage hors-ligne : l'histoire + les avatars de ses personnages sont
 * empaquetés dans un « code d'histoire » (JSON → base64) à envoyer à une
 * copine, ou dans un fichier .celestine.json. Aucun serveur nécessaire.
 */

const PREFIX = 'CEL1.'
const POSTCARD_PREFIX = 'CELR1.'

export interface StoryBundle {
  v: 1
  story: AuthoredStory
  characters: Record<string, RosterEntry>
  /** provenance (audit social) : pseudo de l'autrice + id de bundle */
  authorPseudo?: string
  bundleId?: string
}

/** Détection d'infos personnelles avant partage (doc 07) : téléphone, email, adresse. */
const PII_PATTERNS: [RegExp, string][] = [
  [/(\+33|0)\s*[1-9]([ .-]?\d{2}){4}/, 'un numéro de téléphone'],
  [/[\w.+-]+@[\w-]+\.[a-z]{2,}/i, 'une adresse email'],
  [/\d{1,4}\s+(rue|avenue|boulevard|impasse|allée|chemin)\s/i, 'une adresse'],
]

export function scanPII(story: AuthoredStory): string | null {
  const texts: string[] = [story.title]
  for (const sc of Object.values(story.scenes)) {
    texts.push(sc.titre)
    sc.lines.forEach((l) => texts.push(l.text))
    if (sc.outcome.kind === 'choix') sc.outcome.options.forEach((o) => texts.push(o.text))
    if (sc.outcome.kind === 'fin') texts.push(sc.outcome.title)
  }
  for (const t of texts) {
    for (const [re, label] of PII_PATTERNS) {
      if (re.test(t)) return label
    }
  }
  return null
}

export function makeBundle(story: AuthoredStory, roster: Roster, authorPseudo?: string): StoryBundle {
  const characters: Record<string, RosterEntry> = {}
  for (const id of story.characters) {
    if (roster[id]) characters[id] = roster[id]
  }
  return {
    v: 1,
    story,
    characters,
    authorPseudo: authorPseudo?.slice(0, 20),
    bundleId: `${story.id}-${Date.now().toString(36)}`,
  }
}

// ------------------------------------------------------- cartes postales 💌

export interface Postcard {
  v: 1
  storyId: string
  storyTitle: string
  endingId: string
  endingTitle: string
  sticker: string
  from: string
}

const STICKERS = ['💖', '😂', '😱', '🌟', '👏']

export function isAllowedSticker(s: string): boolean {
  return STICKERS.includes(s)
}

export function encodePostcard(card: Postcard): string {
  const bytes = new TextEncoder().encode(JSON.stringify(card))
  let bin = ''
  for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return POSTCARD_PREFIX + btoa(bin)
}

export function isPostcardCode(raw: string): boolean {
  return raw.trim().startsWith(POSTCARD_PREFIX)
}

export function decodePostcard(code: string): Postcard {
  const b64 = code.trim().slice(POSTCARD_PREFIX.length)
  const bytes = Uint8Array.from(atob(b64.replace(/\s+/g, '')), (c) => c.charCodeAt(0))
  const card = JSON.parse(new TextDecoder().decode(bytes)) as Postcard
  if (card.v !== 1 || typeof card.storyId !== 'string' || !isAllowedSticker(card.sticker)) throw new Error('carte invalide')
  card.from = String(card.from ?? '').slice(0, 20)
  card.storyTitle = String(card.storyTitle ?? '').slice(0, 80)
  card.endingTitle = String(card.endingTitle ?? '').slice(0, 80)
  return card
}

export function encodeBundle(bundle: StoryBundle): string {
  const bytes = new TextEncoder().encode(JSON.stringify(bundle))
  let bin = ''
  for (let i = 0; i < bytes.length; i += 8192) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 8192))
  }
  return PREFIX + btoa(bin)
}

const MAX_CODE_LENGTH = 400_000
const MAX_SCENES = 200
const MAX_TEXT = 600

/** Validation défensive : un code partagé est éditable à la main, on ne fait pas confiance. */
function validateBundle(bundle: StoryBundle) {
  const scenes = Object.values(bundle.story.scenes)
  if (scenes.length === 0 || scenes.length > MAX_SCENES) throw new Error('taille')
  if (typeof bundle.story.title !== 'string' || bundle.story.title.length > 80) throw new Error('titre')
  for (const sc of scenes) {
    if (!Array.isArray(sc.lines) || sc.lines.length > 60) throw new Error('scène')
    for (const l of sc.lines) {
      if (typeof l.text !== 'string' || l.text.length > MAX_TEXT) throw new Error('texte')
      if (/https?:\/\//i.test(l.text)) throw new Error('lien')
    }
  }
}

export function decodeBundle(code: string): StoryBundle {
  const trimmed = code.trim()
  if (trimmed.length > MAX_CODE_LENGTH) throw new Error('trop long')
  const b64 = trimmed.startsWith(PREFIX) ? trimmed.slice(PREFIX.length) : trimmed
  const bytes = Uint8Array.from(atob(b64.replace(/\s+/g, '')), (c) => c.charCodeAt(0))
  const json = new TextDecoder().decode(bytes)
  const parsed = JSON.parse(json) as StoryBundle
  if (!parsed || parsed.v !== 1 || !parsed.story?.scenes || !parsed.story?.startId) {
    throw new Error('format inconnu')
  }
  validateBundle(parsed)
  return parsed
}

/** Accepte un code CEL1. ou le JSON d'un fichier .celestine.json, avec validation. */
export function parseBundle(raw: string): StoryBundle {
  if (raw.trim().startsWith('{')) {
    const parsed = JSON.parse(raw) as StoryBundle
    if (!parsed || parsed.v !== 1 || !parsed.story?.scenes || !parsed.story?.startId) {
      throw new Error('format inconnu')
    }
    validateBundle(parsed)
    return parsed
  }
  return decodeBundle(raw)
}

/** Importe le bundle : personnages manquants ajoutés au roster, histoire sous un id libre. */
export function importBundle(bundle: StoryBundle, roster: Roster): AuthoredStory {
  for (const [id, entry] of Object.entries(bundle.characters)) {
    if (!roster[id]) {
      saveRosterEntry(id, { name: entry.name, config: normalizeAvatar(entry.config) })
    }
  }
  const story = { ...bundle.story }
  if (getStories()[story.id]) story.id = newStoryId()
  saveStory(story)
  return story
}

export function downloadBundle(bundle: StoryBundle) {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${bundle.story.title.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase() || 'histoire'}.celestine.json`
  a.click()
  URL.revokeObjectURL(url)
}
