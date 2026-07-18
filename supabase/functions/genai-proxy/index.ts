/**
 * Edge Function « genai-proxy » — la GenAI côté serveur (M1, docs 02/05/09/10).
 *
 * ARCHITECTURE DE SÛRETÉ — PHASE DE TEST (décision produit assumée) :
 * portraits sur LiberTai (z-image-turbo par défaut, LIBERTAI_PORTRAIT_MODEL
 * pour en changer) afin de rester indépendant des fournisseurs fermés ;
 * bascule prévue vers un fournisseur modéré (Scenario) après les A/B tests.
 *
 * Le modèle par défaut n'ayant PAS de filtrage intégré, la défense en
 * profondeur du client est reproduite ICI, côté serveur, non contournable :
 *  1. prompts construits UNIQUEMENT serveur, à partir de champs structurés,
 *     ancrés SFW (registre « série tout public », tenues couvrantes) ;
 *  2. modération du texte libre rejouée ;
 *  3. filtre pixels par zones anatomiques (imagecore, local à la fonction) ;
 *  4. juge de vision (modèle multimodal du MÊME fournisseur — aucune image
 *     ne part chez un tiers supplémentaire) avec preuve-de-vue ;
 *  5. verdict douteux → nouvelle tentative en tenue ultra-couvrante, puis
 *     refus doux. Jamais de rhabillage côté serveur.
 * Avec GOOGLE_API_KEY (et sans clé LiberTai), les portraits passent par
 * Gemini (filtrage à la génération) et le juge devient inutile.
 * DÉCORS (aucun humain demandé) → z-image-turbo, classe de risque faible.
 *
 * Invariants conservés : clé jamais côté client, prompt construit ICI à partir
 * de champs STRUCTURÉS (promptcore partagé), modération texte rejouée,
 * quota journalier atomique par profil (genai_try_consume), RLS.
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts'
import { JUDGE_INSTRUCTION, analyzeRgba, parseJudge, pickVisionModel } from '../_shared/imagecore.ts'
import type { SemanticVerdict } from '../_shared/imagecore.ts'
import { bgPrompt, portraitPrompt } from '../_shared/promptcore.ts'
import type { PortraitOpts } from '../_shared/promptcore.ts'
import { moderatePrompt } from '../_shared/moderation.ts'

const GOOGLE_KEY = Deno.env.get('GOOGLE_API_KEY') ?? ''
const GOOGLE_IMAGE_MODEL = Deno.env.get('GOOGLE_IMAGE_MODEL') ?? 'gemini-2.5-flash-image'
const GOOGLE_API = 'https://generativelanguage.googleapis.com/v1beta'
const LIBERTAI_BASE = Deno.env.get('LIBERTAI_BASE') ?? 'https://api.libertai.io'
const LIBERTAI_KEY = Deno.env.get('LIBERTAI_API_KEY') ?? ''
/** Modèle des portraits chez LiberTai. Défaut de la phase de test :
 *  z-image-turbo (non filtré → le juge de vision ci-dessous est actif). */
const LIBERTAI_PORTRAIT_MODEL = Deno.env.get('LIBERTAI_PORTRAIT_MODEL') ?? 'z-image-turbo'
const LIBERTAI_DECOR_MODEL = Deno.env.get('LIBERTAI_DECOR_MODEL') ?? 'z-image-turbo'
/** Modèle multimodal du juge (vide = auto-détection sur /v1/models). */
const LIBERTAI_VISION_MODEL = Deno.env.get('LIBERTAI_VISION_MODEL') ?? ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

// ─────────────────────────────────────────────── fournisseurs (côté serveur)

/** Génération Google Gemini : la sécurité est appliquée PAR le fournisseur,
 *  avant toute image. Un refus se manifeste par une réponse sans image. */
async function googleTxt2Img(prompt: string, aspect: string, seed?: number): Promise<Uint8Array> {
  const url = `${GOOGLE_API}/models/${GOOGLE_IMAGE_MODEL}:generateContent?key=${encodeURIComponent(GOOGLE_KEY)}`
  const bodies = [
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspect }, ...(seed != null ? { seed } : {}) },
    },
    { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'], ...(seed != null ? { seed } : {}) } },
  ]
  for (const body of bodies) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) {
      if (res.status === 400) continue // essayer le corps suivant
      throw new Error(`google ${res.status}: ${(await res.text()).slice(0, 200)}`)
    }
    const j = await res.json()
    const parts: { inlineData?: { data?: string } }[] = j?.candidates?.[0]?.content?.parts ?? []
    const img = parts.find((p) => p.inlineData?.data)
    if (img?.inlineData?.data) return Uint8Array.from(atob(img.inlineData.data), (c) => c.charCodeAt(0))
    // pas d'image = refus de sécurité du fournisseur : c'est le comportement attendu
    throw new Error('provider_refused')
  }
  throw new Error('provider_refused')
}

