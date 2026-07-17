/**
 * Edge Function « genai-proxy » — la GenAI côté serveur (M1, docs 02/05/09/10).
 *
 * ARCHITECTURE DE SÛRETÉ (révisée après revue) : la sécurité des personnages
 * est assurée PAR PRÉVENTION À LA SOURCE, pas par filtrage a posteriori.
 *
 *  - PORTRAITS (tout personnage humain) → Google Gemini image UNIQUEMENT :
 *    ses filtres de sécurité intégrés bloquent la génération elle-même — un
 *    contenu inapproprié n'existe jamais, même comme étape intermédiaire, et
 *    aucune image n'est transmise à un juge tiers. En cas de refus du
 *    fournisseur : nouvelle tentative en tenue ultra-couvrante, puis refus
 *    doux. Le filtre pixels (imagecore, local à la fonction) reste en
 *    ceinture de sécurité.
 *  - DÉCORS (paysages/architecture, aucun humain demandé) → LiberTai, cantonné
 *    à cette classe de risque faible. Clé optionnelle : sans elle, les décors
 *    passent aussi par Google.
 *
 * Invariants conservés : clé jamais côté client, prompt construit ICI à partir
 * de champs STRUCTURÉS (promptcore partagé), modération texte rejouée,
 * quota journalier atomique par profil (genai_try_consume), RLS.
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts'
import { analyzeRgba } from '../_shared/imagecore.ts'
import { bgPrompt, portraitPrompt } from '../_shared/promptcore.ts'
import type { PortraitOpts } from '../_shared/promptcore.ts'
import { moderatePrompt } from '../_shared/moderation.ts'

const GOOGLE_KEY = Deno.env.get('GOOGLE_API_KEY') ?? ''
const GOOGLE_IMAGE_MODEL = Deno.env.get('GOOGLE_IMAGE_MODEL') ?? 'gemini-2.5-flash-image'
const GOOGLE_API = 'https://generativelanguage.googleapis.com/v1beta'
const LIBERTAI_BASE = Deno.env.get('LIBERTAI_BASE') ?? 'https://api.libertai.io'
const LIBERTAI_KEY = Deno.env.get('LIBERTAI_API_KEY') ?? '' // décors uniquement, optionnelle

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

async function libertaiTxt2Img(prompt: string, width: number, height: number): Promise<Uint8Array> {
  const res = await fetch(`${LIBERTAI_BASE}/sdapi/v1/txt2img`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LIBERTAI_KEY}` },
    body: JSON.stringify({ model: 'z-image-turbo', prompt, width, height, steps: 9, cfg_scale: 0, seed: -1 }),
  })
  if (!res.ok) throw new Error(`libertai ${res.status}`)
  const j = (await res.json()) as { images?: string[]; image?: string }
  const b64 = j.images?.[0] ?? j.image
  if (!b64) throw new Error('libertai: réponse sans image')
  return Uint8Array.from(atob(b64.includes(',') ? b64.slice(b64.indexOf(',') + 1) : b64), (c) => c.charCodeAt(0))
}

// ─────────────────────────────────────── ceinture locale : filtre pixels

async function pixelsVerdict(image: Uint8Array) {
  const decoded = await Image.decode(image)
  const W = 144
  const H = Math.max(1, Math.round((W * decoded.height) / decoded.width))
  const resized = decoded.resize(W, H)
  return analyzeRgba(resized.bitmap, W, H, 0)
}

// ───────────────────────────── pipeline portrait : prévention à la source ──

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
      image = await googleTxt2Img(portraitPrompt(useDescr, opts, seed, coverMax, universe), '9:16', seed)
    } catch (e) {
      if (String(e).includes('provider_refused')) {
        coverMax = true
        continue
      }
      throw e
    }
    const pixels = await pixelsVerdict(image)
    if (!pixels.safe) {
      // ceinture locale : très rare derrière les filtres Google — on resserre
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
  if (!GOOGLE_KEY) return json(500, { error: 'GOOGLE_API_KEY non configurée (portraits sûrs à la source)' })

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
        ? await libertaiTxt2Img(prompt, 1024, 576)
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
