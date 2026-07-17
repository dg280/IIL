/**
 * CŒUR PUR du filtre d'images par zones anatomiques — aucune dépendance
 * navigateur (pas de canvas, pas de localStorage) : la MÊME analyse tourne
 * dans le client (imagemod.ts, décodage canvas) et dans l'Edge Function
 * Supabase (décodage imagescript). Toute évolution des seuils se fait ICI,
 * une seule fois, et reste couverte par le banc e2e (48 cas).
 *
 * Entrée : pixels RGBA à plat (image déjà réduite, ~144px de large), largeur,
 * hauteur, et le décalage de sensibilité (positif = plus strict).
 */

export interface PixelVerdict {
  safe: boolean
  reason?: string
  scores?: Record<string, number>
}

/** Un pixel est-il de la peau ? Règle YCbCr (du teint très clair au foncé,
 *  y compris peaux anime lissées) + « chaleur » r>g>b qui écarte les roses
 *  froids (cheveux/robes roses, fréquents en otome, sinon comptés peau). */
export function isSkin(r: number, g: number, b: number): boolean {
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
  // politique famille est « jupe au genou ». Mollets (sous 0.75) libres.
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

/** Analyse déterministe d'une image RGBA (déjà réduite). Renvoie safe:false si
 *  une zone du corps est majoritairement peau nue. `sens` décale tous les
 *  seuils (positif = plus strict), borné en amont par l'appelant. */
export function analyzeRgba(px: Uint8ClampedArray | Uint8Array, W: number, H: number, sens = 0): PixelVerdict {
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
      if (ratio >= z.max - sens) return { safe: false, reason: `zone « ${z.key} » dénudée`, scores }
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
    if (topRun >= TOP_RUN_MAX - sens) return { safe: false, reason: 'buste dénudé (peau continue sous le visage)', scores }
  } else {
    // Cadrage buste/carré : zones inapplicables → bande générique sous le visage.
    const ratio = zoneRatio(0.45, 0.85)
    if (ratio != null) {
      scores.buste = Number(ratio.toFixed(3))
      if (ratio >= 0.6 - sens) return { safe: false, reason: 'buste dénudé', scores }
    }
  }

  return { safe: true, scores }
}
