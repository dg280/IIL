import { describe, expect, it } from 'vitest'
import { bgPrompt, portraitPrompt } from '../../src/atelier/genai'
import type { PortraitOpts } from '../../src/atelier/genai'

// Mêmes tokens que scripts/check-prompts.mjs : un concept interdit, même nié,
// est injecté dans le conditionnement d'un modèle sans guidance négative.
const BANNED =
  /(nudity|nude|naked|topless|bottomless|nsfw|lingerie|panties|bikini|swimsuit|swimwear|cleavage|breast|nipple|underwear|sexualized|suggestive|seductive|erotic|ecchi|hentai|crop top|midriff|pin-up|nudité|seins|torse nu|ventre nu|sous-vêtements|décolleté)/i

const CONFIGS: { name: string; descr: string; opts: PortraitOpts; universe: string }[] = [
  { name: 'défaut fille sakura', descr: '', opts: { gender: 'fille', age: 'ado', skin: 'clair' }, universe: 'sakura' },
  { name: 'garçon aventure', descr: 'un explorateur rieur', opts: { gender: 'garcon', tags: ['tenue d’aventure', 'cheveux roux'] }, universe: 'royaumes' },
  { name: 'robe de bal + yeux bleus', descr: '', opts: { gender: 'fille', tags: ['robe de bal', 'yeux bleus'], reinforced: ['yeux bleus'] }, universe: 'royaumes' },
  { name: 'pop star + pieds nus', descr: '', opts: { gender: 'fille', tags: ['look de pop star', 'pieds nus'] }, universe: 'scene' },
  { name: 'sans genre ni tuile', descr: '', opts: {}, universe: '' },
]

describe('portraitPrompt — invariants de sécurité', () => {
  for (const c of CONFIGS) {
    it(`aucun token interdit (${c.name})`, () => {
      for (const coverMax of [false, true]) {
        const p = portraitPrompt(c.descr, c.opts, 42, coverMax, c.universe)
        expect(p).not.toMatch(BANNED)
      }
    })
  }

  it('ancre de registre tout-public en tête', () => {
    const p = portraitPrompt('', { gender: 'fille' }, 1, false, 'sakura')
    expect(p.startsWith('Family-friendly anime character illustration')).toBe(true)
  })

  it('tenue TOUJOURS concrète : tuile développée, sinon banque d’univers', () => {
    const bal = portraitPrompt('', { gender: 'fille', tags: ['robe de bal'] }, 7, false, 'royaumes')
    expect(bal).toContain('floor-length princess ball gown')
    const sakura = portraitPrompt('', { gender: 'garcon' }, 7, false, 'sakura')
    expect(sakura).toMatch(/school/i) // banque sakura = tenues scolaires
    expect(sakura).toContain('Fully dressed in')
  })

  it('coverMax impose l’uniforme ultra-couvrant quel que soit le reste', () => {
    const p = portraitPrompt('', { gender: 'fille', tags: ['robe de bal'] }, 7, true, 'royaumes')
    expect(p).toContain('fully covering formal school uniform')
    expect(p).not.toContain('ball gown')
  })

  it('yeux : emphase riche + regard caméra', () => {
    const p = portraitPrompt('', { gender: 'fille', tags: ['yeux bleus'] }, 7, false, 'sakura')
    expect(p).toContain('sky-blue eyes')
    expect(p).toContain('looks straight at the viewer')
  })

  it('déterminisme par graine (retouche = même base) et variété entre graines', () => {
    const a1 = portraitPrompt('', { gender: 'fille' }, 123, false, 'sakura')
    const a2 = portraitPrompt('', { gender: 'fille' }, 123, false, 'sakura')
    expect(a1).toBe(a2)
    const poses = new Set(
      [1, 2, 3, 4, 5, 6].map((s) => portraitPrompt('', { gender: 'fille' }, s, false, 'sakura').match(/Pose: [^.]+/)?.[0]),
    )
    expect(poses.size).toBeGreaterThan(1)
  })

  it('le texte libre ne duplique pas les tuiles et le prénom n’y a pas sa place', () => {
    const p = portraitPrompt('yeux bleus, un personnage', { tags: ['yeux bleus'] }, 7, false, 'sakura')
    // la tuile est déjà exprimée en anglais riche : le doublon FR est retiré
    expect(p.match(/yeux bleus/g) ?? []).toHaveLength(0)
  })
})

describe('bgPrompt — décors', () => {
  it('anglais, positif uniquement, rappel d’univers en fin', () => {
    const p = bgPrompt('la cour sous les cerisiers', 'sakura', 'doux')
    expect(p).not.toMatch(BANNED)
    expect(p).not.toMatch(/Évite|éviter/i)
    // le style d'univers apparaît en tête ET en rappel final
    expect(p.match(/cherry trees in bloom/g)?.length).toBe(2)
  })

  it('intérieur demandé → clause POSITIVE indoor', () => {
    const p = bgPrompt('une bibliothèque en intérieur', 'royaumes')
    expect(p).toMatch(/INDOORS/)
  })
})
