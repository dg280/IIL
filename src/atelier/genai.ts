/**
 * Fournisseur GenAI réel — Google AI Studio (une clé : Gemini image + Veo vidéo).
 *
 * ⚠️ La clé est stockée sur l'appareil (Espace parents) : acceptable pour un
 * usage familial. Pour une mise en production publique, ces appels doivent
 * passer par un backend qui garde la clé et applique modération/quotas
 * (doc 05) — l'interface de ce module ne changera pas.
 */

import { checkPrompt } from './generator'
import { cleanList, isCleanText, moderatePrompt } from './moderation'
import { moderateImageBlob } from './imagemod'

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

// -------------------------------------------------------------- style guide

const UNIVERSE_STYLE: Record<string, string> = {
  sakura:
    "lycée japonais au printemps, cerisiers en fleurs, lumière douce d'après-midi, tons rose pâle et bleu ciel",
  scene:
    'salle de concert moderne, projecteurs colorés, ambiance scintillante fuchsia et bleu électrique, atmosphère de coulisses',
  royaumes:
    'château de conte de fées européen, dorures, lustres, lumière chaude de chandelles, tons bordeaux et or',
}

// DA maison — volontairement UNE seule définition partagée pour que toutes les
// créations (de tous les enfants) restent cohérentes entre elles.
// Registre : otome moderne, semi-réaliste (plus mûr et soigné que « chibi »),
// tout en gardant chaleur et douceur adaptées à une jeune joueuse.
const STYLE_BASE =
  'style anime otome moderne, semi-réaliste, proportions naturelles (surtout pas chibi ni bébé), belle peinture numérique soignée façon visual novel de qualité, cel-shading doux, traits fins, lumière douce et chaleureuse, couleurs riches et harmonieuses, rendu élégant et détaillé'

/** Palette de carnations proposée à la joueuse (contrôle du prompt IA).
 *  `en` = version anglaise envoyée au modèle (z-image-turbo est aligné EN/中文,
 *  les attributs en anglais sont bien mieux respectés que le français). */
export const AI_SKIN_TONES: { id: string; hex: string; label: string; prompt: string; en: string }[] = [
  { id: 'tresclair', hex: '#ffe0c4', label: 'Très clair', prompt: 'peau très claire', en: 'very fair skin' },
  { id: 'clair', hex: '#f3c9a2', label: 'Clair', prompt: 'peau claire', en: 'fair skin' },
  { id: 'dore', hex: '#e0aa7e', label: 'Doré', prompt: 'peau dorée', en: 'golden tan skin' },
  { id: 'hale', hex: '#c68a5e', label: 'Hâlé', prompt: 'peau légèrement hâlée', en: 'lightly tanned skin' },
  { id: 'brun', hex: '#9c6b45', label: 'Brun', prompt: 'peau brune', en: 'brown skin' },
  { id: 'fonce', hex: '#6d4327', label: 'Foncé', prompt: 'peau foncée', en: 'dark brown skin' },
]

/** Tranches d'âge proposées à la joueuse (toutes des mineur·es, contenu adapté). */
export const AI_AGES: { id: string; label: string; prompt: string; en: string }[] = [
  { id: 'enfant', label: 'Enfant', prompt: 'âgé·e d’environ 8 ans', en: 'around 8 years old, child' },
  { id: 'preado', label: 'Pré-ado', prompt: 'âgé·e d’environ 11 ans', en: 'around 11 years old, preteen' },
  { id: 'ado', label: 'Ado', prompt: 'âgé·e d’environ 14 ans', en: 'around 14 years old, teenager' },
  { id: 'grandado', label: 'Grand ado', prompt: 'âgé·e d’environ 16 ans', en: 'around 16 years old, teenager' },
]

