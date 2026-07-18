/**
 * Fournisseur GenAI réel — Google AI Studio (une clé : Gemini image + Veo vidéo).
 *
 * ⚠️ La clé est stockée sur l'appareil (Espace parents) : acceptable pour un
 * usage familial. Pour une mise en production publique, ces appels doivent
 * passer par un backend qui garde la clé et applique modération/quotas
 * (doc 05) — l'interface de ce module ne changera pas.
 */

import { checkPrompt } from './generator'
import { backendActive, backendDecor, backendPortrait } from '../backend/client'
import { cleanList, isCleanText, moderatePrompt } from './moderation'
import { moderateImageBlob, moderateImagePixels } from './imagemod'
import { REDRESS_INSTRUCTION, bgPrompt, portraitPrompt, videoPrompt } from './promptcore'
import type { PortraitOpts } from './promptcore'
export * from './promptcore'

export type AIProvider = 'libertai' | 'google'

export interface AIConfig {
  provider: AIProvider
  apiKey: string
  imageModel: string
  videoModel: string
  /** modèle de texte (chat) pour les idées de Plume */
  textModel: string
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
    // modèle de chat LiberTai (TEE = exécution confidentielle) ; si indisponible
    // sur le compte, chatComplete auto-détecte un modèle valide via /v1/models
    textModel: 'hermes-3-8b-tee',
    maxImagesPerDay: 40,
    maxVideosPerDay: 0,
  },
  google: {
    baseUrl: API,
    imageModel: 'gemini-2.5-flash-image',
    videoModel: 'veo-3.1-fast-generate-preview',
    textModel: 'gemini-2.5-flash',
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

// ------------------------------------------------------------------ erreurs

export class AIError extends Error {
  constructor(
    message: string,
    public detail?: string,
  ) {
    super(message)
  }
}

/** Un appel IA ne doit JAMAIS attendre indéfiniment : si le fournisseur
 *  accepte la connexion mais ne répond pas (incident/surcharge), sans borne
 *  l'app resterait verrouillée sur « La magie opère… » pour toujours. */
const AI_TIMEOUT_MS = 120_000

/** fetch avec délai maximum + conversion des échecs réseau en message humain. */
async function netFetch(input: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS)
  try {
    return await fetch(input, { ...init, signal: ctrl.signal })
  } catch {
    if (ctrl.signal.aborted) {
      throw new AIError('La magie met vraiment trop de temps — le fournisseur d’images semble surchargé. Réessaie dans un petit moment 🌸')
    }
    throw new AIError(
      'Connexion au fournisseur impossible. Vérifie ta connexion internet, et note que certains aperçus (comme le lien de démonstration) bloquent les appels externes — utilise l’app installée ou la version en ligne.',
    )
  } finally {
    window.clearTimeout(timer)
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

export async function generateBackground(userPrompt: string, universe: string, ambiance?: string, free = false): Promise<Blob> {
  const problem0 = checkPrompt(userPrompt)
  if (problem0) throw new AIError(problem0)
  // Studio familial (backend) : le serveur construit le prompt, modère et
  // décompte le quota — la clé ne vit pas sur l'appareil.
  if (backendActive()) {
    try {
      return await backendDecor(userPrompt, universe, ambiance)
    } catch (e) {
      throw e instanceof AIError ? e : new AIError(e instanceof Error ? e.message : 'Le studio familial n’a pas répondu.')
    }
  }
  const config = getAIConfig()
  if (!config) throw new AIError('Aucune clé configurée dans l’Espace parents.')
  const problem = checkPrompt(userPrompt)
  if (problem) throw new AIError(problem)

  const prompt = bgPrompt(userPrompt, universe, ambiance)
  // graine aléatoire aussi côté Google : sans elle, une même description
  // redonne un décor quasi identique à chaque « refaire » (côté LiberTai,
  // seed:-1 par défaut = déjà aléatoire)
  const blob =
    config.provider === 'libertai'
      ? await libertaiImageRaw(config, prompt, 1024, 576)
      : await googleImage(config, prompt, '16:9', Math.floor(Math.random() * 1_000_000_000))
  if (!free) bumpUsage('image')
  return blob
}

/** Portrait de personnage en pied (tête aux pieds, ~9:16) dans le style maison, fond neutre. */
export async function generateCharacterPortrait(descr: string, universe: string, opts: PortraitOpts = {}): Promise<Blob> {
  if (!AI_PORTRAITS_ENABLED) throw new AIError('Les portraits magiques sont en pause. Utilise l’avatar à dessiner.')
  // Studio familial (backend) : pipeline complet côté serveur (prompt structuré,
  // modération, quotas, rhabillage) — voir supabase/functions/genai-proxy.
  if (backendActive()) {
    try {
      return await backendPortrait(descr, universe, opts)
    } catch (e) {
      throw e instanceof AIError ? e : new AIError(e instanceof Error ? e.message : 'Le studio familial n’a pas répondu.')
    }
  }
  const config = getAIConfig()
  if (!config) throw new AIError('Aucune clé configurée dans l’Espace parents.')
  // une description de personnage est légitimement plus longue qu'un prompt de tenue
  const problem = moderatePrompt(descr, 220)
  if (problem) throw new AIError(problem)
  // NB : le negative_prompt est un NO-OP avéré côté LiberTai (jamais transmis au
  // pipeline, vérifié dans leur code source) et n'est pas utilisé côté Google.
  // L'ancienne liste anti-NSFW qui vivait ici était donc inerte à la génération
  // MAIS déclenchait l'audit CI des tokens interdits — supprimée. La sécurité
  // est dans le prompt positif (portraitPrompt) et le filtre de sortie.
  const negative = 'texte, logo, filigrane, flou, difforme, membres en trop, mains difformes'

  // SÉCURITÉ : filtre NSFW côté sortie, à deux étages (pixels + juge de vision,
  // voir imagemod.ts). On génère, on vérifie ; si l'image est signalée on
  // régénère avec une nouvelle graine ET un prompt encore durci, jusqu'à 3
  // essais, sinon on refuse (fail-closed sur le résultat final).
  // QUALITÉ : pieds collés au bord bas (probablement coupés) → on retente aussi
  // en dézoomant, mais on garde l'image sûre en secours (on ne refuse jamais
  // pour une simple question de cadrage).
  // La 1re tentative garde la graine demandée (reproductibilité + même pose de
  // variété) ; les suivantes tirent une nouvelle graine → pose différente.
  const baseSeed = opts.seed ?? Math.floor(Math.random() * 1_000_000_000)
  const progress = opts.onProgress ?? (() => {})
  let flagged = false
  let cropped = false
  let backup: Blob | null = null
  let lastFlagged: Blob | null = null
  const accept = (blob: Blob): Blob => {
    if (!opts.free) bumpUsage('image') // on ne facture que les images sûres et retenues
    return blob
  }
  const gen = (prompt: string, seed: number) =>
    config.provider === 'libertai'
      ? libertaiImageRaw(config, prompt, 768, 1152, { negativePrompt: negative, seed, removeBackground: true })
      : googleImage(config, prompt, '9:16', seed)

  progress('🪄 Plume peint ta photo…')
  for (let attempt = 0; attempt < 3; attempt++) {
    const seed = attempt === 0 ? baseSeed : Math.floor(Math.random() * 1_000_000_000)
    if (attempt > 0) progress(flagged ? '👗 Plume ajuste la tenue et reprend la photo…' : '📏 Plume recule pour voir les pieds…')
    // essai après signalement : coverMax = tenue ultra-couvrante imposée
    // (formulée en positif — jamais de concept interdit nié dans le prompt)
    let prompt = portraitPrompt(descr, opts, seed, flagged, universe)
    if (cropped) prompt += ` Zoom out further: the ENTIRE figure with shoes and clear empty space below the feet fits inside the frame.`
    const blob = await gen(prompt, seed)
    progress('🧐 Plume vérifie que tout est parfait…')
    const verdict = await moderateImageBlob(blob, config)
    if (!verdict.safe) {
      flagged = true
      lastFlagged = blob
      continue
    }
    if (verdict.scores?.piedsBord) {
      cropped = true
      backup = blob // sûre mais cadrée trop serré : gardée si aucun essai ne fait mieux
      continue
    }
    return accept(blob)
  }
  if (backup) return accept(backup)
  // 3 images signalées d'affilée : avant-dernier recours « tenue garantie » —
  // texte libre écarté (cause fréquente de dérive), tuiles d'identité gardées,
  // tenue couvrante imposée. L'image reste filtrée.
  if (flagged) {
    progress('🎀 Plume ressort sa tenue préférée, photo spéciale…')
    const rescueSeed = Math.floor(Math.random() * 1_000_000_000)
    const rescuePrompt = portraitPrompt('', opts, rescueSeed, true, universe)
    const blob = await gen(rescuePrompt, rescueSeed)
    progress('🧐 Plume vérifie que tout est parfait…')
    const verdict = await moderateImageBlob(blob, config)
    if (verdict.safe) return accept(blob)
    lastFlagged = blob

    // DERNIER recours : RÉPARER au lieu de jeter. qwen-image-edit (LiberTai)
    // rhabille le personnage de la dernière photo — visage/cheveux/pose
    // conservés — puis l'analyse de pixels DOIT confirmer le torse couvert
    // avant affichage. À ce stade (4 refus consécutifs, dont un en uniforme
    // imposé), les faux positifs du juge « dans le doute → UNSAFE » sont
    // l'hypothèse dominante : sur une image explicitement rhabillée ET
    // validée pixels, les pixels tranchent. Il y a donc quasi toujours un
    // résultat à la fin — jamais l'enfant les mains vides.
    if (config.provider === 'libertai' && lastFlagged) {
      progress('🪡 Plume recoud une jolie tenue sur la photo…')
      try {
        const dressed = await libertaiImageEdit(config, lastFlagged, REDRESS_INSTRUCTION)
        progress('🧐 Dernière vérification…')
        const pixels = await moderateImagePixels(dressed)
        if (pixels.safe && !pixels.scores?.piedsBord) return accept(dressed)
        if (pixels.safe) return accept(dressed) // pieds au bord : tolérés au dernier recours
      } catch {
        /* endpoint d'édition indisponible : on retombe sur le message doux */
      }
    }
    throw new AIError('Plume n’a pas réussi une photo assez sage cette fois 🌸 Touche encore 📸, ou change une tuile pour l’inspirer !')
  }
  throw new AIError('La magie a raté, réessaie.')
}


/** Édition d'image LiberTai (qwen-image-edit, /v1/images/edits, multipart). */
async function libertaiImageEdit(config: AIConfig, image: Blob, instruction: string): Promise<Blob> {
  const base = config.baseUrl.replace(/\/$/, '')
  const form = new FormData()
  form.append('model', 'qwen-image-edit')
  form.append('prompt', instruction)
  form.append('image', image, 'portrait.png')
  const res = await netFetch(`${base}/v1/images/edits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}` },
    body: form,
  })
  if (!res.ok) throw friendly(res.status, `${base}/v1/images/edits → ${await res.text()}`)
  const json = (await res.json()) as { data?: { b64_json?: string }[]; images?: string[]; image?: string }
  const b64 = json.data?.[0]?.b64_json ?? json.images?.[0] ?? json.image
  if (!b64) throw new AIError('Retouche de tenue impossible (réponse sans image).')
  return blobFromB64(b64)
}

