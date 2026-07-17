/**
 * Client du « Studio familial » (backend Supabase UE, M1) — doc 10.
 *
 * Quand il est configuré ET qu'un parent est connecté ET qu'un profil enfant
 * est choisi, la GenAI passe par l'Edge Function genai-proxy : la clé du
 * fournisseur ne vit plus sur l'appareil, la modération et les quotas sont
 * rejoués côté serveur (non contournables). Sans backend configuré, le mode
 * familial historique (clé locale) continue de fonctionner à l'identique.
 */

import { createClient } from '@supabase/supabase-js'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { PortraitOpts } from '../atelier/promptcore'

export interface BackendConfig {
  url: string
  anonKey: string
  /** profil enfant actif sur cet appareil */
  profileId?: string
}

const KEY_BACKEND = 'celestine.backend'

export function getBackendConfig(): BackendConfig | null {
  try {
    const raw = localStorage.getItem(KEY_BACKEND)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<BackendConfig>
    if (!parsed.url || !parsed.anonKey) return null
    return { url: parsed.url, anonKey: parsed.anonKey, profileId: parsed.profileId }
  } catch {
    return null
  }
}

export function setBackendConfig(config: BackendConfig | null) {
  try {
    if (config) localStorage.setItem(KEY_BACKEND, JSON.stringify(config))
    else localStorage.removeItem(KEY_BACKEND)
  } catch {
    /* stockage indisponible */
  }
  client = undefined // le client sera recréé avec la nouvelle config
  sessionCache = null
}

let client: SupabaseClient | null | undefined
let sessionCache: Session | null = null

export function supabase(): SupabaseClient | null {
  if (client !== undefined) return client
  const cfg = getBackendConfig()
  client = cfg ? createClient(cfg.url, cfg.anonKey) : null
  return client
}

/** À appeler au boot : capte la session (y compris le retour de lien magique)
 *  et suit ses changements — permet un `backendActive()` synchrone. */
export async function initBackend(): Promise<void> {
  const sb = supabase()
  if (!sb) return
  const { data } = await sb.auth.getSession()
  sessionCache = data.session
  sb.auth.onAuthStateChange((_event, session) => {
    sessionCache = session
  })
}

/** true si la GenAI doit passer par le serveur (config + parent connecté + profil). */
export function backendActive(): boolean {
  const cfg = getBackendConfig()
  return Boolean(cfg?.profileId && sessionCache)
}

export function parentEmail(): string | null {
  return sessionCache?.user.email ?? null
}

export async function sendMagicLink(email: string): Promise<void> {
  const sb = supabase()
  if (!sb) throw new Error('Backend non configuré.')
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname },
  })
  if (error) throw new Error(error.message)
}

export async function signOutParent(): Promise<void> {
  await supabase()?.auth.signOut()
  sessionCache = null
}

export interface ChildProfile {
  id: string
  pseudo: string
  genai_enabled: boolean
  sharing_enabled: boolean
  genai_daily_quota: number
}

export async function listProfiles(): Promise<ChildProfile[]> {
  const sb = supabase()
  if (!sb) return []
  const { data, error } = await sb.from('child_profiles').select('id, pseudo, genai_enabled, sharing_enabled, genai_daily_quota')
  if (error) throw new Error(error.message)
  return data ?? []
}

/** Crée un profil enfant (pseudo, jamais le prénom) + enregistre le
 *  consentement parental horodaté (RGPD art. 8). */
export async function createProfile(pseudo: string, policyVersion: string): Promise<ChildProfile> {
  const sb = supabase()
  if (!sb) throw new Error('Backend non configuré.')
  const { data: userData } = await sb.auth.getUser()
  if (!userData.user) throw new Error('Session parent requise.')
  const { data, error } = await sb
    .from('child_profiles')
    .insert({ pseudo: pseudo.trim().slice(0, 20), parent_id: userData.user.id })
    .select()
    .single()
  if (error) throw new Error(error.message)
  const { error: cErr } = await sb
    .from('parental_consents')
    .insert({ parent_id: userData.user.id, child_profile_id: data.id, policy_version: policyVersion })
  if (cErr) throw new Error(cErr.message)
  return data as ChildProfile
}

export function setActiveProfile(profileId: string | undefined) {
  const cfg = getBackendConfig()
  if (cfg) setBackendConfig({ ...cfg, profileId })
}

// ─────────────────────────────────────────────── appels GenAI via le proxy

/** Charge STRUCTURÉE envoyée au serveur : jamais de prompt côté client — le
 *  serveur construit le prompt lui-même (promptcore) et rejoue la modération.
 *  Exporté pur pour les tests (aucun champ `prompt` pour un portrait). */
export function buildPortraitPayload(descr: string, universe: string, opts: PortraitOpts, profileId: string) {
  return {
    kind: 'portrait' as const,
    profileId,
    descr: descr.slice(0, 220),
    universe,
    tags: opts.tags ?? [],
    reinforced: opts.reinforced ?? [],
    gender: opts.gender,
    skin: opts.skin,
    age: opts.age,
    height: opts.height,
    ambiance: opts.ambiance,
    seed: opts.seed,
  }
}

async function callProxy(body: unknown): Promise<Blob> {
  const cfg = getBackendConfig()
  const sb = supabase()
  if (!cfg || !sb) throw new Error('Studio familial non configuré.')
  const { data } = await sb.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Session parent expirée — reconnecte-toi dans l’Espace parents.')
  const res = await fetch(`${cfg.url.replace(/\/$/, '')}/functions/v1/genai-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: cfg.anonKey,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as { image?: string; mime?: string; error?: string }
  if (!res.ok || !json.image) {
    throw new Error(json.error ?? `Le studio familial n’a pas répondu (erreur ${res.status}).`)
  }
  const bytes = Uint8Array.from(atob(json.image), (c) => c.charCodeAt(0))
  return new Blob([bytes], { type: json.mime ?? 'image/png' })
}

export async function backendPortrait(descr: string, universe: string, opts: PortraitOpts): Promise<Blob> {
  const cfg = getBackendConfig()
  if (!cfg?.profileId) throw new Error('Choisis un profil dans l’Espace parents.')
  opts.onProgress?.('🪄 Plume peint au studio familial…')
  const blob = await callProxy(buildPortraitPayload(descr, universe, opts, cfg.profileId))
  opts.onProgress?.('🧐 Vérifiée et approuvée par le studio ✓')
  return blob
}

export async function backendDecor(prompt: string, universe: string, ambiance?: string): Promise<Blob> {
  const cfg = getBackendConfig()
  if (!cfg?.profileId) throw new Error('Choisis un profil dans l’Espace parents.')
  return callProxy({ kind: 'decor', profileId: cfg.profileId, prompt: prompt.slice(0, 200), universe, ambiance })
}