/** Taille/stature du personnage (pour le portrait, différent de la taille en scène). */
export const AI_HEIGHTS: { id: string; label: string; prompt: string; en: string }[] = [
  { id: 'petit', label: 'Petit·e', prompt: 'de petite taille', en: 'short stature' },
  { id: 'moyen', label: 'Moyen·ne', prompt: 'de taille moyenne', en: 'average height' },
  { id: 'grand', label: 'Grand·e', prompt: 'grand·e et élancé·e', en: 'tall and slender' },
]

/**
 * Intérieur/extérieur : le style d'univers (ex. cerisiers en fleurs pour sakura)
 * pousse l'IA vers l'extérieur même quand la joueuse demande explicitement un
 * lieu intérieur — on renforce donc le prompt (recto ET fin).
 */
const SETTING_HINTS: { match: RegExp; positive: string; negative: string }[] = [
  {
    match: /\bint[ée]rieur\b|\bdedans\b/i,
    positive: 'scène en INTÉRIEUR : à l’intérieur d’un bâtiment ou d’une pièce, murs et/ou plafond visibles',
    negative: 'extérieur, plein air, ciel, jardin, cour, rue, paysage extérieur',
  },
  {
    match: /\bext[ée]rieur\b|\bdehors\b/i,
    positive: 'scène en EXTÉRIEUR : en plein air, ciel visible',
    negative: 'intérieur, pièce fermée, plafond',
  },
]

function settingHint(userPrompt: string): { positive: string; negative: string } | null {
  return SETTING_HINTS.find((e) => e.match.test(userPrompt)) ?? null
}

/** Couleurs d'yeux : petites en cadrage en pied → toujours décrites richement
 *  (en anglais) dans la tête d'identité, même sans être renforcées. */
const EYE_TAGS = new Set(['yeux verts', 'yeux bleus', 'yeux noisette', 'yeux violets'])

/** Tuiles « Tenue » : si AUCUNE n'est choisie, on impose une tenue par défaut.
 *  SÉCURITÉ CRITIQUE : sans vêtement explicite, les modèles anime dérivent vers
 *  la nudité/pin-up — inacceptable dans une app pour enfant. */
const OUTFIT_TAGS = new Set([
  'uniforme marin', 'uniforme gakuran', 'blazer scolaire', 'tenue décontractée', 'robe étoilée',
  'look de pop star', 'veste de scène rock', 'robe de bal', 'tenue princière', 'tenue d’aventure',
])

/** Traduction FR→EN des tuiles d'identité (photomaton). z-image-turbo respecte
 *  bien mieux l'anglais : on garde le français à l'écran, on envoie l'anglais au
 *  modèle. Une tuile absente de cette table retombe sur son texte français. */
const CHIP_EN: Record<string, string> = {
  // cheveux (couleur)
  'cheveux roux': 'ginger red hair', 'cheveux blonds': 'blonde hair', 'cheveux bruns': 'brown hair',
  'cheveux noirs': 'black hair', 'cheveux roses': 'pink hair', 'cheveux bleus': 'blue hair',
  'cheveux violets': 'purple hair', 'cheveux argentés': 'silver hair',
  // coiffure
  'cheveux bouclés': 'curly hair', 'cheveux raides': 'straight hair', 'longs cheveux': 'long hair',
  'cheveux courts': 'short hair', couettes: 'twin pigtails', 'queue de cheval': 'ponytail',
  frange: 'bangs', chignon: 'hair bun',
  // yeux
  'yeux verts': 'green eyes', 'yeux bleus': 'blue eyes', 'yeux noisette': 'hazel eyes',
  'yeux violets': 'violet eyes', 'grands yeux': 'big expressive eyes',
  // détails
  'des taches de rousseur': 'freckles', 'des lunettes': 'glasses', 'un grain de beauté': 'a beauty mark',
  'des boucles d’oreilles': 'earrings',
  // tenue
  'uniforme marin': 'sailor school uniform (seifuku)', 'uniforme gakuran': 'gakuran school uniform',
  'blazer scolaire': 'school blazer uniform', 'tenue décontractée': 'casual outfit',
  'robe étoilée': 'starry dress', 'look de pop star': 'pop star stage outfit',
  'veste de scène rock': 'rock stage jacket', 'robe de bal': 'ball gown',
  'tenue princière': 'princely royal outfit', 'tenue d’aventure': 'adventurer outfit',
  // accessoires
  'un ruban': 'a hair ribbon', 'un serre-tête': 'a headband', 'un chapeau': 'a hat',
  'un foulard': 'a scarf', 'une fleur dans les cheveux': 'a flower in the hair', 'des écouteurs': 'headphones',
  // chaussures
  bottes: 'boots', sandales: 'sandals', tongs: 'flip-flops', 'pieds nus': 'barefoot',
  baskets: 'sneakers', mocassins: 'loafers', 'chaussures à talons': 'high heels', ballerines: 'ballet flats',
  // air / expression
  'souriant·e': 'smiling warmly', timide: 'shy expression', 'rieur·se': 'cheerful laughing expression',
  'sérieux·se': 'serious expression', espiègle: 'mischievous expression', 'doux·ce': 'gentle expression',
  'mystérieux·se': 'mysterious expression',
}

