/**
 * Sauvegarde cloud des créations (M1-3) — « un cache vidé n'est plus une
 * catastrophe ». Quand le Studio familial est actif, les histoires, les
 * personnages et les images générées du profil sont copiés sur le serveur
 * familial (RLS : seul le parent y accède), et restaurables sur tout appareil.
 *
 * Politique v1, volontairement simple et sans perte :
 *  - SAUVEGARDE : upsert de tout le local (dernière écriture gagne, par histoire) ;
 *  - RESTAURATION : n'écrase jamais une histoire locale — n'ajoute que ce qui
 *    manque (id absent). Le roster n'est restauré que s'il est vide localement.
 *  - auto-sauvegarde débouncée après chaque modification locale (30 s).
 */

import { getBackendConfig, supabase } from './client'
import { getRoster, getStories, saveRosterEntry, saveStory } from '../storage'
import type { Roster } from '../storage'
import type { AuthoredStory } from '../builder/types'
import { getAssetBlob, listAssets, saveAsset } from '../atelier/assets'
import type { AIAsset } from '../atelier/assets'

export interface SyncStatus {
  at: number
  stories: number
  assets: number
  errors: string[]
}

const KEY_LAST = 'celestine.sync_last'

export function lastSync(): SyncStatus | null {
  try {
    return JSON.parse(localStorage.getItem(KEY_LAST) ?? 'null') as SyncStatus | null
  } catch {
    return null
  }
}

/** Fusion de restauration PURE (testée) : n'ajoute que les histoires absentes
 *  du local — le travail local récent n'est jamais écrasé. */
export function mergeRestoredStories(
  local: Record<string, AuthoredStory>,
  remote: { story_id: string; data: AuthoredStory }[],
): AuthoredStory[] {
  return remote.filter((r) => !local[r.story_id]).map((r) => r.data)
}

/** Le roster distant ne s'applique que si le local est (quasi) vide :
 *  jamais d'écrasement de personnages existants. */
export function shouldRestoreRoster(local: Roster): boolean {
  return Object.keys(local).filter((k) => k !== 'self').length === 0
}

export async function pushAll(): Promise<SyncStatus> {
  const sb = supabase()
  const profileId = getBackendConfig()?.profileId
  if (!sb || !profileId) throw new Error('Studio familial non configuré.')
  const errors: string[] = []

  // histoires : upsert une par une (payloads bornés)
  const stories = getStories()
  for (const [id, story] of Object.entries(stories)) {
    const { error } = await sb
      .from('synced_stories')
      .upsert({ child_profile_id: profileId, story_id: id, data: story, updated_at: new Date().toISOString() })
    if (error) errors.push(`histoire ${id}: ${error.message}`)
  }

  // roster (avatars/config — les portraits partent dans le bucket)
  const { error: rErr } = await sb
    .from('synced_roster')
    .upsert({ child_profile_id: profileId, data: getRoster(), updated_at: new Date().toISOString() })
  if (rErr) errors.push(`roster: ${rErr.message}`)

  // images générées : blob → bucket privé, méta → table
  let assetCount = 0
  for (const meta of listAssets()) {
    const blob = await getAssetBlob(meta.id)
    if (!blob) continue
    const path = `${profileId}/${meta.id}`
    const { error: upErr } = await sb.storage.from('creations').upload(path, blob, { upsert: true, contentType: meta.mime })
    if (upErr) {
      errors.push(`image ${meta.id}: ${upErr.message}`)
      continue
    }
    const { error: mErr } = await sb.from('synced_assets').upsert({
      child_profile_id: profileId,
      asset_id: meta.id,
      meta,
      updated_at: new Date().toISOString(),
    })
    if (mErr) errors.push(`méta ${meta.id}: ${mErr.message}`)
    else assetCount++
  }

  const status: SyncStatus = { at: Date.now(), stories: Object.keys(stories).length, assets: assetCount, errors }
  try {
    localStorage.setItem(KEY_LAST, JSON.stringify(status))
  } catch {
    /* stockage indisponible */
  }
  return status
}

export async function restoreAll(): Promise<{ stories: number; rosterRestored: boolean; assets: number }> {
  const sb = supabase()
  const profileId = getBackendConfig()?.profileId
  if (!sb || !profileId) throw new Error('Studio familial non configuré.')

  // histoires manquantes uniquement
  const { data: remoteStories, error } = await sb
    .from('synced_stories')
    .select('story_id, data')
    .eq('child_profile_id', profileId)
  if (error) throw new Error(error.message)
  const added = mergeRestoredStories(getStories(), (remoteStories ?? []) as { story_id: string; data: AuthoredStory }[])
  added.forEach(saveStory)

  // roster : seulement si le local est vide
  let rosterRestored = false
  if (shouldRestoreRoster(getRoster())) {
    const { data: remoteRoster } = await sb.from('synced_roster').select('data').eq('child_profile_id', profileId).single()
    if (remoteRoster?.data) {
      for (const [id, entry] of Object.entries(remoteRoster.data as Roster)) saveRosterEntry(id, entry)
      rosterRestored = true
    }
  }

  // images absentes localement — la méta complète est rejouée, id d'origine
  // compris, pour que les histoires qui référencent l'asset le retrouvent
  const { data: remoteAssets } = await sb.from('synced_assets').select('asset_id, meta').eq('child_profile_id', profileId)
  const localIds = new Set(listAssets().map((a) => a.id))
  let assets = 0
  for (const row of remoteAssets ?? []) {
    if (localIds.has(row.asset_id)) continue
    const { data: file } = await sb.storage.from('creations').download(`${profileId}/${row.asset_id}`)
    if (!file) continue
    const meta = row.meta as AIAsset
    await saveAsset({ ...meta, id: row.asset_id }, file)
    assets++
  }

  return { stories: added.length, rosterRestored, assets }
}

// ───────────────────────────── auto-sauvegarde débouncée ─────────────────

let timer: number | undefined

/** À appeler après toute modification locale (histoire, perso, image). */
export function scheduleSync() {
  const profileId = getBackendConfig()?.profileId
  if (!profileId) return
  if (timer) window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    void pushAll().catch(() => {
      /* hors-ligne : la prochaine modification retentera */
    })
  }, 30_000)
}

/** Branche l'auto-sauvegarde sur le signal « création modifiée » émis par le
 *  stockage local (événement, pas d'import croisé). Appelé au démarrage. */
export function initAutoSync() {
  if (typeof window === 'undefined') return
  window.addEventListener('celestine:creation-changed', () => scheduleSync())
}
