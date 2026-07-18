import type { AvatarConfig } from './avatar/types'
import { defaultAvatar, normalizeAvatar } from './avatar/types'
import type { AuthoredStory } from './builder/types'

export interface RosterEntry {
  name: string
  config: AvatarConfig
  /** id d'asset IA (portrait) — si présent, sert de sprite dans le player */
  portraitAsset?: string
}

export type Roster = Record<string, RosterEntry>

const KEY_NAME = 'celestine.playerName'
const KEY_ROSTER = 'celestine.roster'
const KEY_ENDINGS = 'celestine.endings'

// localStorage est indisponible dans certains contextes (iframe sandbox,
// navigation privée) : on retombe alors sur une mémoire de session.
const memory = new Map<string, string>()
const ls: Storage | null = (() => {
  try {
    const t = '__celestine_test__'
    window.localStorage.setItem(t, '1')
    window.localStorage.removeItem(t)
    return window.localStorage
  } catch {
    return null
  }
})()

function rawGet(key: string): string | null {
  try {
    return ls ? ls.getItem(key) : memory.get(key) ?? null
  } catch {
    return memory.get(key) ?? null
  }
}

function rawSet(key: string, value: string) {
  memory.set(key, value)
  try {
    ls?.setItem(key, value)
  } catch {
    // la copie mémoire suffit pour la session
  }
}

function rawRemove(key: string) {
  memory.delete(key)
  try {
    ls?.removeItem(key)
  } catch {
    /* mémoire seulement */
  }
}

/**
 * Réinitialise l'onboarding pour re-tester la FTUE : on efface juste le prénom
 * (ce qui fait repasser l'app par l'écran de bienvenue) tout en gardant les
 * histoires et personnages créés. La cérémonie se relancera si la magie est active.
 */
export function resetOnboarding() {
  rawRemove(KEY_NAME)
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = rawGet(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  rawSet(key, JSON.stringify(value))
}

export function getPlayerName(): string | null {
  return rawGet(KEY_NAME)
}

export function setPlayerName(name: string) {
  rawSet(KEY_NAME, name)
}

// Univers préféré choisi au premier lancement (FTUE) : donne le ton graphique
// et narratif par défaut des nouvelles histoires.
const KEY_UNIVERSE = 'celestine.universe'

export function getPreferredUniverse(): string {
  return rawGet(KEY_UNIVERSE) ?? 'sakura'
}

export function setPreferredUniverse(id: string) {
  rawSet(KEY_UNIVERSE, id)
}

/**
 * La galerie démarre VIDE : la créatrice invente ses personnages avec Plume
 * (les 3 premiers depuis des propositions de Plume, les suivants librement).
 * Seul l'avatar « self » existe après l'onboarding.
 */
export function defaultRoster(): Roster {
  return {}
}

export function getRoster(): Roster {
  const merged = { ...defaultRoster(), ...read<Roster>(KEY_ROSTER, {}) }
  for (const entry of Object.values(merged)) {
    entry.config = normalizeAvatar(entry.config)
  }
  return merged
}

export function saveRosterEntry(id: string, entry: RosterEntry) {
  const stored = read<Roster>(KEY_ROSTER, {})
  stored[id] = entry
  write(KEY_ROSTER, stored)
}

export function removeRosterEntry(id: string) {
  if (id === 'self') return // on ne supprime jamais l'avatar de la joueuse
  const stored = read<Roster>(KEY_ROSTER, {})
  delete stored[id]
  write(KEY_ROSTER, stored)
}

export function getSelf(): RosterEntry | null {
  const roster = getRoster()
  return roster.self ?? null
}

export function createSelf(name: string, config?: AvatarConfig, portrait?: string) {
  setPlayerName(name)
  // le portrait fraîchement pris à l'onboarding prime ; sinon on ne perd pas un
  // éventuel portrait IA déjà généré (ex : rejeu de la FTUE, où les créations
  // existantes sont censées être conservées)
  const existing = getSelf()
  saveRosterEntry('self', { name, config: config ?? defaultAvatar(), portraitAsset: portrait ?? existing?.portraitAsset })
}

// ------------------------------------------------------------ histoires créées

const KEY_STORIES = 'celestine.stories'

export function getStories(): Record<string, AuthoredStory> {
  return read<Record<string, AuthoredStory>>(KEY_STORIES, {})
}

export function saveStory(story: AuthoredStory) {
  const all = getStories()
  all[story.id] = story
  write(KEY_STORIES, all)
}

export function deleteStory(id: string) {
  const all = getStories()
  delete all[id]
  write(KEY_STORIES, all)
}

export function newStoryId(): string {
  const all = getStories()
  let n = 1
  while (all[`histoire-${n}`]) n++
  return `histoire-${n}`
}

export function newCharacterId(): string {
  const roster = getRoster()
  let n = 1
  while (roster[`perso${n}`]) n++
  return `perso${n}`
}

export function getEndingsFound(storyId: string): string[] {
  const all = read<Record<string, string[]>>(KEY_ENDINGS, {})
  return all[storyId] ?? []
}

// -------------------------------------------------------- cartes postales

export interface StoredPostcard {
  storyId: string
  endingId: string
  endingTitle: string
  sticker: string
  from: string
}

const KEY_POSTCARDS = 'celestine.postcards'

export function getPostcards(): StoredPostcard[] {
  return read<StoredPostcard[]>(KEY_POSTCARDS, [])
}

/** Ajoute la carte ; renvoie false si le doublon exact existe déjà. */
export function addPostcard(card: StoredPostcard): boolean {
  const all = getPostcards()
  if (all.some((c) => c.storyId === card.storyId && c.endingId === card.endingId && c.from === card.from && c.sticker === card.sticker)) {
    return false
  }
  write(KEY_POSTCARDS, [...all, card])
  return true
}

/** Renvoie true si cette fin vient d'être découverte pour la première fois. */
export function recordEnding(storyId: string, endingId: string): boolean {
  const all = read<Record<string, string[]>>(KEY_ENDINGS, {})
  const list = all[storyId] ?? []
  if (list.includes(endingId)) return false
  all[storyId] = [...list, endingId]
  write(KEY_ENDINGS, all)
  return true
}