/** Descripteurs riches et redondants pour un trait RENFORCÉ : la seule emphase qui
 *  marche sur z-image-turbo (pas de syntaxe de pondération). 2-3 formulations qui se
 *  chevauchent. Trait absent → on répète simplement sa version anglaise. */
const REINFORCE_EN: Record<string, string> = {
  'yeux bleus': 'bright sky-blue eyes, clear vivid blue irises',
  'yeux verts': 'bright emerald-green eyes, vivid green irises',
  'yeux noisette': 'warm hazel eyes, golden-brown irises',
  'yeux violets': 'striking violet eyes, vivid purple irises',
  'cheveux roux': 'vivid coppery ginger-red hair',
  'cheveux blonds': 'bright golden blonde hair',
  'cheveux roses': 'vivid pastel pink hair',
  'cheveux bleus': 'vivid blue hair',
  'cheveux violets': 'vivid purple hair',
  'cheveux argentés': 'shiny silver-white hair',
}

/** Traduit une tuile FR en anglais pour le modèle (repli : la tuile française). */
function chipEN(w: string): string {
  return CHIP_EN[w] ?? w
}

// ------------------------------------------------------ variété (cadre safe)
// Une même description regénérée doit donner une photo SENSIBLEMENT différente
// (sentiment de richesse) tout en CONSERVANT l'identité choisie (tuiles) et le
// cadre 10+ : on ne fait varier que des axes anodins — pose debout, angle,
// petit geste de vie — choisis DÉTERMINISTIQUEMENT par la graine. Même graine
// (retouche « garde la base ») → même pose ; nouvelle graine → nouvelle pose.
const VARIETY_POSES = [
  'standing straight with both arms relaxed at the sides',
  'standing with one hand on the hip, confident and friendly',
  'standing with hands clasped behind the back',
  'standing and cheerfully waving hello with one hand',
  'standing with arms gently crossed, warm look',
  'standing with one hand adjusting a strand of hair',
  'standing holding a small closed book against the chest',
  'standing mid-step as if walking happily towards the viewer',
]
const VARIETY_VIEWS = [
  'facing the viewer directly',
  'in a very slight three-quarter view, face clearly turned towards the viewer',
]
const VARIETY_LIFE = [
  'hair moving gently as in a light breeze',
  'a natural relaxed posture full of personality',
  'a lively spark in the expression',
  'a subtle joyful energy in the stance',
]

/** PRNG déterministe (mulberry32) : la variété est reproductible par graine. */
function seededRng(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function varietyClause(seed: number): string {
  const rnd = seededRng(seed)
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]
  return `Pose: ${pick(VARIETY_POSES)}, ${pick(VARIETY_VIEWS)}, ${pick(VARIETY_LIFE)}. `
}

