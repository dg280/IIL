/**
 * Garde-fou de contenu pour une app destinée à une enfant (~11 ans).
 *
 * Deux usages :
 *  - `moderatePrompt` filtre ce que l'enfant DEMANDE (prompts d'images/tenues/
 *    décors, intentions de scène) — renvoie un message doux façon Plume si bloqué.
 *  - `isCleanText` / `cleanLines` filtrent ce que l'IA RENVOIT (répliques,
 *    idées, scènes) avant de l'afficher : dernière barrière si le modèle dérape.
 *
 * On reste volontairement permissif sur le registre otome (amour, béguin,
 * bisou sur la joue, mariage) et strict sur violence, sexualité, auto-mutilation,
 * drogues. La liste n'est pas exhaustive — c'est un filet, pas une garantie ;
 * pour une mise en production publique, doubler d'une modération côté serveur.
 */

// Termes bloqués. Regroupés par thème pour rester lisibles et faciles à étendre.
// Attention aux collisions : « héroïne » (personnage) ≠ drogue → on ne bloque
// que « cocaïne/cannabis/drogue ». « mort » seul est permis (fin triste possible)
// mais les tournures violentes explicites sont bloquées.
const BLOCK_PATTERNS: RegExp[] = [
  // violence / armes
  /\b(sang|sanglant|saigne|ensanglant)/i,
  /\b(tuer|tue|tues|tuent|tué|tuée|meurtr|assassin|égorge|poignard|étrangl|torture|massacre)/i,
  /\b(arme[s]?\b|fusil|pistolet|revolver|flingue|mitraill|kalash|bombe|grenade|explos)/i,
  /\b(couteau|lame)\b.{0,20}\b(gorge|ventre|tuer|sang)/i,
  /\b(frappe|frapper|cogne|tabass|roue de coups|battre à mort)/i,
  /\b(guerre|génocide|attentat|terroris)/i,
  // sexualité
  /\b(sexe|sexuel|sexo|porno|pornograph|xxx|nudit|tout nu|toute nue|à poil)/i,
  /\bnu[es]?\b(?!age|ageux|ance|it)/i, // "nue/nus/nu" mais pas "nuage", "nuance"…
  /\b(sein[s]?\b|téton|fesse[s]?\b|string|lingerie|culotte|soutien-gorge|préservatif|capote)/i,
  /\b(viol|violée|violer|abus sexuel|pédo)/i,
  /\b(coucher avec|faire l['e ]amour|rapport sexuel|baiser)\b/i,
  // auto-mutilation / mal-être grave
  /\b(suicide|suicider|se pendre|se tuer|se mutil|se scarif|scarification|se couper les veines)/i,
  // drogues / addictions (héroïne-personnage exclue volontairement)
  /\b(drogue|cocaïne|cocaine|cannabis|héro[iï]ne\s+(dure|blanche)|shoot|overdose|se droguer)/i,
  /\b(alcool|bourré|bourrée|saoul|soûl|ivre morte?|cuite)\b/i,
  // grossièretés lourdes (les plus courantes)
  /\b(putain|salope|connard|encul|pd\b|nique|ta gueule|ferme ta)/i,
]

/**
 * Vérifie un prompt saisi par l'enfant. Renvoie un message doux si à corriger,
 * sinon null. Gère aussi longueur mini/maxi.
 */
export function moderatePrompt(prompt: string, maxLen = 120): string | null {
  const t = prompt.trim()
  if (t.length < 3) return 'Décris ton idée en quelques mots !'
  if (t.length > maxLen) return 'Oh là, ma plume est trop petite pour tout ça — raccourcis un peu !'
  if (BLOCK_PATTERNS.some((re) => re.test(t)))
    return 'Hmm, Plume préfère les histoires douces… essaie une autre idée !'
  return null
}

/** true si le texte (généré ou saisi) ne contient rien de bloqué. */
export function isCleanText(text: string): boolean {
  return !BLOCK_PATTERNS.some((re) => re.test(text))
}

/** Garde uniquement les propositions saines dans une liste (sorties IA). */
export function cleanList(items: string[]): string[] {
  return items.filter(isCleanText)
}
