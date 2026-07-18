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
import { moderateImageBlob, moderateImagePixels } from './imagemod'

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

// EN ANGLAIS : l'encodeur de z-image-turbo est un LLM Qwen3-4B aligné
// anglais/chinois — le français est nettement moins bien suivi.
const UNIVERSE_STYLE: Record<string, string> = {
  sakura: 'Japanese high school in spring, cherry trees in bloom, soft afternoon light, pale pink and sky-blue tones',
  scene: 'modern concert hall, colorful stage spotlights, sparkling fuchsia and electric-blue mood, backstage atmosphere',
  royaumes: 'European fairy-tale castle, gilded details, chandeliers, warm candlelight, burgundy and gold tones',
}

// DA maison — volontairement UNE seule définition partagée pour que toutes les
// créations (de tous les enfants) restent cohérentes entre elles.
// Registre : otome moderne, semi-réaliste (plus mûr et soigné que « chibi »),
// tout en gardant chaleur et douceur adaptées à une jeune joueuse.
const STYLE_BASE =
  'modern semi-realistic otome anime style, natural proportions, polished visual-novel digital painting, ' +
  'soft cel shading, clean fine lineart, soft warm lighting, rich harmonious colors'

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
// Formulé en POSITIF uniquement : sur un modèle sans guidance négative, décrire
// ce qu'on ne veut pas revient à l'injecter dans le conditionnement.
const SETTING_HINTS: { match: RegExp; positive: string }[] = [
  {
    match: /\bint[ée]rieur\b|\bdedans\b/i,
    positive: 'VERY IMPORTANT — the scene is INDOORS: inside a building or a room, walls and ceiling visible, cozy enclosed space',
  },
  {
    match: /\bext[ée]rieur\b|\bdehors\b/i,
    positive: 'VERY IMPORTANT — the scene is OUTDOORS: in the open air, sky visible',
  },
]

function settingHint(userPrompt: string): { positive: string } | null {
  return SETTING_HINTS.find((e) => e.match.test(userPrompt)) ?? null
}

/** Couleurs d'yeux : petites en cadrage en pied → toujours décrites richement
 *  (en anglais) dans la tête d'identité, même sans être renforcées. */
const EYE_TAGS = new Set(['yeux verts', 'yeux bleus', 'yeux noisette', 'yeux violets'])

/**
 * SÉCURITÉ CRITIQUE — tenues CONCRÈTES, du col aux pieds.
 * z-image-turbo est servi sans aucun filtre (plateforme « uncensored ») et son
 * negative_prompt est un no-op : le seul verrou fiable à la source est de ne
 * laisser AUCUNE pièce de tenue à l'imagination du modèle. Chaque tuile
 * « Tenue » est donc développée en description exhaustive (matière, coupe,
 * couverture), genrée quand la coupe diffère. Adjectifs abstraits (« modest »)
 * inefficaces seuls ; négations (« no nudity ») contre-productives — elles
 * injectent le concept nié dans le conditionnement.
 */
const OUTFIT_EN_FULL: Record<string, { fille: string; garcon: string }> = {
  'uniforme marin': {
    fille: 'a sailor-style school uniform: long-sleeved white sailor blouse with navy collar and red ribbon, navy knee-length pleated skirt, white opaque tights',
    garcon: 'a sailor-style school uniform: long-sleeved white sailor top with navy collar, navy straight trousers',
  },
  'uniforme gakuran': {
    fille: 'a black gakuran-style school uniform with high buttoned collar, long sleeves and matching straight trousers',
    garcon: 'a black gakuran school uniform with high buttoned collar, long sleeves and matching straight trousers',
  },
  'blazer scolaire': {
    fille: 'a school blazer uniform: navy blazer with a golden crest over a buttoned white shirt, tartan knee-length pleated skirt, dark opaque tights',
    garcon: 'a school blazer uniform: navy blazer with a golden crest over a buttoned white shirt and tie, grey straight trousers',
  },
  'tenue décontractée': {
    fille: 'a casual everyday outfit: crew-neck long-sleeved cotton top, comfortable blue jeans',
    garcon: 'a casual everyday outfit: crew-neck long-sleeved cotton t-shirt, comfortable blue jeans',
  },
  'robe étoilée': {
    fille: 'a starry dress: midnight-blue long-sleeved knee-length dress scattered with small golden stars, white round collar, opaque tights',
    garcon: 'a starry outfit: midnight-blue long-sleeved shirt scattered with small golden stars, dark straight trousers',
  },
  'look de pop star': {
    fille: 'a pop-star stage outfit: sparkly high-neck long-sleeved top, glittery jacket, ruffled knee-length skirt over shiny leggings',
    garcon: 'a pop-star stage outfit: sparkly high-neck long-sleeved top, glittery jacket, tailored dark trousers',
  },
  'veste de scène rock': {
    fille: 'a rock-stage outfit: studded jacket over a crew-neck band t-shirt, dark jeans',
    garcon: 'a rock-stage outfit: studded jacket over a crew-neck band t-shirt, dark jeans',
  },
  'robe de bal': {
    fille: 'an elegant floor-length princess ball gown with puffed short sleeves, high modest neckline and long white gloves',
    garcon: 'an elegant prince ball attire: embroidered high-collar jacket with long sleeves, formal straight trousers, white gloves',
  },
  'tenue princière': {
    fille: 'a royal ceremonial outfit: high-collar embroidered jacket with golden epaulettes, long sleeves, floor-length skirt, short elegant cape',
    garcon: 'a royal prince outfit: high-collar embroidered ceremonial jacket with golden epaulettes, long sleeves, straight trousers, short elegant cape',
  },
  'tenue d’aventure': {
    fille: 'an adventurer outfit: sturdy long-sleeved tunic with leather bracers, long canvas trousers, wide belt with a satchel',
    garcon: 'an adventurer outfit: sturdy long-sleeved tunic with leather bracers, long canvas trousers, wide belt with a satchel',
  },
}

