/**
 * Modération d'IMAGE côté sortie (sécurité enfant).
 *
 * Chaque portrait généré est analysé AVANT d'être affiché/enregistré par un
 * classifieur NSFW embarqué (nsfwjs / TensorFlow.js — modèle MobileNetV2 fourni
 * avec le paquet, chargé à la demande, aucun appel réseau externe). Sa classe
 * « Hentai » est entraînée sur le dessin/anime adulte : c'est exactement notre
 * cas d'usage.
 *
 * Principe FAIL-CLOSED : si le filtre ne peut pas se charger ou lève une erreur,
 * l'image est considérée comme NON SÛRE (bloquée). Mieux vaut bloquer une image
 * correcte (l'enfant réessaie) que laisser passer une image inappropriée.
 */

export interface ImageVerdict {
  safe: boolean
  reason?: string
  scores?: Record<string, number>
}

// nsfwjs + tfjs sont lourds : on ne les charge QUE quand un portrait est généré
// (import dynamique → chunk séparé, hors du bundle principal).
let modelPromise: Promise<{ classify: (el: HTMLCanvasElement) => Promise<{ className: string; probability: number }[]> }> | null = null

async function getModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      // on n'embarque QUE MobileNetV2 (~3.5 Mo, poids inclus dans le paquet et
      // importés dynamiquement) — pas les autres modèles (Inception = 29 Mo), et
      // aucune URL externe à joindre.
      const [{ load }, { MobileNetV2Model }] = await Promise.all([
        import('nsfwjs/core'),
        import('nsfwjs/models/mobilenet_v2'),
      ])
      return load('MobileNetV2', { modelDefinitions: [MobileNetV2Model] })
    })()
  }
  return modelPromise
}

// Seuils volontairement PRUDENTS (app pour enfant) : on préfère un faux positif
// (image sûre bloquée) à un faux négatif (nudité affichée).
const T_HENTAI = 0.14 // nu dessiné/anime
const T_PORN = 0.14
const T_COMBINED = 0.35 // Hentai + Porn + Sexy cumulés

/** Analyse un portrait. Renvoie safe:false au moindre doute (fail-closed). */
export async function moderateImageBlob(blob: Blob): Promise<ImageVerdict> {
  try {
    const model = await getModel()
    const bmp = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = bmp.width
    canvas.height = bmp.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return { safe: false, reason: 'filtre indisponible' }
    // fond blanc sous l'alpha (portraits détourés) pour un rendu cohérent
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bmp, 0, 0)
    bmp.close()

    const preds = await model.classify(canvas)
    const s: Record<string, number> = {}
    for (const p of preds) s[p.className] = p.probability
    const hentai = s.Hentai ?? 0
    const porn = s.Porn ?? 0
    const sexy = s.Sexy ?? 0
    const unsafe = hentai >= T_HENTAI || porn >= T_PORN || hentai + porn + sexy >= T_COMBINED
    return { safe: !unsafe, scores: s, reason: unsafe ? 'contenu inapproprié détecté' : undefined }
  } catch {
    // chargement/analyse impossible → on bloque (fail-closed)
    return { safe: false, reason: 'filtre indisponible' }
  }
}
