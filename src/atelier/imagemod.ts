/**
 * Modération d'IMAGE côté sortie (sécurité enfant, 10+) — filtre à DEUX étages.
 *
 * Objectif : rester dans l'anime « tout public », jamais dans l'ecchi/hentai.
 * Le negative_prompt étant un no-op côté LiberTai (et cfg_scale=0), le prompt
 * seul ne suffit pas : chaque portrait généré est vérifié AVANT affichage.
 *
 * Étage 1 — analyse de PIXELS (déterministe, instantanée, hors-ligne).
 *   L'ancien filtre mesurait la peau sur une bande à 30-58 % de la hauteur…
 *   qui correspond au ventre/hanches d'un personnage EN PIED : la poitrine
 *   (≈ 15-30 % de la hauteur) n'était jamais regardée → les torses nus
 *   passaient. On mesure désormais TROIS zones anatomiques (poitrine, ventre,
 *   bassin) + le torse entier + la « coulée de peau » continue sous le visage
 *   (un col de vêtement l'interrompt, un buste nu non).
 *
 * Étage 2 — vérification SÉMANTIQUE par un modèle de VISION (quand disponible).
 *   Les pixels ne voient pas une pose suggestive ou une tenue érotique
 *   techniquement « couvrante ». On demande donc à un modèle multimodal de
 *   juger l'image (SAFE/UNSAFE, consigne stricte « app pour enfants ») :
 *   Gemini côté Google, modèle VL auto-détecté côté LiberTai. Verdict UNSAFE
 *   → image bloquée. Modèle indisponible/en erreur → on retombe sur l'étage 1
 *   (on ne bloque pas toute génération sur une panne du juge).
 *
 * NB : nsfwjs a été essayé puis retiré — son classifieur confond le style
 * anime SFW avec sa classe « Hentai » (sur-blocage) et son chargement
 * échouait parfois (fail-closed → tout bloqué). Mauvais outil pour l'anime.
 */

import { analyzeRgba, JUDGE_INSTRUCTION, parseJudge, pickVisionModel } from './imagecore'
import type { SemanticVerdict } from './imagecore'
export type { SemanticVerdict } from './imagecore'

export interface ImageVerdict {
  safe: boolean
  reason?: string
  scores?: Record<string, number>
}

/** Sous-ensemble de la config IA nécessaire au juge sémantique. */
export interface ModerationAIConfig {
  provider: 'libertai' | 'google'
  apiKey: string
  baseUrl: string
  /** modèle texte/multimodal (Gemini est vision-capable ; LiberTai auto-détecte) */
  textModel: string
}

// ---- Sensibilité réglable par le parent (Espace parents) ------------------
// Décalage appliqué à TOUS les seuils de peau des zones : positif = plus strict
// (bloque davantage), négatif = plus permissif. 0 = réglage par défaut.
const KEY_SENSITIVITY = 'celestine.mod_sensitivity'
export function getModSensitivity(): number {
  // JAMAIS d'exception ici : cette fonction est appelée au cœur du filtre de
  // sécurité, dont le catch global est fail-open. Un localStorage inaccessible
  // (navigation privée, iframe restrictive) désactiverait silencieusement tout
  // le filtre — régression réelle attrapée par le banc e2e.
  try {
    const v = Number(localStorage.getItem(KEY_SENSITIVITY))
    return Number.isFinite(v) ? Math.min(0.2, Math.max(-0.2, v)) : 0
  } catch {
    return 0
  }
}
export function setModSensitivity(v: number) {
  try {
    localStorage.setItem(KEY_SENSITIVITY, String(Math.min(0.2, Math.max(-0.2, v))))
  } catch {
    /* stockage indisponible : le réglage reste au défaut */
  }
}

// ---- Journal de modération (visible dans l'Espace parents) ----------------
export interface ModLogEntry {
  at: number
  safe: boolean
  reason?: string
  scores?: Record<string, number>
  thumb: string // vignette dataURL (petite) pour vérification par le parent
}
const KEY_LOG = 'celestine.mod_log'
const LOG_MAX = 12
export function getModLog(): ModLogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY_LOG) ?? '[]') as ModLogEntry[]
  } catch {
    return []
  }
}
export function clearModLog() {
  try {
    localStorage.removeItem(KEY_LOG)
  } catch {
    /* stockage indisponible */
  }
}
function pushModLog(e: ModLogEntry) {
  try {
    localStorage.setItem(KEY_LOG, JSON.stringify([e, ...getModLog()].slice(0, LOG_MAX)))
  } catch {
    /* quota : on ignore */
  }
}
/** Petite vignette dataURL d'un blob image (pour le journal parents). */
async function thumbFromBlob(blob: Blob): Promise<string> {
  try {
    const bmp = await createImageBitmap(blob)
    const w = 96
    const h = Math.max(1, Math.round((w * bmp.height) / bmp.width))
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')
    if (!ctx) return ''
    ctx.drawImage(bmp, 0, 0, w, h)
    bmp.close()
    return c.toDataURL('image/png')
  } catch {
    return ''
  }
}

// ─────────────────────────────────────────────── étage 1 : analyse de pixels

// isSkin/zones/seuils : déplacés dans imagecore.ts (cœur pur partagé client/serveur)

/** Analyse déterministe des pixels. Renvoie safe:false si une zone du torse est
 *  majoritairement peau nue. Sur erreur d'analyse (rare), on laisse passer :
 *  l'étage sémantique et le prompt durci restent en place. */