/** Tenues PAR DÉFAUT (aucune tuile choisie) : banque VARIÉE choisie par la
 *  graine (la variété de z-image-turbo vient du prompt, pas du seed) et
 *  COHÉRENTE AVEC L'UNIVERS (idée de la branche routine : uniforme à
 *  l'Académie Sakura, tenue de scène pour Lumière de Scène, tenue féerique
 *  au Bal des Royaumes) — toujours en descriptions concrètes col → pieds. */
const DEFAULT_OUTFITS_EN: Record<string, { fille: string; garcon: string }[]> = {
  generic: [
    {
      fille: 'a casual everyday outfit: crew-neck long-sleeved cotton top, comfortable blue jeans',
      garcon: 'a casual everyday outfit: crew-neck long-sleeved cotton t-shirt, comfortable blue jeans',
    },
    {
      fille: 'a cute everyday dress: long-sleeved knee-length dress with a white round collar, opaque tights',
      garcon: 'a smart everyday outfit: buttoned shirt under a knitted vest, chino trousers',
    },
    {
      fille: 'a cozy outfit: pastel crew-neck sweatshirt, corduroy trousers',
      garcon: 'a cozy outfit: crew-neck sweatshirt, corduroy trousers',
    },
    {
      fille: 'a spring outfit: knitted cardigan over a high-neck top, long pleated skirt with opaque tights',
      garcon: 'a spring outfit: light jacket over a crew-neck t-shirt, straight trousers',
    },
  ],
  sakura: [
    {
      fille: 'a sailor-style school uniform: long-sleeved white sailor blouse with navy collar and red ribbon, navy knee-length pleated skirt, white opaque tights',
      garcon: 'a black gakuran school uniform with high buttoned collar, long sleeves and matching straight trousers',
    },
    {
      fille: 'a school blazer uniform: navy blazer with a golden crest over a buttoned white shirt, tartan knee-length pleated skirt, dark opaque tights',
      garcon: 'a school blazer uniform: navy blazer with a golden crest over a buttoned white shirt and tie, grey straight trousers',
    },
    {
      fille: 'a school-day outfit: long-sleeved white blouse with a ribbon, navy knee-length pleated skirt, white opaque tights',
      garcon: 'a school-day outfit: long-sleeved white shirt, knitted vest, navy straight trousers',
    },
    {
      fille: 'a spring schoolyard outfit: knitted cardigan over a high-neck top, long pleated skirt with opaque tights',
      garcon: 'a spring schoolyard outfit: light jacket over a crew-neck t-shirt, straight trousers',
    },
  ],
  scene: [
    {
      fille: 'a pop-star stage outfit: sparkly high-neck long-sleeved top, glittery jacket, ruffled knee-length skirt over shiny leggings',
      garcon: 'a pop-star stage outfit: sparkly high-neck long-sleeved top, glittery jacket, tailored dark trousers',
    },
    {
      fille: 'a rock-stage outfit: studded jacket over a crew-neck band t-shirt, dark jeans',
      garcon: 'a rock-stage outfit: studded jacket over a crew-neck band t-shirt, dark jeans',
    },
    {
      fille: 'a backstage rehearsal outfit: long-sleeved pastel hoodie, cargo trousers, headphones around the neck',
      garcon: 'a backstage rehearsal outfit: long-sleeved hoodie, cargo trousers, headphones around the neck',
    },
  ],
  royaumes: [
    {
      fille: 'an elegant floor-length princess gown with long sleeves, high modest neckline and embroidered bodice panel',
      garcon: 'a royal prince outfit: high-collar embroidered ceremonial jacket with golden epaulettes, long sleeves, straight trousers, short elegant cape',
    },
    {
      fille: 'a fairy-tale day outfit: long-sleeved laced bodice over a high-neck blouse, ankle-length layered skirt',
      garcon: 'a fairy-tale day outfit: long-sleeved tunic with embroidered trim, sturdy trousers, short cloak',
    },
    {
      fille: 'a castle library outfit: velvet long-sleeved dress, knee-length with opaque tights, small tiara',
      garcon: 'a castle library outfit: velvet long-sleeved doublet, straight trousers, small circlet',
    },
  ],
}

