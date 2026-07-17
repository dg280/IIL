import { describe, expect, it } from 'vitest'
import { buildPortraitPayload, getBackendConfig, setBackendConfig } from '../../src/backend/client'

describe('Studio familial — charge envoyée au serveur', () => {
  it('est STRUCTURÉE : jamais de champ prompt (le serveur construit le prompt)', () => {
    const payload = buildPortraitPayload(
      'une exploratrice rieuse',
      'sakura',
      { tags: ['yeux bleus', 'robe de bal'], reinforced: ['yeux bleus'], gender: 'fille', skin: 'clair', age: 'ado', seed: 42 },
      'profil-123',
    )
    expect(payload.kind).toBe('portrait')
    expect(payload.profileId).toBe('profil-123')
    expect(payload.tags).toContain('yeux bleus')
    expect('prompt' in payload).toBe(false) // l'invariant de sécurité M1
    expect(payload.descr.length).toBeLessThanOrEqual(220)
  })

  it('config backend : aller-retour et invalidation', () => {
    setBackendConfig({ url: 'https://x.supabase.co', anonKey: 'k', profileId: 'p1' })
    expect(getBackendConfig()?.profileId).toBe('p1')
    setBackendConfig(null)
    expect(getBackendConfig()).toBeNull()
  })
})