export async function moderateImagePixels(blob: Blob): Promise<ImageVerdict> {
  try {
    const bmp = await createImageBitmap(blob)
    const W = 144
    const H = Math.max(1, Math.round((W * bmp.height) / bmp.width))
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return { safe: true }
    ctx.clearRect(0, 0, W, H) // garde la transparence du détourage
    ctx.drawImage(bmp, 0, 0, W, H)
    bmp.close()
    const px = ctx.getImageData(0, 0, W, H).data
    // toute l'analyse vit dans imagecore.ts (partagé avec l'Edge Function)
    return analyzeRgba(px, W, H, getModSensitivity())
  } catch {
    // createImageBitmap/canvas a échoué (rare) : ne pas bloquer toute génération.
    return { safe: true }
  }
}

// ────────────────────────────────────────────── étage 2 : juge de vision (IA)



function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(fr.error)
    fr.readAsDataURL(blob)
  })
}

// Cache de la détection du modèle de vision LiberTai (re-scan quotidien).
const KEY_VISION = 'celestine.ai_vision_model'

async function findLibertaiVisionModel(base: string, apiKey: string): Promise<string | null> {
  try {
    const cached = JSON.parse(localStorage.getItem(KEY_VISION) ?? 'null') as {
      base?: string
      model?: string | null
      at?: number
    } | null
    if (cached && cached.base === base && (cached.model || Date.now() - (cached.at ?? 0) < 24 * 3600_000)) {
      return cached.model ?? null
    }
  } catch {
    /* cache illisible → re-scan */
  }
  let model: string | null = null
  try {
    const res = await fetch(`${base}/v1/models`, { headers: { Authorization: `Bearer ${apiKey}` } })
    if (res.ok) {
      const json = (await res.json()) as { data?: { id?: string }[]; models?: { id?: string; name?: string }[] }
      const ids = (json.data?.map((m) => m.id) ?? json.models?.map((m) => m.id ?? m.name) ?? []).filter(
        Boolean,
      ) as string[]
      model = pickVisionModel(ids)
    }
  } catch {
    return null // panne réseau : ne pas mémoriser, on retentera
  }
  try {
    localStorage.setItem(KEY_VISION, JSON.stringify({ base, model, at: Date.now() }))
  } catch {
    /* stockage plein : tant pis pour le cache */
  }
  return model
}

/** Juge sémantique. `unavailable` = pas de modèle de vision ou panne du juge :
 *  l'appelant retombe alors sur le verdict pixels (on ne bloque pas tout sur
 *  une panne, le prompt durci + l'étage 1 restent actifs). */
export async function moderateImageSemantic(config: ModerationAIConfig, blob: Blob): Promise<SemanticVerdict> {
  try {
    if (config.provider === 'google') {
      // Gemini (textModel, ex. gemini-2.5-flash) est multimodal.
      const dataUrl = await blobToDataURL(blob)
      const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
      const mime = blob.type || 'image/png'
      const url = `${config.baseUrl.replace(/\/$/, '')}/models/${config.textModel}:generateContent?key=${encodeURIComponent(config.apiKey)}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: JUDGE_INSTRUCTION }, { inlineData: { mimeType: mime, data: b64 } }] }],
          generationConfig: { temperature: 0 },
        }),
      })
      if (!res.ok) return 'unavailable'
      const json = await res.json()
      const parts: { text?: string }[] = json?.candidates?.[0]?.content?.parts ?? []
      return parseJudge(parts.map((p) => p.text ?? '').join(' '))
    }

    // LiberTai : nécessite un modèle multimodal exposé par /v1/models.
    const base = config.baseUrl.replace(/\/$/, '')
    const model = await findLibertaiVisionModel(base, config.apiKey)
    if (!model) return 'unavailable'
    const dataUrl = await blobToDataURL(blob)
    const res = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: dataUrl } },
              { type: 'text', text: JUDGE_INSTRUCTION },
            ],
          },
        ],
        temperature: 0,
        max_tokens: 60, // « DESC: … VERDICT: … » (la preuve-de-vue demande quelques mots)
      }),
    })
    if (!res.ok) return 'unavailable'
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    return parseJudge(json.choices?.[0]?.message?.content ?? '')
  } catch {
    return 'unavailable'
  }
}

// ───────────────────────────────────────────────────────── verdict combiné

/** Filtre complet d'un portrait généré : pixels d'abord (instantané), puis
 *  juge de vision si une config IA est fournie. Bloqué dès qu'UN étage refuse. */
export async function moderateImageBlob(blob: Blob, config?: ModerationAIConfig): Promise<ImageVerdict> {
  const verdict = await computeVerdict(blob, config)
  // journal pour l'Espace parents (vignette + verdict + scores)
  try {
    pushModLog({ at: Date.now(), safe: verdict.safe, reason: verdict.reason, scores: verdict.scores, thumb: await thumbFromBlob(blob) })
  } catch {
    /* ignore */
  }
  return verdict
}

async function computeVerdict(blob: Blob, config?: ModerationAIConfig): Promise<ImageVerdict> {
  const pixels = await moderateImagePixels(blob)
  if (!pixels.safe) return pixels
  if (config) {
    const semantic = await moderateImageSemantic(config, blob)
    if (semantic === 'unsafe') {
      return { safe: false, reason: 'refusée par le juge de vision (contenu inapproprié)', scores: pixels.scores }
    }
  }
  return pixels
}