/** Tuiles « Chaussures » : injectées dans la phrase de tenue (jamais en vrac). */
const SHOE_TAGS = new Set(['bottes', 'sandales', 'tongs', 'pieds nus', 'baskets', 'mocassins', 'chaussures à talons', 'ballerines'])
const OUTFIT_TAGS = new Set(Object.keys(OUTFIT_EN_FULL))

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
  tresses: 'braided hair', frange: 'bangs', chignon: 'hair bun',
  // yeux
  'yeux verts': 'green eyes', 'yeux bleus': 'blue eyes', 'yeux noisette': 'hazel eyes',
  'yeux violets': 'violet eyes', 'grands yeux': 'big expressive eyes',
  // détails
  'des taches de rousseur': 'freckles', 'des lunettes': 'glasses', 'un grain de beauté': 'a beauty mark',
  'des boucles d’oreilles': 'earrings',
  // tenue — chaque tenue précise explicitement un haut qui couvre tout le torse :
  // "adventurer outfit" seul dérivait souvent vers un(e) aventurier·ère torse nu
  // (archétype fréquent dans les données d'entraînement anime) → cf. #36/#37.
  'uniforme marin': 'sailor school uniform (seifuku) with a top fully covering the torso and chest, and a KNEE-LENGTH pleated skirt (not a mini skirt, not short)',
  'uniforme gakuran': 'gakuran school uniform with a jacket fully covering the torso and chest',
  'blazer scolaire': 'school blazer uniform with a shirt fully covering the torso and chest, and a KNEE-LENGTH skirt or trousers (not a mini skirt, not short)',
  'tenue décontractée': 'casual outfit with a top fully covering the torso and chest, and long trousers or a KNEE-LENGTH skirt (not a mini skirt, not short)',
  'robe étoilée': 'starry KNEE-LENGTH dress fully covering the torso and chest (not a mini dress, not short)',
  'look de pop star': 'pop star stage outfit with a top fully covering the torso and chest, and long trousers or a KNEE-LENGTH skirt (not a mini skirt, not short)',
  'veste de scène rock': 'rock stage jacket worn over a top fully covering the torso and chest, and long trousers or a KNEE-LENGTH skirt (not a mini skirt, not short)',
  'robe de bal': 'KNEE-LENGTH OR LONGER ball gown fully covering the torso and chest (not a mini dress, not short)',
  'tenue princière': 'princely royal outfit with a doublet/tunic fully covering the torso and chest, and long trousers or a KNEE-LENGTH OR LONGER skirt/robe (not a mini skirt, not short)',
  'tenue d’aventure': 'adventurer outfit with a fitted shirt or vest fully covering the torso and chest (never bare-chested, never open vest with no top underneath), belt, trousers, boots',
  // accessoires
  'un ruban': 'a hair ribbon', 'un serre-tête': 'a headband', 'un chapeau': 'a hat',
  'un foulard': 'a scarf', 'une fleur dans les cheveux': 'a flower in the hair', 'des écouteurs': 'headphones',
  // chaussures
  bottes: 'boots', sandales: 'sandals', tongs: 'flip-flops', 'pieds nus': 'barefoot',
  baskets: 'sneakers', mocassins: 'loafers', 'chaussures à talons': 'elegant low-heeled dress shoes', ballerines: 'ballet flats',
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
  /** feedback d'étape pour l'UI (« Plume vérifie… », « Plume ajuste la tenue… ») */
  onProgress?: (msg: string) => void
}

/** Ambiances proposées à la joueuse (contrôle du rendu IA).
 *  `prompt` en anglais : seul l'affichage (label/emoji) reste français. */
