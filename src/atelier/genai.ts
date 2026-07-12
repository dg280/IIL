/**
 * Fournisseur GenAI réel — Google AI Studio (une clé : Gemini image + Veo vidéo).
 *
 * ⚠️ La clé est stockée sur l'appareil (Espace parents) : acceptable pour un
 * usage familial. Pour une mise en production publique, ces appels doivent
 * passer par un backend qui garde la clé et applique modération/quotas
 * (doc 05) — l'interface de ce module ne changera pas.
 */

import { checkPrompt } from './generator'

export interface AIConfig {
  apiKey: string
  imageModel: string
  videoModel: string
  /** plafonds par jour, fixés par le parent */
  maxImagesPerDay: number
  maxVideosPerDay: number
}

const KEY_CONFIG = 'celestine.ai_config'
const KEY_USAGE = 'celestine.ai_usage'
const API = 'https://generativelanguage.googleapis.com/v1beta'

export const DEFAULT_CONFIG: Omit<AIConfig, 'apiKey'> = {
  imageModel: 'gemini-2.5-flash-image',
  videoModel: 'veo-3.1-fast-generate-preview',
  maxImagesPerDay: 20,
  maxVideosPerDay: 3,
}

export function getAIConfig(): AIConfig | null {
  try {
    const raw = localStorage.getItem(KEY_CONFIG)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AIConfig>
    if (!parsed.apiKey) return null
    return { ...DEFAULT_CONFIG, ...parsed, apiKey: parsed.apiKey }
  } catch {
    return null
  }
}

export function setAIConfig(config: AIConfig | null) {
  if (config) localStorage.setItem(KEY_CONFIG, JSON.stringify(config))
  else localStorage.removeItem(KEY_CONFIG)
}

// ------------------------------------------------------------------ quotas