export interface PortraitOpts {
  ambiance?: string
  gender?: 'fille' | 'garcon'
  skin?: string
  age?: string
  height?: string
  /** traits d'autres personnages à EXCLURE (inverse-prompt) pour se différencier */
  avoid?: string
  /** graine fixe : garder la même base entre deux générations (retouches) */
  seed?: number
  /** génération offerte (FTUE) : ne consomme pas le quota du jour et ne bloque jamais */
  free?: boolean
  /** tuiles d'identité sélectionnées (FR) — traduites en EN et mises EN TÊTE du prompt */
  tags?: string[]
  /** sous-ensemble de `tags` à renforcer (répété/emphase descriptive dans le prompt) */
  reinforced?: string[]
}

/** Ambiances proposées à la joueuse (contrôle du rendu IA). */
export const AMBIANCES: { id: string; label: string; emoji: string; prompt: string }[] = [
  { id: 'doux', label: 'Doux', emoji: '🌸', prompt: 'ambiance douce et pastel, lumière tendre du matin' },
  { id: 'lumineux', label: 'Lumineux', emoji: '☀️', prompt: 'couleurs vives et lumineuses, plein soleil éclatant' },
  { id: 'feerique', label: 'Féerique', emoji: '✨', prompt: 'ambiance féerique et scintillante, touches de magie et particules lumineuses' },
  { id: 'crepuscule', label: 'Crépuscule', emoji: '🌇', prompt: 'lumière chaude de coucher de soleil, tons dorés et roses' },
]

function ambianceText(ambiance?: string): string {
  const a = AMBIANCES.find((x) => x.id === ambiance)
  return a ? `${a.prompt}. ` : ''
}

function bgPrompt(userPrompt: string, universe: string, ambiance?: string): string {
  const setting = settingHint(userPrompt)
  const settingClause = setting
    ? `TRÈS IMPORTANT — LIEU : ${setting.positive}, quels que soient les éléments d'ambiance de l'univers ci-dessus. Évite absolument : ${setting.negative}. `
    : ''
  return (
    `Illustration de décor pour un visual novel, ${STYLE_BASE}. ` +
    `Univers : ${UNIVERSE_STYLE[universe] ?? UNIVERSE_STYLE.sakura}. ` +
    ambianceText(ambiance) +
    settingClause +
    `Scène demandée : ${userPrompt}. ` +
    `IMPORTANT : aucun personnage, aucun humain, aucun texte, aucun logo. Cadrage large 16:9, ` +
    `adapté à un public de 10-14 ans, atmosphère poétique.` +
    (setting ? ` Rappel final : ${setting.positive}.` : '')
  )
}