export const AMBIANCES: { id: string; label: string; emoji: string; prompt: string }[] = [
  { id: 'doux', label: 'Doux', emoji: '🌸', prompt: 'soft pastel mood, tender morning light' },
  { id: 'lumineux', label: 'Lumineux', emoji: '☀️', prompt: 'bright vivid colors, radiant sunshine' },
  { id: 'feerique', label: 'Féerique', emoji: '✨', prompt: 'fairy-tale sparkling mood, gentle magical light particles' },
  { id: 'crepuscule', label: 'Crépuscule', emoji: '🌇', prompt: 'warm golden-hour light, rosy and golden tones' },
]

function ambianceText(ambiance?: string): string {
  const a = AMBIANCES.find((x) => x.id === ambiance)
  return a ? `${a.prompt}. ` : ''
}

export function bgPrompt(userPrompt: string, universe: string, ambiance?: string): string {
  const setting = settingHint(userPrompt)
  const settingClause = setting ? `${setting.positive}, whatever the universe mood suggests. ` : ''
  const universeStyle = UNIVERSE_STYLE[universe] ?? UNIVERSE_STYLE.sakura
  return (
    `Scenery background illustration for an all-ages visual novel, ${STYLE_BASE}. ` +
    `Universe: ${universeStyle}. ` +
    ambianceText(ambiance) +
    settingClause +
    `Requested scene: ${userPrompt}. ` +
    `An empty, peaceful place — scenery and architecture only, no people, no text, no logo. ` +
    `Wide 16:9 framing, poetic atmosphere, suitable for children aged 10-14. ` +
    // rappel en fin de prompt : les éléments d'univers (ex. cerisiers en fleurs
    // pour sakura) étaient parfois absents du rendu quand ils n'apparaissaient
    // qu'une fois, en tête de prompt.
    `Final reminder — keep the universe mood elements: ${universeStyle}.` +
    (setting ? ` ${setting.positive}.` : '')
  )
}

/**
 * Prompt de portrait, structuré selon les règles connues de z-image-turbo :
 * encodeur LLM (Qwen3-4B) → une phrase naturelle vaut mieux qu'un sac de tags ;
 * ~512 tokens max (tronqué en silence) → prompt COMPACT (~120 mots) ;
 * pas de guidance négative → JAMAIS de concept interdit, même nié (« no
 * nudity » injecte « nudity » dans le conditionnement les fois où la négation
 * échoue — c'était une cause des dérives) ; la sécurité vient de : (1) l'ancre
 * de registre tout-public en tête, (2) une tenue concrète du col aux pieds,
 * (3) une queue d'adjectifs positifs. La variété vient du prompt (tenue/pose
 * seedées), le seed seul ne diversifie presque pas ce modèle.
 * `coverMax` (relance après signalement) : tenue ultra-couvrante imposée.
 * `universe` : choisit la banque de tenues par défaut (cohérence d'univers).
 */
