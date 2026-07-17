import { beforeEach, describe, expect, it } from 'vitest'
import {
  FREE_DECOR_SLOTS,
  FREE_PERSO_SLOTS,
  KEYWORD_PACKS,
  buySlotBundle,
  decorSlots,
  hasPack,
  isPremium,
  persoSlots,
  redeemCode,
  setPremium,
  unlockPack,
} from '../../src/premium'
import { addReward, getProgress } from '../../src/progression'

beforeEach(() => {
  localStorage.clear()
})

describe('Passe Créatrice (codes)', () => {
  it('active avec un code valide (normalisation espaces/casse), refuse le reste', () => {
    expect(isPremium()).toBe(false)
    expect(redeemCode('code-bidon')).toBe(false)
    expect(isPremium()).toBe(false)
    expect(redeemCode('  passe créatrice'.toUpperCase().replace('É', 'E'))).toBe(true)
    expect(isPremium()).toBe(true)
    setPremium(false)
    expect(isPremium()).toBe(false)
  })
})

describe('économie gemmes → packs & slots', () => {
  it('unlockPack débite les gemmes et refuse sans solde', () => {
    const pack = KEYWORD_PACKS[0]
    expect(unlockPack(pack.id)).toEqual({ ok: false, reason: 'gems' })
    addReward(0, pack.cost)
    expect(unlockPack(pack.id).ok).toBe(true)
    expect(hasPack(pack.id)).toBe(true)
    expect(getProgress().gems).toBe(0)
    expect(unlockPack(pack.id)).toEqual({ ok: true, reason: 'owned' }) // idempotent, pas de double débit
  })

  it('buySlotBundle étend perso ET décor, premium éclipse les bonus', () => {
    expect(persoSlots()).toBe(FREE_PERSO_SLOTS)
    expect(decorSlots()).toBe(FREE_DECOR_SLOTS)
    expect(buySlotBundle()).toEqual({ ok: false, reason: 'gems' })
    addReward(0, 80)
    expect(buySlotBundle().ok).toBe(true)
    expect(persoSlots()).toBe(FREE_PERSO_SLOTS + 5)
    expect(decorSlots()).toBe(FREE_DECOR_SLOTS + 5)
    setPremium(true)
    expect(persoSlots()).toBeGreaterThanOrEqual(40)
  })
})