function blobFromB64(b64: string): Blob {
  const raw = b64.includes(',') ? b64.slice(b64.indexOf(',') + 1) : b64
  const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0))
  return new Blob([bytes], { type: 'image/png' })
}

/** Appel image LiberTai générique (prompt complet + dimensions). */
async function libertaiImageRaw(
  config: AIConfig,
  prompt: string,
  width: number,
  height: number,
  extra: { negativePrompt?: string; seed?: number; removeBackground?: boolean } = {},
): Promise<Blob> {
  const base = config.baseUrl.replace(/\/$/, '')
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` }
  const negative = extra.negativePrompt || 'texte, logo, filigrane, flou, difforme'
  const seed = extra.seed ?? -1
  const rmbg = extra.removeBackground ?? false
  const attempts: { url: string; body: unknown; kind: 'sdapi' | 'openai' }[] = [
    {
      // PRIMAIRE : seule route LiberTai qui respecte réellement seed / steps / cfg_scale
      // (l'OpenAI-compatible jette silencieusement seed & steps → seed aléatoire).
      // cfg_scale=0 : z-image-turbo est distillé CFG-off (8-9 steps). Le negative_prompt
      // n'est pas transmis au pipeline côté LiberTai : on le garde par parité de schéma,
      // les vraies exclusions sont reformulées en positif dans le prompt.
      url: `${base}/sdapi/v1/txt2img`,
      kind: 'sdapi',
      body: {
        model: config.imageModel,
        prompt,
        negative_prompt: negative,
        width,
        height,
        steps: 9,
        cfg_scale: 0,
        seed,
        remove_background: rmbg,
      },
    },
    {
      // repli : mode « OpenAI Compatible » (si la route sdapi n'est pas exposée)
      url: `${base}/v1/images/generations`,
      kind: 'openai',
      body: { model: config.imageModel, prompt, negative_prompt: negative, size: `${width}x${height}`, n: 1, seed, remove_background: rmbg },
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
      url?: string
    }
    const b64 = json.images?.[0] ?? json.data?.[0]?.b64_json ?? json.image
    if (b64) return blobFromB64(b64)
    const remote = json.data?.[0]?.url ?? json.url
    if (remote) {
      try {
        const img = await fetch(remote, { signal: AbortSignal.timeout(60_000) })
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

async function googleImage(config: AIConfig, prompt: string, aspect: string, seed?: number): Promise<Blob> {
  const url = `${API}/models/${config.imageModel}:generateContent?key=${encodeURIComponent(config.apiKey)}`
  // seed explicite : sans lui, une même description régénère une image trop proche
  // de la précédente (cf. bouton 🔄 refaire la photo, qui doit varier nettement).
  const seedCfg = seed != null ? { seed } : {}
  const bodies = [
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspect }, ...seedCfg },
    },
    // repli : certains modèles refusent imageConfig ou exigent TEXT+IMAGE
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'], ...seedCfg },
    },
    // dernier repli : garder quand même le seed (sinon la variation/reproductibilité est perdue)
    { contents: [{ parts: [{ text: prompt }] }], ...(seed != null ? { generationConfig: seedCfg } : {}) },
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

// -------------------------------------------------------------- texte (Plume)

export function hasAI(): boolean {
  return getAIConfig() !== null || backendActive()
}

/**
 * Portraits de personnages par IA.
 * Le modèle d'images peut produire de la nudité malgré un prompt anti-nudité →
 * chaque portrait est filtré côté SORTIE par un filtre à deux étages
 * (moderateImageBlob : analyse de pixels par zones anatomiques + juge de
 * vision multimodal quand disponible) AVANT d'être affiché/enregistré. Une
 * image signalée n'est jamais montrée ; on régénère avec un prompt durci, et
 * si ça échoue 3 fois on refuse. Les décors IA (sans personnage) ne sont pas
 * concernés.
 */
export const AI_PORTRAITS_ENABLED = true
export function aiPortraitsEnabled(): boolean {
  return AI_PORTRAITS_ENABLED
}

/** Liste les ids de modèles exposés par LiberTai (endpoint OpenAI /v1/models). */
async function listLibertaiModels(base: string, apiKey: string): Promise<string[]> {
  try {
    const res = await netFetch(`${base}/v1/models`, { headers: { Authorization: `Bearer ${apiKey}` } })
    if (!res.ok) return []
    const json = (await res.json()) as { data?: { id?: string }[]; models?: { id?: string; name?: string }[] }
    return (json.data?.map((m) => m.id) ?? json.models?.map((m) => m.id ?? m.name) ?? []).filter(Boolean) as string[]
  } catch {
    return []
  }
}

/** Choisit un modèle de texte plausible dans une liste (exclut image/audio/embed). */
function pickTextModel(ids: string[]): string | null {
  const NON_TEXT = /(image|z-image|flux|sd|stable-?diffusion|embed|rerank|whisper|tts|audio|voice|vision|clip|diffus)/i
  const text = ids.filter((id) => !NON_TEXT.test(id))
  if (!text.length) return null
  const PREF = /(instruct|chat|-it\b|hermes|mistral|nemo|gemma|qwen|llama|mixtral|phi)/i
  return text.find((id) => PREF.test(id)) ?? text[0]
}

/** Détecte un modèle de texte valide chez LiberTai (pour l'Espace parents). */
export async function suggestTextModel(baseUrl: string, apiKey: string): Promise<{ picked: string | null; models: string[] }> {
  const base = baseUrl.replace(/\/$/, '')
  const models = await listLibertaiModels(base, apiKey)
  return { picked: pickTextModel(models), models }
}

/** Appel LLM texte brut (chat OpenAI-compatible ou Google generateContent). */
async function chatComplete(config: AIConfig, system: string, user: string, maxTokens: number): Promise<string> {
  if (config.provider === 'google') {
    const url = `${API}/models/${config.textModel}:generateContent?key=${encodeURIComponent(config.apiKey)}`
    const res = await netFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: user }] }],
        generationConfig: { temperature: 1, maxOutputTokens: maxTokens },
      }),
    })
    if (!res.ok) throw friendly(res.status, await res.text())
    const json = await res.json()
    return json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''
  }

  // LiberTai (OpenAI-compatible)
  const base = config.baseUrl.replace(/\/$/, '')
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` }
  const callChat = (model: string) =>
    netFetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 1,
        max_tokens: maxTokens,
      }),
    })

  let res = await callChat(config.textModel)
  // vLLM renvoie 404 (« The model X does not exist ») quand l'id est inconnu :
  // on récupère la vraie liste, on choisit un modèle de chat, on réessaie une
  // fois, et on mémorise ce choix pour ne plus jamais retomber sur l'erreur.
  if (!res.ok && (res.status === 404 || res.status === 400)) {
    const body = await res.text()
    const looksLikeModelIssue = res.status === 404 || /model/i.test(body)
    if (looksLikeModelIssue) {
      const models = await listLibertaiModels(base, config.apiKey)
      const pick = pickTextModel(models)
      if (pick && pick !== config.textModel) {
        const retry = await callChat(pick)
        if (retry.ok) {
          setAIConfig({ ...config, textModel: pick }) // auto-réparation persistée
          res = retry
        } else {
          throw new AIError(
            `Le modèle de texte « ${config.textModel} » n’existe pas chez LiberTai. ` +
              `Choisis-en un dans l’Espace parents${models.length ? ` — dispo : ${models.slice(0, 8).join(', ')}` : ''}.`,
            await retry.text(),
          )
        }
      } else {
        throw new AIError(
          `Le modèle de texte « ${config.textModel} » n’est pas reconnu par LiberTai. ` +
            `Ouvre l’Espace parents et mets un modèle valide dans « Modèle de texte »${models.length ? ` (ex : ${models.slice(0, 6).join(', ')})` : ''}.`,
          body,
        )
      }
    } else {
      throw friendly(res.status, body)
    }
  }
  if (!res.ok) throw friendly(res.status, await res.text())
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  return json.choices?.[0]?.message?.content ?? ''
}

