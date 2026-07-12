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

export interface StoryBundle {
  v: 1
  story: AuthoredStory
  characters: Record<string, RosterEntry>
}

export function makeBundle(story: AuthoredStory, roster: Roster): StoryBundle {
  const characters: Record<string, RosterEntry> = {}
  for (const id of story.characters) {
    if (roster[id]) characters[id] = roster[id]
  }
  return { v: 1, story, characters }
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
