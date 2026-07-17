import { describe, expect, it } from 'vitest'
import { createStory, newScene } from '../../src/builder/types'
import type { AuthoredStory } from '../../src/builder/types'
import { analyzeStory, compileStory } from '../../src/builder/compile'
import { advance, choose, startStory } from '../../src/engine/interpreter'
import type { RuntimeState } from '../../src/engine/interpreter'
import type { Story } from '../../src/engine/types'

/** Micro-histoire : un choix à 2 options, deux fins. */
function microStory(mutate?: (s: AuthoredStory) => void): AuthoredStory {
  const s = createStory('t1', 'Test', 'sakura', 'vierge', ['perso1'])
  const start = s.scenes[s.startId]
  const scA = newScene('scA', 'cour_sakura')
  scA.titre = 'Chemin A'
  scA.lines = [{ who: null, text: 'Tu choisis le chemin A.' }]
  scA.outcome = { kind: 'fin', title: 'Fin A', emoji: '⭐' }
  const scB = newScene('scB', 'cour_sakura')
  scB.titre = 'Chemin B'
  scB.lines = [{ who: 'perso1', text: 'Le chemin B, quelle idée !' }]
  scB.outcome = { kind: 'fin', title: 'Fin B', emoji: '🌙' }
  s.scenes.scA = scA
  s.scenes.scB = scB
  start.lines = [{ who: null, text: 'Un carrefour.' }]
  start.outcome = {
    kind: 'choix',
    options: [
      { text: 'Aller en A', next: 'scA', hearts: { perso1: 1 }, setFlags: ['a_choisi_a'], needFlag: null, needHearts: null },
      { text: 'Aller en B', next: 'scB', hearts: {}, setFlags: [], needFlag: null, needHearts: null },
    ],
  }
  mutate?.(s)
  return s
}

/** Déroule l'histoire jusqu'au prochain menu ou à la fin (borné). */
function runToInteractive(story: Story, st: RuntimeState): RuntimeState {
  let guard = 30
  while (st.current && st.current.kind === 'say' && guard-- > 0) st = advance(story, st)
  return st
}

describe('compileStory', () => {
  it('produit un AST jouable : labels, menu, fins distinctes', () => {
    const story = compileStory(microStory(), {})
    expect(story.labels.start).toBeDefined()
    expect(story.endings.length).toBeGreaterThanOrEqual(2)
    const menuOp = Object.values(story.labels)
      .flat()
      .find((op) => op.op === 'menu')
    expect(menuOp).toBeDefined()
  })
})

describe('interpreter', () => {
  it('joue le parcours complet : narration → choix (effets appliqués) → fin A', () => {
    const story = compileStory(microStory(), {})
    const atMenu = runToInteractive(story, startStory(story))
    expect(atMenu.current?.kind).toBe('menu')
    if (atMenu.current?.kind !== 'menu') return
    const optA = atMenu.current.options[0]
    expect(optA.locked).toBe(false)
    const after = choose(story, atMenu, optA.choice)
    expect(after.vars.coeur_perso1).toBe(1) // effet d'affinité du choix A
    const end = runToInteractive(story, after)
    expect(end.current?.kind).toBe('end')
    if (end.current?.kind === 'end') expect(end.current.ending.title).toBe('Fin A')
  })

  it('verrouille les options à seuil d’affinité non atteint (option secrète)', () => {
    const authored = microStory((s) => {
      const start = s.scenes[s.startId]
      if (start.outcome.kind === 'choix') start.outcome.options[1].needHearts = { who: 'perso1', min: 3 }
    })
    const story = compileStory(authored, {})
    const atMenu = runToInteractive(story, startStory(story))
    expect(atMenu.current?.kind).toBe('menu')
    if (atMenu.current?.kind === 'menu') {
      expect(atMenu.current.options[0].locked).toBe(false)
      expect(atMenu.current.options[1].locked).toBe(true)
    }
  })
})

describe('analyzeStory (lints Plume)', () => {
  it('choix divergent avec effets = score 3 ; options identiques sans effet = faux choix (score 1) + tip', () => {
    const real = analyzeStory(microStory())
    const startReal = Object.entries(real.scenes).find(([id]) => id === 'start')?.[1] ?? Object.values(real.scenes)[0]
    expect(startReal.choiceScore).toBe(3)

    const fake = analyzeStory(
      microStory((s) => {
        const start = s.scenes[s.startId]
        if (start.outcome.kind === 'choix') {
          start.outcome.options = start.outcome.options.map((o) => ({ ...o, next: 'scA', hearts: {}, setFlags: [] }))
        }
      }),
    )
    const startFake = Object.entries(fake.scenes).find(([id]) => id === 'start')?.[1] ?? Object.values(fake.scenes)[0]
    expect(startFake.choiceScore).toBe(1)
    expect(fake.tips.length).toBeGreaterThan(0)
  })
})
