/**
 * Coffre des assets générés par l'IA (décors image/vidéo).
 * IndexedDB (les blobs sont trop lourds pour localStorage) + cache d'URLs
 * objets chargé au démarrage pour un accès synchrone dans les composants.
 */

export interface AIAsset {
  id: string // 'ai:...' — utilisé comme id de décor
  kind: 'image' | 'video'
  mime: string
  label: string
  prompt: string
  universe: string
  /** date de création (ms) — sert au rangement automatique en bouteilles */
  createdAt?: number
}

// dernière utilisation par asset (localStorage léger, sans écrire dans IndexedDB)
const KEY_USED = 'celestine.asset_used'
function usedMap(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY_USED) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}
/** Marque un asset comme utilisé maintenant (appelé quand il s'affiche en jeu). */
export function touchAsset(id: string) {
  try {
    const m = usedMap()
    m[id] = Date.now()
    localStorage.setItem(KEY_USED, JSON.stringify(m))
  } catch {
    /* ignore */
  }
}
function lastUsedOf(a: AIAsset): number {
  return usedMap()[a.id] ?? a.createdAt ?? Date.now()
}
/** Décors IA (hors portraits) non utilisés depuis plus de `days` jours. */
export function staleDecorAssets(days: number): AIAsset[] {
  const cutoff = Date.now() - days * 86_400_000
  return listAssets('image').filter((a) => !a.label.startsWith('Portrait') && lastUsedOf(a) < cutoff)
}

const DB_NAME = 'celestine-assets'
const STORE = 'assets'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

interface StoredAsset extends AIAsset {
  blob: Blob
}

// cache synchrone { id → { meta, url } }
const cache = new Map<string, { meta: AIAsset; url: string }>()
let initialized = false

export async function initAssets(): Promise<void> {
  if (initialized) return
  try {
    const db = await openDB()
    const all = await new Promise<StoredAsset[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
      tx.onsuccess = () => resolve(tx.result as StoredAsset[])
      tx.onerror = () => reject(tx.error)
    })
    for (const a of all) {
      const { blob, ...meta } = a
      cache.set(a.id, { meta, url: URL.createObjectURL(blob) })
    }
  } catch {
    // pas d'IndexedDB (iframe très restrictive) : les décors IA sont simplement absents
  }
  initialized = true
}

export function listAssets(kind?: 'image' | 'video'): AIAsset[] {
  return [...cache.values()].map((c) => c.meta).filter((m) => !kind || m.kind === kind)
}

export function getAssetUrl(id: string): string | null {
  return cache.get(id)?.url ?? null
}

export function getAssetMeta(id: string): AIAsset | null {
  return cache.get(id)?.meta ?? null
}

export async function getAssetBlob(id: string): Promise<Blob | null> {
  try {
    const db = await openDB()
    const rec = await new Promise<StoredAsset | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly').objectStore(STORE).get(id)
      tx.onsuccess = () => resolve(tx.result as StoredAsset | undefined)
      tx.onerror = () => reject(tx.error)
    })
    return rec?.blob ?? null
  } catch {
    return null
  }
}

export async function saveAsset(meta: Omit<AIAsset, 'id'>, blob: Blob): Promise<AIAsset> {
  const id = `ai:${meta.kind}-${Date.now().toString(36)}`
  const full: AIAsset = { createdAt: Date.now(), ...meta, id }
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put({ ...full, blob })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  cache.set(id, { meta: full, url: URL.createObjectURL(blob) })
  return full
}

export async function deleteAsset(id: string): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  const c = cache.get(id)
  if (c) URL.revokeObjectURL(c.url)
  cache.delete(id)
}
