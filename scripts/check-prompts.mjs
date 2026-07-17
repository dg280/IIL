// Audit CI : aucun concept interdit dans les CHAÎNES des fichiers qui
// construisent les prompts d'images. Sur un modèle distillé sans guidance
// négative (z-image-turbo, negative_prompt no-op), écrire « no nudity »
// injecte « nudity » dans le conditionnement — cause avérée de dérives
// (cf. docs/09). Seuls les littéraux de chaîne peuvent atteindre un prompt :
// les commentaires et identifiants sont ignorés par un mini-lexeur.
import { readFileSync } from 'node:fs'

const SCANNED = ['src/atelier/genai.ts', 'src/atelier/generator.ts']
const BANNED = [
  'nudity', 'nude', 'naked', 'topless', 'bottomless', 'nsfw', 'lingerie', 'panties',
  'bikini', 'swimsuit', 'swimwear', 'cleavage', 'breast', 'nipple', 'underwear',
  'sexualized', 'suggestive', 'seductive', 'erotic', 'ecchi', 'hentai',
  'crop top', 'midriff', 'pin-up',
  'nudité', 'seins', 'torse nu', 'ventre nu', 'sous-vêtements', 'décolleté',
]

/** Extrait les littéraux de chaîne ('…', "…", `…`) avec leur ligne, en sautant
 *  commentaires // et /* … *​/ et en respectant les échappements. */
function stringLiterals(src) {
  const out = []
  let i = 0
  let line = 1
  const n = src.length
  while (i < n) {
    const c = src[i]
    if (c === '\n') { line++; i++; continue }
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++ }
      i += 2
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      const quote = c
      const startLine = line
      let buf = ''
      i++
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\') { buf += src[i + 1] ?? ''; i += 2; continue }
        if (src[i] === '\n') line++
        buf += src[i]
        i++
      }
      i++
      out.push({ text: buf, line: startLine })
      continue
    }
    i++
  }
  return out
}

let failed = false
for (const file of SCANNED) {
  const src = readFileSync(file, 'utf8')
  for (const { text, line } of stringLiterals(src)) {
    const lower = text.toLowerCase()
    for (const word of BANNED) {
      const idx = lower.indexOf(word)
      if (idx === -1) continue
      const before = lower[idx - 1] ?? ' '
      const after = lower[idx + word.length] ?? ' '
      if (/[a-zà-ÿ]/.test(before) || /[a-zà-ÿ]/.test(after)) continue // borne de mot
      console.error(`✗ ${file}:${line} — chaîne contenant le token interdit « ${word} » : “${text.slice(0, 80)}”`)
      failed = true
    }
  }
}
if (failed) {
  console.error('\nRappel : jamais de concept interdit dans un prompt, même nié — le reformuler en description positive (tenue concrète, registre tout-public).')
  process.exit(1)
}
console.log(`✓ check:prompts — aucun token interdit dans les chaînes de ${SCANNED.join(', ')}`)
