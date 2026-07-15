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

// ─────────────────────────────────────────────── étage 1 : analyse de pixels

/** Un pixel est-il de la peau ? Règle YCbCr (du teint très clair au foncé,
 *  y compris peaux anime lissées) + « chaleur » r>g>b qui écarte les roses
 *  froids (cheveux/robes roses, fréquents en otome, sinon comptés peau). */
function isSkin(r: number, g: number, b: number): boolean {
  if (r <= 60 || r <= g || g < b) return false
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
  return cr >= 133 && cr <= 180 && cb >= 80 && cb <= 138
}

/** Zones anatomiques d'un personnage debout EN PIED (fractions de la bbox).
 *  Repères ~7 têtes : menton ≈ 0.14, ligne de poitrine ≈ 0.25, nombril ≈ 0.35,
 *  entrejambe ≈ 0.47. Marges larges pour absorber la variance de style. */
const ZONES: { key: string; y0: number; y1: number; max: number }[] = [
  { key: 'poitrine', y0: 0.15, y1: 0.3, max: 0.62 },
  { key: 'ventre', y0: 0.3, y1: 0.44, max: 0.6 },
  { key: 'bassin', y0: 0.44, y1: 0.57, max: 0.6 },
  { key: 'torse', y0: 0.15, y1: 0.57, max: 0.55 },
  // cuisses (hanches → genoux) : intercepte jupes/shorts trop courts — la
  // politique famille est « jupe au genou » (cf. #41, repris de la branche
  // routine). Les mollets (sous 0.75) restent libres : chaussettes/jupe ok.
  { key: 'cuisses', y0: 0.58, y1: 0.75, max: 0.55 },
]
// Bande horizontale centrale (écarte les bras le long du corps).
const ZX0 = 0.28
const ZX1 = 0.72
// « Coulée de peau » : longueur maxi de peau continue depuis le haut (visage +
// cou ≈ 0.20 de la hauteur ; au-delà, le torse est nu — un col l'interrompt).
const TOP_RUN_MAX = 0.32
// Il faut assez de « personnage » dans une zone pour que la mesure ait un sens.
const MIN_FOREGROUND = 0.15

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

    // Masque « personnage » : transparent = fond ; image SANS détourage (tout
    // opaque) → le fond est estimé depuis les 4 coins (couleur unie du studio).
    let opaqueCount = 0
    for (let i = 3; i < px.length; i += 4) if (px[i] > 40) opaqueCount++
    const noCutout = opaqueCount > 0.97 * W * H
    const corners: number[][] = []
    if (noCutout) {
      for (const [cx, cy] of [
        [0, 0],
        [W - 6, 0],
        [0, H - 6],
        [W - 6, H - 6],
      ]) {
        let r = 0,
          g = 0,
          b = 0,
          n = 0
        for (let y = cy; y < cy + 6; y++)
          for (let x = cx; x < cx + 6; x++) {
            const i = (y * W + x) * 4
            r += px[i]
            g += px[i + 1]
            b += px[i + 2]
            n++
          }
        corners.push([r / n, g / n, b / n])
      }
    }
    const isBg = (i: number): boolean => {
      if (px[i + 3] <= 40) return true
      const r = px[i],
        g = px[i + 1],
        b = px[i + 2]
      if (r > 244 && g > 244 && b > 244) return true // blanc du studio/repli
      if (noCutout) {
        // Distance euclidienne serrée : un fond de studio uni/dégradé colle aux
        // coins, alors qu'une peau claire sur fond clair reste au-delà du seuil
        // (sinon un personnage dénudé « disparaîtrait » dans le fond).
        for (const [cr2, cg2, cb2] of corners) {
          if ((r - cr2) ** 2 + (g - cg2) ** 2 + (b - cb2) ** 2 < 1024) return true
        }
      }
      return false
    }

    // Bounding box du personnage.
    let x0 = W,
      y0 = H,
      x1 = 0,
      y1 = 0,
      fg = 0
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!isBg((y * W + x) * 4)) {
          fg++
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (y < y0) y0 = y
          if (y > y1) y1 = y
        }
      }
    }
    if (fg < 0.02 * W * H) return { safe: true } // image quasi vide : rien à juger
    const bh = y1 - y0
    const bw = x1 - x0
    if (bh < 12 || bw < 8) return { safe: true }

    const scores: Record<string, number> = {}
    // Qualité (pas sécurité) : personnage collé au bord bas = pieds sans doute
    // coupés. Signalé via scores.piedsBord ; l'appelant peut recadrer/retenter.
    scores.piedsBord = y1 >= H - 2 ? 1 : 0
    const txL = Math.round(x0 + ZX0 * bw)
    const txR = Math.round(x0 + ZX1 * bw)

    const zoneRatio = (fy0: number, fy1: number): number | null => {
      const ty0 = Math.round(y0 + fy0 * bh)
      const ty1 = Math.round(y0 + fy1 * bh)
      let band = 0,
        bandFg = 0,
        skin = 0
      for (let y = ty0; y <= ty1; y++) {
        for (let x = txL; x <= txR; x++) {
          const i = (y * W + x) * 4
          band++
          if (isBg(i)) continue
          bandFg++
          if (isSkin(px[i], px[i + 1], px[i + 2])) skin++
        }
      }
      if (band === 0 || bandFg / band < MIN_FOREGROUND) return null
      return skin / bandFg
    }

    // Silhouette debout en pied → zones anatomiques fiables.
    const fullBody = bh >= 1.8 * bw
    if (fullBody) {
      for (const z of ZONES) {
        const ratio = zoneRatio(z.y0, z.y1)
        if (ratio == null) continue
        scores[z.key] = Number(ratio.toFixed(3))
        if (ratio >= z.max) return { safe: false, reason: `zone « ${z.key} » dénudée`, scores }
      }

      // « Coulée de peau » continue depuis le haut du personnage (visage → ?).
      // Par ligne : part de peau parmi les pixels personnage de la bande centrale.
      let run = 0,
        gap = 0,
        started = false
      for (let y = y0; y <= y1; y++) {
        let rowFg = 0,
          rowSkin = 0
        for (let x = txL; x <= txR; x++) {
          const i = (y * W + x) * 4
          if (isBg(i)) continue
          rowFg++
          if (isSkin(px[i], px[i + 1], px[i + 2])) rowSkin++
        }
        const skinRow = rowFg >= 3 && rowSkin / rowFg >= 0.4
        if (skinRow) {
          started = true
          run++
          gap = 0
        } else if (started) {
          if (++gap > 2) break // 2 lignes de tolérance (mèches, collier fin)
          run++
        }
      }
      const topRun = run / bh
      scores.couleePeau = Number(topRun.toFixed(3))
      if (topRun >= TOP_RUN_MAX) return { safe: false, reason: 'buste dénudé (peau continue sous le visage)', scores }
    } else {
      // Cadrage buste/carré : zones inapplicables → bande générique sous le visage.
      const ratio = zoneRatio(0.45, 0.85)
      if (ratio != null) {
        scores.buste = Number(ratio.toFixed(3))
        if (ratio >= 0.6) return { safe: false, reason: 'buste dénudé', scores }
      }
    }

    return { safe: true, scores }
  } catch {
    // createImageBitmap/canvas a échoué (rare) : ne pas bloquer toute génération.
    return { safe: true }
  }
}

