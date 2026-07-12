import type { AvatarConfig } from './avatar/types'
import { HAIR_COLORS, OUTFIT_COLORS, SKIN_TONES, defaultAvatar } from './avatar/types'

export interface RosterEntry {
  name: string
  config: AvatarConfig
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

export function defaultRoster(): Roster {
  return {
    yuki: {
      name: 'Yuki',
      config: {
        skin: SKIN_TONES[0],
        hairStyle: 'carre',
        hairColor: HAIR_COLORS[4],
        outfit: 'uniforme',
        outfitColor: OUTFIT_COLORS[0],
        outfitColor2: '#f5f1f7',
        accessory: 'etoile',
      },
    },
    hana: {
      name: 'Hana',
      config: {
        skin: SKIN_TONES[1],
        hairStyle: 'couettes',
        hairColor: HAIR_COLORS[3],
        outfit: 'pop',
        outfitColor: OUTFIT_COLORS[1],
        outfitColor2: '#f5f1f7',
        accessory: 'noeud',
      },
    },
  }
}

export function getRoster(): Roster {
  return { ...defaultRoster(), ...read<Roster>(KEY_ROSTER, {}) }
}

export function saveRosterEntry(id: string, entry: RosterEntry) {
  const stored = read<Roster>(KEY_ROSTER, {})
  stored[id] = entry
  write(KEY_ROSTER, stored)
}

export function getSelf(): RosterEntry | null {
  const roster = getRoster()
  return roster.self ?? null
}

export function createSelf(name: string, config?: AvatarConfig) {
  setPlayerName(name)
  saveRosterEntry('self', { name, config: config ?? defaultAvatar() })
}

export function getEndingsFound(storyId: string): string[] {
  const all = read<Record<string, string[]>>(KEY_ENDINGS, {})
  return all[storyId] ?? []
}

export function recordEnding(storyId: string, endingId: string) {
  const all = read<Record<string, string[]>>(KEY_ENDINGS, {})
  const list = all[storyId] ?? []
  if (!list.includes(endingId)) {
    all[storyId] = [...list, endingId]
    write(KEY_ENDINGS, all)
  }
}