interface Usage {
  date: string
  images: number
  videos: number
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function getUsage(): Usage {
  try {
    const u = JSON.parse(localStorage.getItem(KEY_USAGE) ?? '{}') as Usage
    if (u.date === today()) return u
  } catch {
    /* défaut */
  }
  return { date: today(), images: 0, videos: 0 }
}

function bumpUsage(kind: 'image' | 'video') {
  const u = getUsage()
  if (kind === 'image') u.images++
  else u.videos++
  localStorage.setItem(KEY_USAGE, JSON.stringify(u))
}

export function quotaLeft(config: AIConfig, kind: 'image' | 'video'): number {
  const u = getUsage()
  return kind === 'image' ? Math.max(0, config.maxImagesPerDay - u.images) : Math.max(0, config.maxVideosPerDay - u.videos)
}

// -------------------------------------------------------------- style guide

const UNIVERSE_STYLE: Record<string, string> = {
  sakura:
    "lycée japonais au printemps, cerisiers en fleurs, lumière douce d'après-midi, tons rose pâle et bleu ciel",
  scene:
    'salle de concert moderne, projecteurs colorés, ambiance scintillante fuchsia et bleu électrique, atmosphère de coulisses',
  royaumes:
    'château de conte de fées européen, dorures, lustres, lumière chaude de chandelles, tons bordeaux et or',
}

function bgPrompt(userPrompt: string, universe: string): string {
  return (
    `Illustration de décor pour un visual novel (otome game), style anime shoujo peint, doux et détaillé. ` +
    `Univers : ${UNIVERSE_STYLE[universe] ?? UNIVERSE_STYLE.sakura}. ` +
    `Scène demandée : ${userPrompt}. ` +
    `IMPORTANT : aucun personnage, aucun humain, aucun texte, aucun logo. Cadrage large 16:9, ` +
    `adapté à un public de 10-14 ans, atmosphère poétique.`
  )
}

function videoPrompt(userPrompt: string, universe: string): string {
  return (
    `Plan d'ambiance cinématique pour un visual novel, style anime peint. ` +
    `Univers : ${UNIVERSE_STYLE[universe] ?? UNIVERSE_STYLE.sakura}. ${userPrompt}. ` +
    `Mouvement de caméra lent et doux, aucun personnage, aucun texte, adapté aux enfants.`
  )
}

// ------------------------------------------------------------------ erreurs

export class AIError extends Error {
  constructor(
    message: string,
    public detail?: string,
  ) {
    super(message)
  }
}

function friendly(status: number, body: string): AIError {
  if (status === 400 && /API key not valid|API_KEY_INVALID/i.test(body))
    return new AIError('La clé API ne semble pas valide — vérifie-la dans l’Espace parents.', body)
  if (/paid plans|free_tier|limit: 0/i.test(body))
    return new AIError(
      'Les modèles image/vidéo de Google nécessitent la facturation activée sur le projet (aistudio.google.com → Settings → Plan). La clé est bonne, il manque juste le palier payant.',
      body,
    )
  if (status === 429) return new AIError('Le quota Google du jour est épuisé — réessaie demain ou change de palier.', body)
  if (status === 404) return new AIError('Ce modèle est introuvable — vérifie son nom dans l’Espace parents.', body)
  return new AIError(`La magie n’a pas répondu (erreur ${status}).`, body.slice(0, 400))
}

// ------------------------------------------------------------------- image

export async function generateBackground(userPrompt: string, universe: string): Promise<Blob> {
  const config = getAIConfig()
  if (!config) throw new AIError('Aucune clé configurée dans l’Espace parents.')
  const problem = checkPrompt(userPrompt)
  if (problem) throw new AIError(problem)
  if (quotaLeft(config, 'image') <= 0) throw new AIError('Le quota d’images du jour est atteint (Espace parents).')

  const url = `${API}/models/${config.imageModel}:generateContent?key=${encodeURIComponent(config.apiKey)}`
  const bodies = [
    {
      contents: [{ parts: [{ text: bgPrompt(userPrompt, universe) }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9' } },
    },
    // repli : certains modèles refusent imageConfig ou exigent TEXT+IMAGE
    {
      contents: [{ parts: [{ text: bgPrompt(userPrompt, universe) }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    },
    { contents: [{ parts: [{ text: bgPrompt(userPrompt, universe) }] }] },
  ]

  let lastErr: AIError | null = null
  for (const body of bodies) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      lastErr = friendly(res.status, await res.text())
      if (res.status === 400) continue // essayer le corps suivant
      throw lastErr
    }
    const json = await res.json()
    const parts: { inlineData?: { mimeType: string; data: string } }[] =
      json?.candidates?.[0]?.content?.parts ?? []
    const img = parts.find((p) => p.inlineData?.data)
    if (!img?.inlineData) {
      lastErr = new AIError('Le modèle n’a pas renvoyé d’image (peut-être un refus de sécurité) — reformule ta description.')
      continue
    }
    bumpUsage('image')
    const bytes = Uint8Array.from(atob(img.inlineData.data), (c) => c.charCodeAt(0))
    return new Blob([bytes], { type: img.inlineData.mimeType || 'image/png' })
  }
  throw lastErr ?? new AIError('Génération impossible.')
}

// ------------------------------------------------------------------- vidéo

export async function generateVideoClip(
  userPrompt: string,
  universe: string,
  onProgress: (msg: string) => void,
): Promise<Blob> {
  const config = getAIConfig()
  if (!config) throw new AIError('Aucune clé configurée dans l’Espace parents.')
  const problem = checkPrompt(userPrompt)
  if (problem) throw new AIError(problem)
  if (quotaLeft(config, 'video') <= 0) throw new AIError('Le quota de clips du jour est atteint (Espace parents).')

  const key = encodeURIComponent(config.apiKey)
  const start = await fetch(`${API}/models/${config.videoModel}:predictLongRunning?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt: videoPrompt(userPrompt, universe) }],
      parameters: { aspectRatio: '16:9' },
    }),
  })
  if (!start.ok) throw friendly(start.status, await start.text())
  const op = (await start.json()) as { name?: string }
  if (!op.name) throw new AIError('Lancement vidéo inattendu (pas d’opération).')

  onProgress('Veo tourne la scène… (1 à 3 minutes)')
  const deadline = Date.now() + 6 * 60_000
  for (;;) {
    if (Date.now() > deadline) throw new AIError('La vidéo met trop de temps — réessaie plus tard.')
    await new Promise((r) => setTimeout(r, 8000))
    const poll = await fetch(`${API}/${op.name}?key=${key}`)
    if (!poll.ok) throw friendly(poll.status, await poll.text())
    const status = (await poll.json()) as {
      done?: boolean
      error?: { message?: string }
      response?: {
        generateVideoResponse?: { generatedSamples?: { video?: { uri?: string } }[] }
        generatedVideos?: { video?: { uri?: string } }[]
      }
    }
    if (status.error) throw new AIError('Veo a refusé cette scène — reformule ta description.', status.error.message)
    if (!status.done) {
      onProgress('Encore un instant, Veo peaufine les images…')
      continue
    }
    const uri =
      status.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ??
      status.response?.generatedVideos?.[0]?.video?.uri
    if (!uri) throw new AIError('Vidéo terminée mais introuvable dans la réponse.', JSON.stringify(status.response).slice(0, 300))
    onProgress('Téléchargement du clip…')
    const sep = uri.includes('?') ? '&' : '?'
    const dl = await fetch(`${uri}${sep}key=${key}`)
    if (!dl.ok) throw friendly(dl.status, await dl.text())
    bumpUsage('video')
    return await dl.blob()
  }
}

/** Test de connexion depuis l'Espace parents : clé + présence des modèles configurés. */
export async function testAIKey(apiKey: string, imageModel?: string, videoModel?: string): Promise<string> {
  const res = await fetch(`${API}/models?key=${encodeURIComponent(apiKey)}&pageSize=1000`)
  if (!res.ok) throw friendly(res.status, await res.text())
  const json = (await res.json()) as { models?: { name: string }[] }
  const names = (json.models ?? []).map((m) => m.name.replace('models/', ''))
  const missing = [imageModel, videoModel].filter((m): m is string => Boolean(m && !names.includes(m)))
  if (missing.length) {
    const suggestion =
      names.filter((n) => n.includes('image') || n.includes('veo')).slice(0, 6).join(', ') || 'aucun modèle image/vidéo visible'
    return `Clé valide, mais modèle(s) introuvable(s) : ${missing.join(', ')}. Disponibles : ${suggestion}`
  }
  return 'Clé valide, modèles disponibles ✓ (rappel : la génération image/vidéo demande la facturation activée chez Google)'
}
