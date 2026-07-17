import { describe, expect, it } from 'vitest'
import { createStory } from '../../src/builder/types'
import {
  decodeBundle,
  decodePostcard,
  encodeBundle,
  encodePostcard,
  isAllowedSticker,
  isPostcardCode,
  makeBundle,
  parseBundle,
  scanPII,
} from '../../src/share'

const story = () => createStory('s1', 'Le Secret du test', 'sakura', 'secret', ['perso1'])

describe('bundle de partage (hors-ligne)', () => {
  it('aller-retour encode → parse sans perte', () => {
    const bundle = makeBundle(story(), {}, 'Plume-Test')
    const code = encodeBundle(bundle)
    expect(code.startsWith('CEL1.')).toBe(true)
    const back = parseBundle(code)
    expect(back.story.title).toBe('Le Secret du test')
    expect(back.authorPseudo).toBe('Plume-Test')
  })

  it('rejette les codes corrompus et les contenus dangereux', () => {
    expect(() => parseBundle('CEL1.zzz-not-base64')).toThrow()
    const s = story()
    s.scenes[s.startId].lines = [{ who: null, text: 'Va sur https://site-louche.example !' }]
    const code = encodeBundle(makeBundle(s, {}))
    expect(() => decodeBundle(code)).toThrow() // les URLs sont interdites dans les textes
  })
})

describe('scanPII (avant partage)', () => {
  it('détecte téléphone, email, adresse ; laisse passer une histoire propre', () => {
    const clean = story()
    expect(scanPII(clean)).toBeNull()
    const leaky = story()
    leaky.scenes[leaky.startId].lines = [{ who: null, text: 'Appelle-moi au 06 12 34 56 78 !' }]
    expect(scanPII(leaky)).not.toBeNull()
    const email = story()
    email.scenes[email.startId].lines = [{ who: null, text: 'écris à rose@example.com' }]
    expect(scanPII(email)).not.toBeNull()
  })
})

describe('cartes postales (boucle sociale hors-ligne)', () => {
  it('aller-retour + stickers en liste blanche uniquement', () => {
    const code = encodePostcard({ v: 1, storyId: 's1', storyTitle: 'T', endingId: 'fin1', endingTitle: 'Fin', sticker: '💖', from: 'Amie' })
    expect(isPostcardCode(code)).toBe(true)
    expect(decodePostcard(code).sticker).toBe('💖')
    expect(isAllowedSticker('💖')).toBe(true)
    expect(isAllowedSticker('🍆')).toBe(false)
  })
})
