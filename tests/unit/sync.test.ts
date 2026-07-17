import { describe, expect, it } from 'vitest'
import { mergeRestoredStories, shouldRestoreRoster } from '../../src/backend/sync'
import type { AuthoredStory } from '../../src/builder/types'
import type { Roster } from '../../src/storage'

const story = (id: string) => ({ id, title: `Histoire ${id}` }) as unknown as AuthoredStory

describe('Sauvegarde cloud — règles de restauration (jamais de perte locale)', () => {
  it("n'ajoute que les histoires absentes du local", () => {
    const local = { a: story('a'), b: story('b') }
    const remote = [
      { story_id: 'a', data: story('a-distante') }, // existe localement → ignorée
      { story_id: 'c', data: story('c') }, // absente → restaurée
    ]
    const added = mergeRestoredStories(local, remote)
    expect(added.map((s) => s.id)).toEqual(['c'])
  })

  it("le local plus récent n'est jamais écrasé (même id ⇒ version locale gardée)", () => {
    const local = { a: story('version-locale') }
    const added = mergeRestoredStories(local, [{ story_id: 'a', data: story('version-distante') }])
    expect(added).toEqual([])
  })

  it('local vide → tout le distant est restauré', () => {
    const added = mergeRestoredStories({}, [
      { story_id: 'a', data: story('a') },
      { story_id: 'b', data: story('b') },
    ])
    expect(added).toHaveLength(2)
  })

  it("le roster distant ne s'applique que si le local est vide (hors avatar self)", () => {
    expect(shouldRestoreRoster({} as Roster)).toBe(true)
    expect(shouldRestoreRoster({ self: {} } as unknown as Roster)).toBe(true)
    expect(shouldRestoreRoster({ self: {}, luna: {} } as unknown as Roster)).toBe(false)
  })
})