async function libertaiTxt2Img(prompt: string, width: number, height: number, model: string, seed = -1): Promise<Uint8Array> {
  const res = await fetch(`${LIBERTAI_BASE}/sdapi/v1/txt2img`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LIBERTAI_KEY}` },
    body: JSON.stringify({ model, prompt, width, height, steps: 9, cfg_scale: 0, seed }),
  })
  if (!res.ok) {
    // sur un modèle filtré, un 4xx est le refus de sécurité du fournisseur :
    // même sémantique qu'une réponse Google sans image
    if (res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 429) throw new Error('provider_refused')
    throw new Error(`libertai ${res.status}`)
  }
  const j = (await res.json()) as { images?: string[]; image?: string }
  const b64 = j.images?.[0] ?? j.image
  if (!b64) throw new Error('provider_refused') // réponse sans image = refus
  return Uint8Array.from(atob(b64.includes(',') ? b64.slice(b64.indexOf(',') + 1) : b64), (c) => c.charCodeAt(0))
}

/** Portraits via LiberTai si sa clé est là (phase de test), sinon Google. */
const portraitsViaLibertai = () => Boolean(LIBERTAI_KEY)

function portraitTxt2Img(prompt: string, seed: number): Promise<Uint8Array> {
  if (portraitsViaLibertai()) return libertaiTxt2Img(prompt, 576, 1024, LIBERTAI_PORTRAIT_MODEL, seed)
  return googleTxt2Img(prompt, '9:16', seed)
}

// ─────────────────── juge de vision (nécessaire tant que le modèle de
// portraits n'a pas de filtrage intégré) — même fournisseur, preuve-de-vue

let visionModelCache: string | null | undefined

async function visionModel(): Promise<string | null> {
  if (LIBERTAI_VISION_MODEL) return LIBERTAI_VISION_MODEL
  if (visionModelCache !== undefined) return visionModelCache
  try {
    const res = await fetch(`${LIBERTAI_BASE}/v1/models`, { headers: { Authorization: `Bearer ${LIBERTAI_KEY}` } })
    const j = (await res.json()) as { data?: { id?: string }[] }
    visionModelCache = pickVisionModel((j.data ?? []).map((m) => String(m.id ?? '')))
  } catch {
    visionModelCache = null
  }
  return visionModelCache
}

async function judgeVerdict(image: Uint8Array): Promise<SemanticVerdict> {
  try {
    const model = await visionModel()
    if (!model) return 'unavailable'
    const res = await fetch(`${LIBERTAI_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LIBERTAI_KEY}` },
      body: JSON.stringify({
        model,
        max_tokens: 60,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: JUDGE_INSTRUCTION },
              { type: 'image_url', image_url: { url: `data:image/png;base64,${toBase64(image)}` } },
            ],
          },
        ],
      }),
    })
    if (!res.ok) return 'unavailable'
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    return parseJudge(String(j.choices?.[0]?.message?.content ?? ''))
  } catch {
    return 'unavailable'
  }
}

// ─────────────────────────────────────── ceinture locale : filtre pixels

async function pixelsVerdict(image: Uint8Array) {
  const decoded = await Image.decode(image)
  const W = 144
  const H = Math.max(1, Math.round((W * decoded.height) / decoded.width))
  const resized = decoded.resize(W, H)
  return analyzeRgba(resized.bitmap, W, H, 0)
}

// ───────────────────────────── pipeline portrait : défense en profondeur ──

interface PortraitRequest {
  descr?: string
  tags?: string[]
  reinforced?: string[]
  gender?: 'fille' | 'garcon'
  skin?: string
  age?: string
  height?: string
  ambiance?: string
  seed?: number
  universe?: string
}

async function generatePortrait(req: PortraitRequest): Promise<{ image: Uint8Array; scores?: Record<string, number> }> {
  const opts: PortraitOpts = {
    tags: (req.tags ?? []).map(String).slice(0, 24),
    reinforced: (req.reinforced ?? []).map(String).slice(0, 5),
    gender: req.gender === 'garcon' ? 'garcon' : 'fille',
    skin: req.skin,
    age: req.age,
    height: req.height,
    ambiance: req.ambiance,
  }
  const universe = String(req.universe ?? 'sakura')
  const descr = String(req.descr ?? '').slice(0, 220)
  const baseSeed = Number.isFinite(req.seed) ? Number(req.seed) : Math.floor(Math.random() * 1_000_000_000)

  let coverMax = false
  let backup: { image: Uint8Array; scores?: Record<string, number> } | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    const seed = attempt === 0 ? baseSeed : Math.floor(Math.random() * 1_000_000_000)
    // refus du fournisseur ou pixels douteux → tentative suivante en tenue
    // ultra-couvrante, texte libre écarté au dernier essai
    const useDescr = attempt === 2 ? '' : descr
    let image: Uint8Array
    try {
      image = await portraitTxt2Img(portraitPrompt(useDescr, opts, seed, coverMax, universe), seed)
    } catch (e) {
      if (String(e).includes('provider_refused')) {
        coverMax = true
        continue
      }
      throw e
    }
    const pixels = await pixelsVerdict(image)
    if (!pixels.safe) {
      coverMax = true
      continue
    }
    // modèle sans filtrage intégré → second regard sémantique obligatoire ;
    // 'unavailable' (juge aveugle/indisponible) laisse le verdict aux pixels
    if (portraitsViaLibertai() && (await judgeVerdict(image)) === 'unsafe') {
      coverMax = true
      continue
    }
    if (pixels.scores?.piedsBord && !backup) {
      backup = { image, scores: pixels.scores }
      continue
    }
    return { image, scores: pixels.scores }
  }
  if (backup) return backup
  throw new Error('generation_refused')
}

// ──────────────────────────────────────────────────────────── point d'entrée

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (request.method !== 'POST') return json(405, { error: 'POST uniquement' })
  if (!GOOGLE_KEY && !LIBERTAI_KEY) return json(500, { error: 'Configurer LIBERTAI_API_KEY (phase de test) ou GOOGLE_API_KEY.' })

  const authHeader = request.headers.get('Authorization') ?? ''
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) return json(401, { error: 'session parent requise' })

  let body: { kind?: string; profileId?: string; prompt?: string; universe?: string; ambiance?: string } & PortraitRequest
  try {
    body = await request.json()
  } catch {
    return json(400, { error: 'JSON invalide' })
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: profile } = await admin
    .from('child_profiles')
    .select('id, parent_id, genai_enabled')
    .eq('id', body.profileId ?? '')
    .single()
  if (!profile || profile.parent_id !== user.id) return json(403, { error: 'profil inconnu pour ce compte' })
  if (!profile.genai_enabled) return json(403, { error: 'La magie est désactivée par le parent.' })

  const freeText = [body.descr ?? '', body.prompt ?? '', ...(body.tags ?? [])].join(', ')
  const problem = moderatePrompt(freeText || 'décor', 400)
  if (problem && (body.descr || body.prompt)) return json(422, { error: problem })

  const { data: allowed } = await admin.rpc('genai_try_consume', { p_profile: profile.id })
  if (!allowed) return json(429, { error: 'Le quota magique du jour est atteint — demande à un parent.' })

  try {
    if (body.kind === 'decor') {
      const prompt = bgPrompt(String(body.prompt ?? '').slice(0, 200), String(body.universe ?? 'sakura'), body.ambiance)
      // décors : aucun humain demandé (classe de risque faible) — LiberTai si
      // configuré (coût quasi nul), sinon Google
      const image = LIBERTAI_KEY
        ? await libertaiTxt2Img(prompt, 1024, 576, LIBERTAI_DECOR_MODEL)
        : await googleTxt2Img(prompt, '16:9', Math.floor(Math.random() * 1_000_000_000))
      return json(200, { image: toBase64(image), mime: 'image/png' })
    }
    const { image, scores } = await generatePortrait(body)
    return json(200, { image: toBase64(image), mime: 'image/png', scores })
  } catch (e) {
    if (String(e).includes('generation_refused')) {
      return json(422, { error: 'Plume n’a pas réussi une photo assez sage cette fois 🌸 Réessaie en changeant une tuile !' })
    }
    console.error('genai-proxy:', e)
    return json(502, { error: 'La magie n’a pas répondu — réessaie dans un instant.' })
  }
})

function toBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return btoa(bin)
}
