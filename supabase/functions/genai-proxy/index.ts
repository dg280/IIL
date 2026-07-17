/**
 * Edge Function « genai-proxy » — la GenAI côté serveur (M1, doc 02/05/09).
 *
 * Rôle : le client n'appelle PLUS jamais un fournisseur IA directement.
 *  - la clé LiberTai vit ici (secret LIBERTAI_API_KEY), jamais sur l'appareil ;
 *  - le prompt est construit ICI à partir de champs STRUCTURÉS (un client ne
 *    peut pas injecter de prompt arbitraire) — même code que le client
 *    (promptcore, pur) ;
 *  - la modération est rejouée ICI, non contournable : texte (moderation),
 *    pixels par zones (imagecore.analyzeRgba, décodage imagescript), juge de
 *    vision avec preuve-de-vue, régénération couverte puis rhabillage
 *    qwen-image-edit — le même pipeline « toujours un résultat » que le client ;
 *  - le quota journalier par profil est décompté en base (genai_try_consume),
 *    fixé par le parent, atomique.
 *
 * Auth : JWT Supabase du parent (magic link) + child_profile_id possédé.
 * Entrées : POST JSON { kind: 'portrait'|'decor', profileId, ...champs }.
 * Sortie : { image: base64, mime, scores? } ou { error } avec status parlant.
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts'
import { analyzeRgba, JUDGE_INSTRUCTION, parseJudge, pickVisionModel } from '../_shared/imagecore.ts'
import {
  REDRESS_INSTRUCTION,
  bgPrompt,
  portraitPrompt,
} from '../_shared/promptcore.ts'
import type { PortraitOpts } from '../_shared/promptcore.ts'
import { moderatePrompt } from '../_shared/moderation.ts'

const LIBERTAI_BASE = Deno.env.get('LIBERTAI_BASE') ?? 'https://api.libertai.io'
const LIBERTAI_KEY = Deno.env.get('LIBERTAI_API_KEY') ?? ''
const IMAGE_MODEL = Deno.env.get('LIBERTAI_IMAGE_MODEL') ?? 'z-image-turbo'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

// ─────────────────────────────────────────────── appels fournisseur (serveur)

async function libertaiTxt2Img(prompt: string, width: number, height: number, seed: number, removeBackground: boolean): Promise<Uint8Array> {
  const res = await fetch(`${LIBERTAI_BASE}/sdapi/v1/txt2img`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LIBERTAI_KEY}` },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      width,
      height,
      steps: 9,
      cfg_scale: 0,
      seed,
      remove_background: removeBackground,
    }),
  })
  if (!res.ok) throw new Error(`libertai txt2img ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const j = (await res.json()) as { images?: string[]; image?: string }
  const b64 = j.images?.[0] ?? j.image
  if (!b64) throw new Error('libertai: réponse sans image')
  return Uint8Array.from(atob(b64.includes(',') ? b64.slice(b64.indexOf(',') + 1) : b64), (c) => c.charCodeAt(0))
}

async function libertaiRedress(image: Uint8Array): Promise<Uint8Array> {
  const form = new FormData()
  form.append('model', 'qwen-image-edit')
  form.append('prompt', REDRESS_INSTRUCTION)
  form.append('image', new Blob([image], { type: 'image/png' }), 'portrait.png')
  const res = await fetch(`${LIBERTAI_BASE}/v1/images/edits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${LIBERTAI_KEY}` },
    body: form,
  })
  if (!res.ok) throw new Error(`libertai edits ${res.status}`)
  const j = (await res.json()) as { data?: { b64_json?: string }[]; images?: string[]; image?: string }
  const b64 = j.data?.[0]?.b64_json ?? j.images?.[0] ?? j.image
  if (!b64) throw new Error('libertai edits: réponse sans image')
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

// ─────────────────────────────────────────────── modération serveur (étages)

async function pixelsVerdict(image: Uint8Array) {
  const decoded = await Image.decode(image)
  const W = 144
  const H = Math.max(1, Math.round((W * decoded.height) / decoded.width))
  const resized = decoded.resize(W, H)
  // imagescript expose un bitmap RGBA à plat, identique à getImageData().data
  return analyzeRgba(resized.bitmap, W, H, 0)
}

let cachedVisionModel: string | null | undefined
async function findVisionModel(): Promise<string | null> {
  if (cachedVisionModel !== undefined) return cachedVisionModel
  try {
    const res = await fetch(`${LIBERTAI_BASE}/v1/models`, { headers: { Authorization: `Bearer ${LIBERTAI_KEY}` } })
    if (!res.ok) return (cachedVisionModel = null)
    const j = (await res.json()) as { data?: { id?: string }[] }
    const ids = (j.data ?? []).map((m) => m.id).filter(Boolean) as string[]
    cachedVisionModel = pickVisionModel(ids)
  } catch {
    cachedVisionModel = null
  }
  return cachedVisionModel
}

function toBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return btoa(bin)
}

async function judgeVerdict(image: Uint8Array): Promise<'safe' | 'unsafe' | 'unavailable'> {
  const model = await findVisionModel()
  if (!model) return 'unavailable'
  try {
    const res = await fetch(`${LIBERTAI_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LIBERTAI_KEY}` },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:image/png;base64,${toBase64(image)}` } },
              { type: 'text', text: JUDGE_INSTRUCTION },
            ],
          },
        ],
        temperature: 0,
        max_tokens: 60,
      }),
    })
    if (!res.ok) return 'unavailable'
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    return parseJudge(j.choices?.[0]?.message?.content ?? '')
  } catch {
    return 'unavailable'
  }
}

// ───────────────────────────── pipeline portrait « toujours un résultat » ──

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

  let flagged = false
  let cropped = false
  let backup: { image: Uint8Array; scores?: Record<string, number> } | null = null
  let lastFlagged: Uint8Array | null = null

  for (let attempt = 0; attempt < 3; attempt++) {
    const seed = attempt === 0 ? baseSeed : Math.floor(Math.random() * 1_000_000_000)
    let prompt = portraitPrompt(descr, opts, seed, flagged, universe)
    if (cropped) prompt += ` Zoom out further: the ENTIRE figure with shoes and clear empty space below the feet fits inside the frame.`
    const image = await libertaiTxt2Img(prompt, 768, 1152, seed, true)
    const pixels = await pixelsVerdict(image)
    if (!pixels.safe) {
      flagged = true
      lastFlagged = image
      continue
    }
    const semantic = await judgeVerdict(image)
    if (semantic === 'unsafe') {
      flagged = true
      lastFlagged = image
      continue
    }
    if (pixels.scores?.piedsBord) {
      cropped = true
      backup = { image, scores: pixels.scores }
      continue
    }
    return { image, scores: pixels.scores }
  }
  if (backup) return backup
  if (flagged) {
    // avant-dernier recours : tenue garantie (texte libre écarté)
    const rescueSeed = Math.floor(Math.random() * 1_000_000_000)
    const rescue = await libertaiTxt2Img(portraitPrompt('', opts, rescueSeed, true, universe), 768, 1152, rescueSeed, true)
    const pixels = await pixelsVerdict(rescue)
    if (pixels.safe && (await judgeVerdict(rescue)) !== 'unsafe') return { image: rescue, scores: pixels.scores }
    lastFlagged = rescue
    // dernier recours : RHABILLER au lieu de refuser — pixels obligatoires ensuite
    const dressed = await libertaiRedress(lastFlagged)
    const dressedPixels = await pixelsVerdict(dressed)
    if (dressedPixels.safe) return { image: dressed, scores: dressedPixels.scores }
  }
  throw new Error('generation_refused')
}

// ──────────────────────────────────────────────────────────── point d'entrée

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (request.method !== 'POST') return json(405, { error: 'POST uniquement' })
  if (!LIBERTAI_KEY) return json(500, { error: 'LIBERTAI_API_KEY non configurée' })

  // auth parent (JWT) + propriété du profil enfant
  const authHeader = request.headers.get('Authorization') ?? ''
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) return json(401, { error: 'session parent requise' })

  let body: { kind?: string; profileId?: string } & PortraitRequest & { prompt?: string }
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

  // modération TEXTE côté serveur (non contournable)
  const freeText = [body.descr ?? '', body.prompt ?? '', ...(body.tags ?? [])].join(', ')
  const problem = moderatePrompt(freeText || 'décor', 400)
  if (problem && (body.descr || body.prompt)) return json(422, { error: problem })

  // quota atomique par profil
  const { data: allowed } = await admin.rpc('genai_try_consume', { p_profile: profile.id })
  if (!allowed) return json(429, { error: 'Le quota magique du jour est atteint — demande à un parent.' })

  try {
    if (body.kind === 'decor') {
      const prompt = bgPrompt(String(body.prompt ?? '').slice(0, 200), String(body.universe ?? 'sakura'), body.ambiance)
      const image = await libertaiTxt2Img(prompt, 1024, 576, Math.floor(Math.random() * 1_000_000_000), false)
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
