import { describe, expect, it } from 'vitest'
import { cleanList, isCleanText, moderatePrompt } from '../../src/atelier/moderation'

describe('moderatePrompt (entrée enfant)', () => {
  it('accepte les demandes innocentes du registre otome', () => {
    expect(moderatePrompt('une robe de bal bleu nuit avec des étoiles')).toBeNull()
    expect(moderatePrompt('un bisou sur la joue au festival')).toBeNull()
    expect(moderatePrompt('une héroïne courageuse au grand cœur')).toBeNull() // « héroïne » personnage ≠ drogue
  })

  it('bloque sexualité, violence, drogues, auto-mutilation', () => {
    for (const bad of [
      'une fille toute nue',
      'en sous-vêtements et lingerie',
      'du sang partout et un couteau sous la gorge',
      'il se drogue à la cocaïne',
      'elle veut se scarifier',
      'putain de robe',
    ]) {
      expect(moderatePrompt(bad), bad).not.toBeNull()
    }
  })

  it('borne la longueur (trop court / trop long)', () => {
    // NB : pas de filler « xxx… » — la répétition de x déclenche le motif porno. 🙃
    const filler = 'une belle robe brodée de fleurs, '
    expect(moderatePrompt('a')).not.toBeNull()
    expect(moderatePrompt(filler.repeat(10), 120)).not.toBeNull()
    expect(moderatePrompt(filler.repeat(6).slice(0, 190), 220)).toBeNull()
  })
})

describe('isCleanText / cleanList (sorties IA)', () => {
  it('filtre les répliques inappropriées, garde les douces', () => {
    expect(isCleanText('Elle sourit et lui tend un pétale de cerisier.')).toBe(true)
    expect(isCleanText('Il sort un pistolet de son sac.')).toBe(false)
    expect(cleanList(['Un thé ensemble ?', 'nique tout', 'Répétons la chanson !'])).toEqual([
      'Un thé ensemble ?',
      'Répétons la chanson !',
    ])
  })
})