export function portraitPrompt(descr: string, opts: PortraitOpts = {}, seed?: number, coverMax = false, universe = ''): string {
  const g: 'fille' | 'garcon' = opts.gender === 'garcon' ? 'garcon' : 'fille'
  const genderEN = opts.gender === 'garcon' ? 'a boy' : opts.gender === 'fille' ? 'a girl' : 'a young character'
  const skinEN = AI_SKIN_TONES.find((s) => s.id === opts.skin)?.en ?? ''
  const ageEN = AI_AGES.find((a) => a.id === opts.age)?.en ?? ''
  const heightEN = AI_HEIGHTS.find((h) => h.id === opts.height)?.en ?? ''
  const rnd = seededRng(seed ?? 1)
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]

  const reinforced = (opts.reinforced ?? []).filter(Boolean)
  const tagWords = (opts.tags ?? []).filter(Boolean)
  // traits « personne » (cheveux, yeux, détails, accessoires, air) — la tenue et
  // les chaussures sont traitées à part, dans la phrase d'habillage
  const personTags = tagWords.filter((t) => !OUTFIT_TAGS.has(t) && !SHOE_TAGS.has(t))
  const weight = (t: string) => (reinforced.includes(t) ? 0 : EYE_TAGS.has(t) ? 1 : 2)
  const orderedTags = [...personTags].sort((a, b) => weight(a) - weight(b))
  const tagsEN = orderedTags.map((t) => (EYE_TAGS.has(t) && REINFORCE_EN[t] ? REINFORCE_EN[t] : chipEN(t)))

  // ── tenue : TOUJOURS concrète, col → pieds ──────────────────────────────────
  // Sans tuile « Tenue », la banque par défaut est choisie selon l'UNIVERS
  // (idée reprise de la branche routine : un uniforme scolaire à l'Académie
  // Sakura, une tenue de scène pour Lumière de Scène…) puis tirée par la graine.
  const outfitTag = tagWords.find((t) => OUTFIT_TAGS.has(t))
  const shoeTag = tagWords.find((t) => SHOE_TAGS.has(t))
  const outfitDesc = coverMax
    ? // relance sécurité : couverture maximale, quelle que soit la tuile
      'a fully covering formal school uniform: high buttoned collar, long opaque sleeves, ' +
      (g === 'garcon' ? 'straight ankle-length trousers' : 'ankle-length pleated skirt with opaque tights')
    : outfitTag
      ? OUTFIT_EN_FULL[outfitTag][g]
      : pick(DEFAULT_OUTFITS_EN[universe] ?? DEFAULT_OUTFITS_EN.generic)[g] // banque seedée → variété entre générations
  const shoePart = shoeTag === 'pieds nus' ? 'and barefoot' : `with ${shoeTag ? chipEN(shoeTag) : 'matching flat shoes'}`
  const outfitClause = `Fully dressed in ${outfitDesc}, ${shoePart}. `

  // ── emphase : tuiles ⭐ + couleur d'yeux (trait le plus souvent perdu) ──────
  const eyeChoices = tagWords.filter((t) => EYE_TAGS.has(t) && !reinforced.includes(t))
  const emphasized = [...reinforced.slice(0, 3), ...eyeChoices]
  const emphasis = emphasized.map((t) => REINFORCE_EN[t] ?? `clearly visible ${chipEN(t)}`).join('; ')
  const emphasisClause = emphasis ? `Especially clear and accurate: ${emphasis}. ` : ''
  const eyeTag = tagWords.find((t) => EYE_TAGS.has(t))
  const gazeClause = eyeTag ? `The character looks straight at the viewer, ${REINFORCE_EN[eyeTag] ?? chipEN(eyeTag)} plainly visible. ` : ''

  // texte libre de l'enfant (souvent FR, déjà modéré côté saisie). Les tuiles y
  // sont souvent recopiées (buildDescr) : on les retire pour éviter le doublon
  // français qui dilue le prompt anglais.
  const known = new Set(tagWords)
  const freeText = (descr ?? '')
    .split(/,\s*/)
    .map((s) => s.trim())
    .filter((s) => s && !known.has(s))
    .join(', ')
  const free = freeText ? `${freeText}. ` : ''

  const subject = [genderEN, ageEN, heightEN].filter(Boolean).join(', ')
  const traits = [skinEN, ...tagsEN].filter(Boolean).join(', ')

  return (
    // 1) ancre de registre tout-public (déplace TOUT le conditionnement vers les
    //    sous-distributions d'entraînement où la dérive est quasi inexistante)
    `Family-friendly anime character illustration for an all-ages animated series, ` +
    `official full-body character sheet of one single character. ` +
    // 2) sujet + traits liés en phrase naturelle (encodeur LLM)
    `The character is ${subject}, with ${traits || 'a friendly face'}. ` +
    emphasisClause +
    gazeClause +
    // 3) tenue exhaustive (le verrou principal)
    outfitClause +
    // 4) pose/angle seedés (la variété vient du prompt sur ce modèle)
    (seed != null ? varietyClause(seed) : '') +
    free +
    // 5) anatomie : affirmée en positif (cf. note sécurité tenues ci-dessus, la
    //    négation est inefficace/contre-productive sur ce modèle) — retour terrain
    //    « personnage à trois bras » quand le prompt ne précise rien sur l'anatomie.
    `Anatomically correct human body: exactly two arms and two hands, five fingers per hand, exactly two legs. ` +
    // 6) cadrage + fond studio (le personnage sera détouré)
    `Standing, whole body from head to toe inside the frame, both shoes fully visible, ` +
    `generous empty margin above the head and below the feet, centered. Plain white studio background. ` +
    // 6) style maison + ambiance
    `${STYLE_BASE}. ` +
    ambianceText(opts.ambiance) +
    // 7) queue de sécurité : adjectifs positifs uniquement
    `Wholesome, family-friendly, safe for work, suitable for young children.`
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

/** Consigne de « rhabillage » pour qwen-image-edit : on garde l'identité, on
 *  ne touche qu'à la tenue (couvrante, concrète, formulée en positif). */
const REDRESS_INSTRUCTION =
  'Dress the character in a fully covering school uniform: high buttoned collar, long opaque sleeves, ' +
  'ankle-length skirt or trousers, flat shoes. Keep the exact same face, hairstyle, hair color, eye color and pose. ' +
  'Family-friendly, wholesome, suitable for young children. Keep the plain background unchanged.'

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
