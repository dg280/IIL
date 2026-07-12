/**
 * Fournisseur GenAI réel — Google AI Studio (une clé : Gemini image + Veo vidéo).
 *
 * ⚠️ La clé est stockée sur l'appareil (Espace parents) : acceptable pour un
 * usage familial. Pour une mise en production publique, ces appels doivent
 * passer par un backend qui garde la clé et applique modération/quotas
 * (doc 05) — l'interface de ce module ne changera pas.
 */

import { checkPrompt } from './generator'

export type AIProvider = 'libertai' | 'google'

export interface AIConfig {
  provider: AIProvider
  apiKey: string
  imageModel: string
  videoModel: string
  /** base URL du fournisseur (LiberTai) — éditable si l'endpoint évolue */
  baseUrl: string
  /** plafonds par jour, fixés par le parent */
  maxImagesPerDay: number
  maxVideosPerDay: number
}

const KEY_CONFIG = 'celestine.ai_config'
const KEY_USAGE = 'celestine.ai_usage'
const API = 'https://generativelanguage.googleapis.com/v1beta'

/** Réglages par défaut selon le fournisseur. */
export const PROVIDER_DEFAULTS: Record<AIProvider, Omit<AIConfig, 'apiKey' | 'provider'>> = {
  libertai: {
    // API Stable Diffusion (sdapi/v1/txt2img) — base et modèle ajustables dans l'Espace parents
    baseUrl: 'https://api.libertai.io',
    imageModel: 'z-image-turbo',
    videoModel: '',
    maxImagesPerDay: 40,
    maxVideosPerDay: 0,
  },
  google: {
    baseUrl: API,
    imageModel: 'gemini-2.5-flash-image',
    videoModel: 'veo-3.1-fast-generate-preview',
    maxImagesPerDay: 20,
    maxVideosPerDay: 3,
  },
}

export const DEFAULT_CONFIG: Omit<AIConfig, 'apiKey' | 'provider'> = PROVIDER_DEFAULTS.libertai

export function getAIConfig(): AIConfig | null {
  try {
    const raw = localStorage.getItem(KEY_CONFIG)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AIConfig>
    if (!parsed.apiKey) return null
    const provider: AIProvider = parsed.provider === 'google' ? 'google' : 'libertai'
    return { ...PROVIDER_DEFAULTS[provider], ...parsed, provider, apiKey: parsed.apiKey }
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

/** fetch avec conversion des échecs réseau en message humain. */
async function netFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init)
  } catch {
    throw new AIError(
      'Connexion au fournisseur impossible. Vérifie ta connexion internet, et note que certains aperçus (comme le lien de démonstration) bloquent les appels externes — utilise l’app installée ou la version en ligne.',
    )
  }
}

function friendly(status: number, body: string): AIError {
  if ((status === 401 || status === 403) && !/paid plans/i.test(body))
    return new AIError('La clé API ne semble pas valide ou n’a pas les droits — vérifie-la dans l’Espace parents.', body)
  if (status === 400 && /API key not valid|API_KEY_INVALID/i.test(body))
    return new AIError('La clé API ne semble pas valide — vérifie-la dans l’Espace parents.', body)
  if (/paid plans|free_tier|limit: 0/i.test(body))
    return new AIError(
      'Ce modèle nécessite un crédit ou palier payant activé chez le fournisseur. La clé est bonne, il manque juste le crédit.',
      body,
    )
  if (status === 402) return new AIError('Crédit insuffisant chez le fournisseur — recharge le compte.', body)
  if (status === 429) return new AIError('Le quota du jour est épuisé — réessaie plus tard.', body)
  if (status === 404 || status === 405)
    return new AIError(
      `L’adresse de l’API ne répond pas à cette requête (erreur ${status}). Dans l’Espace parents, vérifie que « Adresse de l’API » est bien https://api.libertai.io (sans /sdapi ni /v1 à la fin).`,
      body,
    )
  return new AIError(`La magie n’a pas répondu (erreur ${status}).`, body.slice(0, 400))
}

// ------------------------------------------------------------------- image

export async function generateBackground(userPrompt: string, universe: string): Promise<Blob> {
  const config = getAIConfig()
  if (!config) throw new AIError('Aucune clé configurée dans l’Espace parents.')
  const problem = checkPrompt(userPrompt)
  if (problem) throw new AIError(problem)
  if (quotaLeft(config, 'image') <= 0) throw new AIError('Le quota d’images du jour est atteint (Espace parents).')

  const blob = config.provider === 'libertai' ? await libertaiImage(config, userPrompt, universe) : await googleImage(config, userPrompt, universe)
  bumpUsage('image')
  return blob
}

function blobFromB64(b64: string): Blob {
  const raw = b64.includes(',') ? b64.slice(b64.indexOf(',') + 1) : b64
  const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0))
  return new Blob([bytes], { type: 'image/png' })
}

/**
 * LiberTai : essaie plusieurs endpoints (la console propose « sdapi » ET « OpenAI
 * Compatible ») pour absorber les différences de route/méthode. On tente sdapi
 * d'abord, puis OpenAI-compat, avant d'abandonner.
 */