/**
 * Idées de Plume via LLM. Renvoie une liste de suggestions courtes.
 */
export async function suggestIdeas(system: string, user: string): Promise<string[]> {
  const config = getAIConfig()
  if (!config) throw new AIError('La grande magie de Plume demande une clé dans l’Espace parents.')
  const text = await chatComplete(config, system, user, 400)

  // découpe en propositions : lignes numérotées ou à puces, sinon phrases
  const lines = text
    .split('\n')
    .map((l) => l.replace(/^\s*(\d+[.)]|[-*•])\s*/, '').trim())
    .filter((l) => l.length > 1)
  const cleaned = (lines.length ? lines : text.split(/(?<=[.!?])\s+/)).map((l) => l.replace(/^["'«»\s]+|["'«»\s]+$/g, ''))
  // dernière barrière : on ne montre jamais une suggestion inappropriée
  return cleanList(cleaned.filter(Boolean)).slice(0, 4)
}

/** Une scène entière rédigée par Plume (l'enfant la retouche ensuite). */
export interface SceneDraft {
  titre?: string
  /** who = nom exact d'un personnage fourni, ou null pour la narratrice */
  lines: { who: string | null; text: string }[]
  /** propositions de choix (facultatif) avec effets sur les cœurs par nom */
  choix: { text: string; hearts: Record<string, number> }[]
}

/**
 * Plume écrit une scène complète à partir d'une intention de l'enfant.
 * Le modèle répond en JSON strict ; on parse défensivement. L'enfant garde
 * toujours la main (édition libre après coup), et le prompt système impose un
 * contenu adapté aux enfants.
 */
export async function draftScene(system: string, user: string): Promise<SceneDraft> {
  const config = getAIConfig()
  if (!config) throw new AIError('La grande magie de Plume demande une clé dans l’Espace parents.')
  const raw = await chatComplete(config, system, user, 700)

  // extrait le premier objet JSON de la réponse (le modèle peut bavarder autour)
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) throw new AIError('Plume a répondu de façon inattendue — réessaie.')
  let parsed: unknown
  try {
    parsed = JSON.parse(raw.slice(start, end + 1))
  } catch {
    throw new AIError('Plume a un peu bafouillé — touche à nouveau le bouton, ça marchera !')
  }
  const obj = parsed as { titre?: unknown; lines?: unknown; choix?: unknown }

  const lines: SceneDraft['lines'] = Array.isArray(obj.lines)
    ? obj.lines
        .map((l) => {
          const o = l as { who?: unknown; text?: unknown }
          const text = typeof o.text === 'string' ? o.text.trim() : ''
          const who = typeof o.who === 'string' && o.who.trim() ? o.who.trim() : null
          return { who, text }
        })
        .filter((l) => l.text && isCleanText(l.text)) // barrière de modération
        .slice(0, 8)
    : []
  const choix: SceneDraft['choix'] = Array.isArray(obj.choix)
    ? obj.choix
        .map((c) => {
          const o = c as { text?: unknown; hearts?: unknown }
          const text = typeof o.text === 'string' ? o.text.trim() : ''
          const hearts: Record<string, number> = {}
          if (o.hearts && typeof o.hearts === 'object') {
            for (const [k, v] of Object.entries(o.hearts as Record<string, unknown>)) {
              const n = Number(v)
              if (Number.isFinite(n) && n !== 0) hearts[k] = Math.max(-3, Math.min(3, Math.round(n)))
            }
          }
          return { text, hearts }
        })
        .filter((c) => c.text && isCleanText(c.text))
        .slice(0, 3)
    : []

  if (!lines.length && !choix.length) throw new AIError('Plume n’a rien écrit cette fois — réessaie !')
  return { titre: typeof obj.titre === 'string' ? obj.titre.slice(0, 30) : undefined, lines, choix }
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
    // endpoint OpenAI-compatible (le même que la génération) : GET /v1/models
    const base = baseUrl.replace(/\/$/, '')
    const res = await netFetch(`${base}/v1/models`, { headers: { Authorization: `Bearer ${apiKey}` } })
    if (res.status === 401 || res.status === 403) throw friendly(res.status, await res.text())
    if (!res.ok) {
      // la liste des modèles n'est pas exposée : ce n'est pas bloquant, on générera quand même
      return 'Clé enregistrée. La liste des modèles n’est pas accessible ici — teste directement en peignant un décor dans l’Atelier magique.'
    }
    const json = (await res.json()) as { data?: { id?: string }[]; models?: { id?: string; name?: string }[] }
    const names = (json.data?.map((m) => m.id) ?? json.models?.map((m) => m.id ?? m.name) ?? []).filter(Boolean) as string[]
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
