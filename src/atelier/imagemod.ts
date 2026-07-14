/**
 * Modération d'IMAGE côté sortie (sécurité enfant) — approche DÉTERMINISTE.
 *
 * On n'utilise PAS de modèle ML (nsfwjs confondait le style anime avec sa classe
 * « Hentai » et bloquait tout, ou échouait à se charger → tout bloqué). À la
 * place, une analyse de pixels ciblée sur le mode d'échec réel : un portrait NU
 * montre une grande zone de PEAU nue sur le TORSE. Un personnage habillé a des
 * vêtements (couleur ≠ peau) sur le torse.
 *
 * On mesure donc la proportion de peau sur la bande « torse » du personnage
 * (sous le visage, au-dessus des hanches). Trop de peau → torse dénudé → bloqué.
 * Déterministe, instantané, hors-ligne, insensible au style anime, aucune
 * dépendance à charger.
 */

export interface ImageVerdict {
  safe: boolean
  reason?: string
  scores?: Record<string, number>
}

/** Un pixel est-il de la peau ? Règle YCbCr (robuste du teint très clair au foncé,
 *  y compris peaux anime lissées). Le blanc/marine/rouge/vif des vêtements sort
 *  des plages ci-dessous. */
function isSkin(r: number, g: number, b: number): boolean {
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
  return cr >= 135 && cr <= 178 && cb >= 85 && cb <= 135 && r > 70
}

// Proportion de peau au-delà de laquelle on considère le torse comme dénudé.
const TORSO_SKIN_MAX = 0.6
// Il faut assez de « personnage » dans la bande pour que la mesure ait un sens.
const MIN_FOREGROUND = 0.15

/** Analyse un portrait détouré. Renvoie safe:false si le torse est majoritairement
 *  peau nue. Sur erreur d'analyse (rare), on n'empêche pas la génération. */
export async function moderateImageBlob(blob: Blob): Promise<ImageVerdict> {
  try {
    const bmp = await createImageBitmap(blob)
    const W = 120
    const H = Math.max(1, Math.round((W * bmp.height) / bmp.width))
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return { safe: true } // pas d'analyse possible → on laisse passer (le prompt reste durci)
    ctx.clearRect(0, 0, W, H) // garde la transparence du détourage
    ctx.drawImage(bmp, 0, 0, W, H)
    bmp.close()
    const px = ctx.getImageData(0, 0, W, H).data

    // Bounding box du personnage (pixels non transparents) → bande torse relative.
    let x0 = W,
      y0 = H,
      x1 = 0,
      y1 = 0,
      fg = 0
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (px[(y * W + x) * 4 + 3] > 40) {
          fg++
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (y < y0) y0 = y
          if (y > y1) y1 = y
        }
      }
    }
    const opaque = fg > 0.9 * W * H // image sans détourage (fond plein) → bbox = image entière
    if (fg === 0 || opaque) {
      x0 = 0
      y0 = 0
      x1 = W - 1
      y1 = H - 1
    }
    const bh = y1 - y0
    const bw = x1 - x0
    if (bh < 8 || bw < 8) return { safe: true }

    // Bande TORSE : sous le visage/cou, au-dessus des hanches ; centrée horizontalement.
    const tyTop = Math.round(y0 + 0.3 * bh)
    const tyBot = Math.round(y0 + 0.58 * bh)
    const txL = Math.round(x0 + 0.25 * bw)
    const txR = Math.round(x0 + 0.75 * bw)

    let band = 0,
      bandFg = 0,
      skin = 0
    for (let y = tyTop; y <= tyBot; y++) {
      for (let x = txL; x <= txR; x++) {
        const i = (y * W + x) * 4
        band++
        const a = px[i + 3]
        const r = px[i],
          g = px[i + 1],
          b = px[i + 2]
        // fond détouré (transparent) ou blanc du repli → pas « personnage »
        const isBg = a <= 40 || (r > 244 && g > 244 && b > 244)
        if (isBg) continue
        bandFg++
        if (isSkin(r, g, b)) skin++
      }
    }
    if (band === 0 || bandFg / band < MIN_FOREGROUND) return { safe: true }
    const ratio = skin / bandFg
    const unsafe = ratio >= TORSO_SKIN_MAX
    return { safe: !unsafe, scores: { torsoSkin: Number(ratio.toFixed(3)) }, reason: unsafe ? 'torse dénudé détecté' : undefined }
  } catch {
    // createImageBitmap/canvas a échoué (rare) : ne pas bloquer toute génération.
    return { safe: true }
  }
}
