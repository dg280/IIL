/**
 * CŒUR PUR de la construction des prompts d'images — aucune dépendance
 * navigateur : le MÊME code tourne dans le client (genai.ts) et dans l'Edge
 * Function Supabase (le prompt est construit CÔTÉ SERVEUR à partir de champs
 * structurés — le client ne peut pas injecter de prompt arbitraire).
 * Règles (docs/09, avis d'experts z-image-turbo) : langage naturel anglais,
 * ancre de registre tout-public en tête, tenue concrète col→pieds, JAMAIS de
 * concept interdit même nié (audité par scripts/check-prompts.mjs), variété
 * par le prompt (banques seedées), ~120-190 mots.
 */

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
  // Durcissement à la source : pas de palier « ~8 ans » pour les portraits IA
  // (les personnages d'otome sont des collégien·nes/lycéen·nes ; le paper-doll
  // dessiné couvre tous les âges). Conditionner un modèle d'image sur un âge
  // enfantin est le réglage le plus risqué qui soit — on le supprime.
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

export function videoPrompt(userPrompt: string, universe: string): string {
  return (
    `Plan d'ambiance cinématique pour un visual novel, style anime peint. ` +
    `Univers : ${UNIVERSE_STYLE[universe] ?? UNIVERSE_STYLE.sakura}. ${userPrompt}. ` +
    `Mouvement de caméra lent et doux, aucun personnage, aucun texte, adapté aux enfants.`
  )
}


/** Consigne de « rhabillage » pour qwen-image-edit : on garde l'identité, on
 *  ne touche qu'à la tenue (couvrante, concrète, formulée en positif). */
export const REDRESS_INSTRUCTION =
  'Dress the character in a fully covering school uniform: high buttoned collar, long opaque sleeves, ' +
  'ankle-length skirt or trousers, flat shoes. Keep the exact same face, hairstyle, hair color, eye color and pose. ' +
  'Family-friendly, wholesome, suitable for young children. Keep the plain background unchanged.'