// ────────────────────────────────────────────── étage 2 : juge de vision (IA)

// Preuve-de-vue exigée : le gateway LiberTai SUPPRIME silencieusement l'image
// si le modèle ciblé n'a pas la vision (aucune erreur) — un juge aveugle
// répondrait « SAFE » sans avoir rien vu. On lui demande donc de décrire
// l'image (DESC) avant son verdict, et de dire NOIMAGE s'il ne voit rien.
const JUDGE_INSTRUCTION =
  'You are a strict image-safety moderator for a children\'s app (ages 10 and up). ' +
  'If no image is attached or you cannot see it, reply exactly: NOIMAGE. ' +
  'Otherwise look at the anime-style character illustration and answer on ONE line in this exact format: ' +
  'DESC: <five words describing what you see> VERDICT: <SAFE or UNSAFE>. ' +
  'VERDICT is UNSAFE if the image contains ANY of: nudity or partial nudity, a bare chest or bare torso, ' +
  'underwear, lingerie, swimwear or bikini, visible cleavage, a sexualized or suggestive pose, ' +
  'revealing or erotic attire, or any ecchi / hentai styling. ' +
  'VERDICT is SAFE only if the character is fully and modestly clothed and entirely appropriate for children. ' +
  'When in doubt, answer UNSAFE.'

export type SemanticVerdict = 'safe' | 'unsafe' | 'unavailable'

function parseJudge(text: string): SemanticVerdict {
  if (/noimage/i.test(text)) return 'unavailable' // image strippée : juge aveugle, ne rien conclure
  if (/unsafe/i.test(text)) return 'unsafe'
  // un SAFE n'est retenu que si le juge PROUVE avoir vu l'image (description)
  if (/\bsafe\b/i.test(text) && /desc\s*:/i.test(text)) return 'safe'
  return 'unavailable' // réponse inexploitable → on n'en tire rien
}

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
// Modèles multimodaux CONNUS de LiberTai, par ordre de préférence (gemma-4-31b-it
// est le modèle vision de référence de leur doc officielle). La liste évoluant,
// une regex générique sert de repli pour les futurs ids.
const KNOWN_VISION_MODELS = ['gemma-4-31b-it', 'qwen3.6-35b-a3b', 'glm-4.7', 'qwen3-coder-next']
const VISION_RE = /(-vl\b|vl-|qwen[^\s]*vl|vision|llava|pixtral|internvl|minicpm|moondream|gemma-[3-9])/i

function pickVisionModel(ids: string[]): string | null {
  for (const known of KNOWN_VISION_MODELS) {
    const hit = ids.find((id) => id === known || id.startsWith(`${known}`))
    if (hit) return hit
  }
  return ids.find((id) => VISION_RE.test(id)) ?? null
}

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