function portraitPrompt(descr: string, opts: PortraitOpts = {}, seed?: number): string {
  // ── Tête d'identité EN ANGLAIS, FRONT-LOADÉE ────────────────────────────────
  // z-image-turbo tourne à CFG≈0 en ~8 étapes : il pondère surtout les 1ers tokens
  // et est aligné anglais/中文. On met donc l'identité (genre, âge, carnation, tuiles)
  // EN ANGLAIS et EN TÊTE. Le negative_prompt étant un no-op côté LiberTai, les
  // exclusions sont reformulées en affirmations positives.
  const genderEN = opts.gender === 'garcon' ? 'a boy' : opts.gender === 'fille' ? 'a girl' : 'a young character'
  const skinEN = AI_SKIN_TONES.find((s) => s.id === opts.skin)?.en ?? ''
  const ageEN = AI_AGES.find((a) => a.id === opts.age)?.en ?? ''
  const heightEN = AI_HEIGHTS.find((h) => h.id === opts.height)?.en ?? ''

  const reinforced = (opts.reinforced ?? []).filter(Boolean)
  const tagWords = (opts.tags ?? []).filter(Boolean)
  // ordre des tokens = poids pour z-image-turbo : renforcées d'abord, puis les
  // YEUX (trait le plus raté en cadrage en pied — cf. remontées « yeux bleus »),
  // puis le reste
  const weight = (t: string) => (reinforced.includes(t) ? 0 : EYE_TAGS.has(t) ? 1 : 2)
  const orderedTags = [...tagWords].sort((a, b) => weight(a) - weight(b))
  // les couleurs d'yeux (petites en cadrage en pied) sont TOUJOURS décrites richement
  const tagsEN = orderedTags.map((t) => (EYE_TAGS.has(t) && REINFORCE_EN[t] ? REINFORCE_EN[t] : chipEN(t)))

  // SÉCURITÉ : garantir une tenue. Sans vêtement explicite, les modèles anime
  // dérivent vers la nudité → on impose une tenue modeste par défaut si aucune
  // tuile « Tenue » n'est choisie.
  const hasOutfit = tagWords.some((t) => OUTFIT_TAGS.has(t))
  const defaultOutfit = hasOutfit ? '' : 'fully dressed in a modest everyday outfit (a simple loose t-shirt and long trousers)'

  const identity = [genderEN, ageEN, heightEN, skinEN, ...tagsEN, defaultOutfit].filter(Boolean).join(', ')

  // Emphase du/des trait(s) renforcé(s) : 2-3 descripteurs qui se chevauchent
  // (seule emphase efficace sur ce modèle — pas de syntaxe de pondération).
  // Les couleurs d'yeux choisies sont TOUJOURS ajoutées à l'emphase, étoilées ou
  // non : c'est le trait le plus souvent perdu par le modèle.
  const eyeChoices = tagWords.filter((t) => EYE_TAGS.has(t) && !reinforced.includes(t))
  const emphasized = [...reinforced.slice(0, 3), ...eyeChoices]
  const emphasis = emphasized
    .map((t) => REINFORCE_EN[t] ?? `${chipEN(t)}, clearly visible ${chipEN(t)}`)
    .join('; ')
  const emphasisClause = emphasis ? `Make these traits especially clear, accurate and prominent: ${emphasis}. ` : ''
  // regard caméra : force la couleur d'yeux à être réellement peinte et visible
  const eyeTag = tagWords.find((t) => EYE_TAGS.has(t))
  const gazeClause = eyeTag ? `The character looks straight at the viewer, with ${REINFORCE_EN[eyeTag] ?? chipEN(eyeTag)} clearly visible. ` : ''

  // Texte libre saisi par l'enfant (souvent FR) : priorité basse, après l'identité.
  const free = descr && descr.trim() ? `${descr.trim()}. ` : ''
  const avoidClause = opts.avoid ? `Make this character clearly different from others: avoid ${opts.avoid}. ` : ''

  // Clause de sécurité SFW, EN TÊTE (le negative_prompt est ignoré côté LiberTai,
  // donc l'anti-nudité DOIT être affirmé, tôt et fortement, dans le positif).
  const safety =
    `STRICTLY safe-for-work and appropriate for young children: the character is FULLY CLOTHED in complete, ` +
    `modest clothing that fully covers the torso, chest, belly and legs; decent, wholesome, innocent, G-rated. ` +
    `Absolutely NO nudity, no partial nudity, no underwear, no lingerie, no swimwear, no bare chest, no cleavage, ` +
    `no exposed skin other than face, neck and hands; not sexualized, not suggestive, non-revealing clothing, ` +
    `childlike proportions, wholesome children's cartoon. `

  return (
    // 1) sujet + garanties de sécurité + identité EN, front-loadés
    `Wholesome, fully-clothed, safe-for-work full-body anime otome illustration of exactly ONE single character, ` +
    `solo, one face, standing, whole body in frame. ` +
    safety +
    `Character: ${identity}. ` +
    emphasisClause +
    gazeClause +
    // variété seedée (pose/angle/geste) : sensiblement différent à chaque graine,
    // identité et cadre safe inchangés
    (seed != null ? varietyClause(seed) : '') +
    free +
    avoidClause +
    // 2) style maison (FR conservé) + ambiance
    `${STYLE_BASE}. ` +
    ambianceText(opts.ambiance) +
    // 3) exclusions reformulées en positif (le negative_prompt est ignoré côté LiberTai)
    `Full body visible from head to toe, both feet and shoes fully inside the frame, not cropped, centered composition, ` +
    `camera far enough that the figure fills about 90% of the image height, with clear empty margin above the head and below the feet. ` +
    `Plain neutral studio background (white or transparent), no scenery, no furniture, no floor shadow ` +
    `(the character will be cut out and placed on different backgrounds). ` +
    `Soft warm lighting, sharp focus, clean lineart, correct anatomy, one character only, one face, no text, no logo, no watermark. ` +
    // 4) rappel sécurité en fin (l'IA image pondère aussi le texte de fin)
    `Reminder: fully clothed, modest, decent, no nudity, child-appropriate. ` +
    `${ageEN ? '' : 'jeune, '}entièrement habillé·e et pudique, sans aucun contenu inapproprié, adapté à un public d'enfants de 10-14 ans.`
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

export async function generateBackground(userPrompt: string, universe: string, ambiance?: string, free = false): Promise<Blob> {
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
export async function generateCharacterPortrait(descr: string, _universe: string, opts: PortraitOpts = {}): Promise<Blob> {
  if (!AI_PORTRAITS_ENABLED) throw new AIError('Les portraits magiques sont en pause. Utilise l’avatar à dessiner.')
  const config = getAIConfig()
  if (!config) throw new AIError('Aucune clé configurée dans l’Espace parents.')
  // une description de personnage est légitimement plus longue qu'un prompt de tenue
  const problem = moderatePrompt(descr, 220)
  if (problem) throw new AIError(problem)
  // NB : côté LiberTai le negative_prompt n'est pas transmis au pipeline (no-op) —
  // gardé par parité de schéma + utile côté Google. La sécurité anti-nudité est
  // AUSSI affirmée en positif dans portraitPrompt, ET vérifiée côté sortie ci-dessous.
  const negative = [
    // sécurité en premier
    'nsfw, nude, nudity, naked, topless, bare chest, exposed breasts, nipples, cleavage, underwear, lingerie, panties, swimsuit, bikini, sexualized, suggestive, revealing clothing, seductive pose, nu, nudité, seins nus, sous-vêtements, maillot de bain, torse nu, décolleté, pin-up',
    'texte, logo, filigrane, flou, difforme, deux personnages, plusieurs visages, pieds coupés, jambes coupées, cadrage serré, buste seul',
    opts.avoid,
  ]
    .filter(Boolean)
    .join(', ')

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
  let flagged = false
  let cropped = false
  let backup: Blob | null = null
  const accept = (blob: Blob): Blob => {
    if (!opts.free) bumpUsage('image') // on ne facture que les images sûres et retenues
    return blob
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const seed = attempt === 0 ? baseSeed : Math.floor(Math.random() * 1_000_000_000)
    let prompt = portraitPrompt(descr, opts, seed)
    // essai après signalement : pudeur maximale (on contraint la coupe de la
    // tenue choisie, pas la tenue elle-même)
    if (flagged)
      prompt +=
        ` The outfit is strictly modest: high neckline, covered shoulders, long opaque fabric fully ` +
        `covering the chest, torso, belly and hips, absolutely no skin visible between neck and knees.`
    if (cropped) prompt += ` Zoom out further: the ENTIRE figure with shoes and clear empty space below the feet must fit inside the frame.`
    const blob =
      config.provider === 'libertai'
        ? await libertaiImageRaw(config, prompt, 768, 1152, { negativePrompt: negative, seed, removeBackground: true })
        : await googleImage(config, prompt, '9:16', seed)
    const verdict = await moderateImageBlob(blob, config)
    if (!verdict.safe) {
      flagged = true
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
  // 3 images signalées d'affilée : on refuse plutôt que de montrer quoi que ce soit.
  throw new AIError(
    flagged
      ? 'Oups, cette photo n’était pas comme il faut. 🌸 Change un peu le style (tenue, ambiance) et réessaie.'
      : 'La magie a raté, réessaie.',
  )
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
  return getAIConfig() !== null
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