async function libertaiImage(config: AIConfig, userPrompt: string, universe: string): Promise<Blob> {
  const base = config.baseUrl.replace(/\/$/, '')
  const prompt = bgPrompt(userPrompt, universe)
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` }
  const attempts: { url: string; body: unknown; kind: 'sdapi' | 'openai' }[] = [
    {
      // mode « OpenAI Compatible » (format documenté par LiberTai)
      url: `${base}/v1/images/generations`,
      kind: 'openai',
      body: { model: config.imageModel, prompt, size: '1024x576', n: 1, remove_background: false },
    },
    {
      // repli : API Stable Diffusion
      url: `${base}/sdapi/v1/txt2img`,
      kind: 'sdapi',
      body: {
        model: config.imageModel,
        prompt,
        negative_prompt: 'personnage, humain, visage, texte, logo, filigrane, flou',
        width: 1024,
        height: 576,
        steps: 9,
        seed: -1,
        remove_background: false,
      },
    },
  ]

  let lastErr: AIError | null = null
  for (const a of attempts) {
    let res: Response
    try {
      res = await netFetch(a.url, { method: 'POST', headers, body: JSON.stringify(a.body) })
    } catch (e) {
      lastErr = e instanceof AIError ? e : new AIError('Connexion impossible.')
      continue
    }
    if (!res.ok) {
      lastErr = friendly(res.status, `${a.url} → ${await res.text()}`)
      // mauvais endpoint (404/405) ou requête refusée (400/422) → on tente le suivant
      if ([400, 404, 405, 422].includes(res.status)) continue
      throw lastErr
    }
    const json = (await res.json()) as {
      images?: string[]
      data?: { b64_json?: string; url?: string }[]
      image?: string
    }
    const b64 = json.images?.[0] ?? json.data?.[0]?.b64_json ?? json.image
    if (b64) return blobFromB64(b64)
    const remote = json.data?.[0]?.url ?? json.url
    if (remote) {
      try {
        const img = await fetch(remote)
        if (img.ok) return await img.blob()
      } catch {
        /* CORS ou réseau : message dédié ci-dessous */
      }
      throw new AIError('Décor généré mais impossible à récupérer depuis LiberTai (image hébergée ailleurs).', remote)
    }
    lastErr = new AIError('LiberTai a répondu sans image — vérifie le modèle dans l’Espace parents.', JSON.stringify(json).slice(0, 300))
  }
  throw lastErr ?? new AIError('Génération LiberTai impossible.')
}

async function googleImage(config: AIConfig, userPrompt: string, universe: string): Promise<Blob> {
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
    const res = await netFetch(url, {
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
  if (config.provider !== 'google' || !config.videoModel)
    throw new AIError('Les clips vidéo ne sont pour l’instant disponibles qu’avec le fournisseur Google (Veo). LiberTai fait les décors images.')
  const problem = checkPrompt(userPrompt)
  if (problem) throw new AIError(problem)
  if (quotaLeft(config, 'video') <= 0) throw new AIError('Le quota de clips du jour est atteint (Espace parents).')

  const key = encodeURIComponent(config.apiKey)
  const start = await netFetch(`${API}/models/${config.videoModel}:predictLongRunning?key=${key}`, {
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
    const poll = await netFetch(`${API}/${op.name}?key=${key}`)
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
    const dl = await netFetch(`${uri}${sep}key=${key}`)
    if (!dl.ok) throw friendly(dl.status, await dl.text())
    bumpUsage('video')
    return await dl.blob()
  }
}

/** Test de connexion depuis l'Espace parents (dépend du fournisseur). */
export async function testAIKey(
  provider: AIProvider,
  apiKey: string,
  baseUrl: string,
  imageModel?: string,
  videoModel?: string,
): Promise<string> {
  if (provider === 'libertai') {
    // sdapi (AUTOMATIC1111) : liste des modèles, GET, gratuit
    const url = `${baseUrl.replace(/\/$/, '')}/sdapi/v1/sd-models`
    const res = await netFetch(url, { headers: { Authorization: `Bearer ${apiKey}` } })
    if (!res.ok) throw friendly(res.status, await res.text())
    const json = (await res.json()) as ({ title?: string; model_name?: string; name?: string; id?: string }[]) | { data?: unknown }
    const list = Array.isArray(json) ? json : []
    const names = list.map((m) => m.model_name ?? m.name ?? m.id ?? m.title ?? '').filter(Boolean)
    if (imageModel && names.length && !names.some((n) => n.includes(imageModel))) {
      return `Clé valide, mais « ${imageModel} » n’apparaît pas. Modèles : ${names.slice(0, 8).join(', ')}`
    }
    return `Clé LiberTai valide ✓${names.length ? ` (${names.length} modèles)` : ''}`
  }
  // Google
  const res = await netFetch(`${API}/models?key=${encodeURIComponent(apiKey)}&pageSize=1000`)
  if (!res.ok) throw friendly(res.status, await res.text())
  const json = (await res.json()) as { models?: { name: string }[] }
  const names = (json.models ?? []).map((m) => m.name.replace('models/', ''))
  const missing = [imageModel, videoModel].filter((m): m is string => Boolean(m && !names.includes(m)))
  if (missing.length) {
    const suggestion =
      names.filter((n) => n.includes('image') || n.includes('veo')).slice(0, 6).join(', ') || 'aucun modèle image/vidéo visible'
    return `Clé valide, mais modèle(s) introuvable(s) : ${missing.join(', ')}. Disponibles : ${suggestion}`
  }
  return 'Clé valide, modèles disponibles ✓ (rappel : la génération Google demande la facturation activée)'
}
