import type { Choice, Condition, Effect, Ending, Op, SpritePos, Story, VarValue } from './types'
import type { Expression } from '../avatar/types'

export interface SpriteState {
  who: string
  expr: Expression
  at: SpritePos
}

export type CurrentStep =
  | { kind: 'say'; who?: string; text: string }
  | { kind: 'menu'; choices: Choice[] }
  | { kind: 'end'; ending: Ending }

export interface RuntimeState {
  label: string
  index: number
  vars: Record<string, VarValue>
  bg: string | null
  sprites: SpriteState[]
  current: CurrentStep | null
}

export function evalCond(cond: Condition, vars: Record<string, VarValue>): boolean {
  const v = vars[cond.var]
  if (cond.eq !== undefined) return v === cond.eq
  const n = typeof v === 'number' ? v : 0
  if (cond.gte !== undefined && !(n >= cond.gte)) return false
  if (cond.lte !== undefined && !(n <= cond.lte)) return false
  if (cond.gt !== undefined && !(n > cond.gt)) return false
  if (cond.lt !== undefined && !(n < cond.lt)) return false
  return true
}

function applyEffects(vars: Record<string, VarValue>, effects: Effect[] | undefined): Record<string, VarValue> {
  if (!effects || effects.length === 0) return vars
  const next = { ...vars }
  for (const e of effects) {
    if ('set' in e) next[e.set] = e.to
    else next[e.add] = (typeof next[e.add] === 'number' ? (next[e.add] as number) : 0) + e.n
  }
  return next
}

/** Avance dans l'histoire jusqu'au prochain point interactif (say / menu / end). */
export function advance(story: Story, state: RuntimeState): RuntimeState {
  const s: RuntimeState = {
    ...state,
    sprites: state.sprites.map((x) => ({ ...x })),
    vars: { ...state.vars },
    current: null,
  }
  for (;;) {
    const ops: Op[] | undefined = story.labels[s.label]
    if (!ops || s.index >= ops.length) {
      s.current = { kind: 'end', ending: { id: 'fin', title: 'Fin', emoji: '🌸' } }
      return s
    }
    const op = ops[s.index]
    switch (op.op) {
      case 'scene':
        s.bg = op.bg
        s.sprites = []
        s.index++
        break
      case 'show': {
        const existing = s.sprites.find((sp) => sp.who === op.who)
        if (existing) {
          existing.expr = op.expr ?? existing.expr
          if (op.at) existing.at = op.at
        } else {
          s.sprites.push({ who: op.who, expr: op.expr ?? 'neutre', at: op.at ?? 'center' })
        }
        s.index++
        break
      }
      case 'hide':
        s.sprites = s.sprites.filter((sp) => sp.who !== op.who)
        s.index++
        break
      case 'say':
        s.current = { kind: 'say', who: op.who, text: op.text }
        s.index++
        return s
      case 'menu': {
        const visible = op.choices.filter((c) => !c.cond || evalCond(c.cond, s.vars))
        s.current = { kind: 'menu', choices: visible }
        s.index++
        return s
      }
      case 'if':
        s.label = evalCond(op.cond, s.vars) ? op.then : op.else
        s.index = 0
        break
      case 'jump':
        s.label = op.label
        s.index = 0
        break
      case 'end':
        s.current = { kind: 'end', ending: op.ending }
        return s
    }
  }
}

export function startStory(story: Story, startLabel = 'start'): RuntimeState {
  return advance(story, {
    label: startLabel,
    index: 0,
    vars: { ...story.variables },
    bg: null,
    sprites: [],
    current: null,
  })
}

export function choose(story: Story, state: RuntimeState, choice: Choice): RuntimeState {
  const vars = applyEffects(state.vars, choice.effects)
  return advance(story, { ...state, vars, label: choice.jump, index: 0 })
}

/** Remplace {mc}, {yuki}… par les noms affichés des personnages. */
export function formatText(text: string, names: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (m, id: string) => names[id] ?? m)
}
