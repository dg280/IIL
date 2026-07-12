import { renderToStaticMarkup } from 'react-dom/server'
import { formatText } from '../engine/interpreter'
import type { Condition, Op, Story } from '../engine/types'
import type { Roster } from '../storage'
import type { Expression } from '../avatar/types'
import { normalizeAvatar } from '../avatar/types'
import { AvatarView } from '../avatar/AvatarView'
import { Background } from '../universes/Background'
import { ZipWriter } from './zip'

/** Export d'une histoire en projet Ren'Py : script.rpy + sprites/décors PNG. */

function sanitize(name: string): string {
  const clean = name.replace(/\W+/g, '_').replace(/^_+/, '')
  return clean || 'label_vide'
}

function escapeText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\{/g, '{{').replace(/\[/g, '[[')
}

function pyCond(cond: Condition): string {
  if (cond.eq !== undefined) {
    const v = typeof cond.eq === 'boolean' ? (cond.eq ? 'True' : 'False') : JSON.stringify(cond.eq)
    return `${cond.var} == ${v}`
  }
  const parts: string[] = []
  if (cond.gte !== undefined) parts.push(`${cond.var} >= ${cond.gte}`)
  if (cond.lte !== undefined) parts.push(`${cond.var} <= ${cond.lte}`)
  if (cond.gt !== undefined) parts.push(`${cond.var} > ${cond.gt}`)
  if (cond.lt !== undefined) parts.push(`${cond.var} < ${cond.lt}`)
  return parts.join(' and ') || 'True'
}

function opsToRpy(ops: Op[], indent: string, usedSprites: Set<string>, usedBgs: Set<string>, names: Record<string, string>): string[] {
  const lines: string[] = []
  for (const op of ops) {
    switch (op.op) {
      case 'scene':
        usedBgs.add(op.bg)
        lines.push(`${indent}scene bg ${sanitize(op.bg)}`)
        lines.push(`${indent}with dissolve`)
        break
      case 'show': {
        const expr = op.expr ?? 'neutre'
        usedSprites.add(`${op.who}|${expr}`)
        lines.push(`${indent}show ${sanitize(op.who)} ${expr} at ${op.at ?? 'center'}`)
        break
      }
      case 'hide':
        lines.push(`${indent}hide ${sanitize(op.who)}`)
        break
      case 'say':
        lines.push(`${indent}${op.who ? sanitize(op.who) + ' ' : ''}"${escapeText(formatText(op.text, names))}"`)
        break
      case 'menu': {
        lines.push(`${indent}menu:`)
        for (const c of op.choices) {
          const allConds = [...(c.cond ? [c.cond] : []), ...(c.condAll ?? [])]
          const cond = allConds.length ? ` if ${allConds.map(pyCond).join(' and ')}` : ''
          lines.push(`${indent}    "${escapeText(formatText(c.text, names))}"${cond}:`)
          for (const e of c.effects ?? []) {
            if ('set' in e) {
              const v = typeof e.to === 'boolean' ? (e.to ? 'True' : 'False') : JSON.stringify(e.to)
              lines.push(`${indent}        $ ${e.set} = ${v}`)
            } else {
              lines.push(`${indent}        $ ${e.add} += ${e.n}`)
            }
          }
          lines.push(`${indent}        jump ${sanitize(c.jump)}`)
        }
        break
      }
      case 'if':
        lines.push(`${indent}if ${pyCond(op.cond)}:`)
        lines.push(`${indent}    jump ${sanitize(op.then)}`)
        lines.push(`${indent}else:`)
        lines.push(`${indent}    jump ${sanitize(op.else)}`)
        break
      case 'jump':
        lines.push(`${indent}jump ${sanitize(op.label)}`)
        break
      case 'end':
        lines.push(`${indent}centered "${op.ending.emoji} Fin : ${escapeText(op.ending.title)}"`)
        lines.push(`${indent}return`)
        break
    }
  }
  return lines
}

export function generateScript(story: Story, playerName: string, roster: Roster): { script: string; usedSprites: Set<string>; usedBgs: Set<string> } {
  const usedSprites = new Set<string>()
  const usedBgs = new Set<string>()
  const names: Record<string, string> = {}
  for (const [id, ch] of Object.entries(story.characters)) {
    names[id] = ch.isPlayer ? playerName : roster[id]?.name ?? ch.name
  }
  const lines: string[] = [
    `# ${story.meta.title}`,
    `# Histoire créée avec Célestine 🌸 — https://github.com/dg280/IIL`,
    '',
  ]
  for (const [id, ch] of Object.entries(story.characters)) {
    lines.push(`define ${sanitize(id)} = Character("${escapeText(names[id])}", color="${ch.color ?? '#e35d7c'}")`)
  }
  lines.push('')
  for (const [name, value] of Object.entries(story.variables)) {
    const v = typeof value === 'boolean' ? (value ? 'True' : 'False') : JSON.stringify(value)
    lines.push(`default ${sanitize(name)} = ${v}`)
  }
  lines.push('')
  for (const [label, ops] of Object.entries(story.labels)) {
    lines.push(`label ${sanitize(label)}:`)
    const body = opsToRpy(ops, '    ', usedSprites, usedBgs, names)
    if (body.length === 0) body.push('    return')
    lines.push(...body)
    lines.push('')
  }
  return { script: lines.join('\n'), usedSprites, usedBgs }
}

async function svgToPng(svg: string, width: number, height: number): Promise<Uint8Array> {
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('SVG illisible'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
    const png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG raté'))), 'image/png'),
    )
    return new Uint8Array(await png.arrayBuffer())
  } finally {
    URL.revokeObjectURL(url)
  }
}

const README = `Ton histoire Célestine en projet Ren'Py 🌸
==========================================

1. Installe le SDK Ren'Py : https://www.renpy.org
2. Dans le lanceur Ren'Py, crée un nouveau projet (n'importe quel nom).
3. Remplace le contenu du dossier game/ du projet par le dossier game/ de ce zip.
4. Lance le projet : ton histoire se joue dans le vrai moteur Ren'Py !

Les images (personnages, décors) sont dans game/images/.
Le scénario complet est dans game/script.rpy — ouvre-le, il est lisible !
`

export async function exportRenpyZip(story: Story, playerName: string, roster: Roster): Promise<Blob> {
  const { script, usedSprites, usedBgs } = generateScript(story, playerName, roster)
  const zip = new ZipWriter()
  zip.add('README-CELESTINE.txt', README)
  zip.add('game/script.rpy', script)

  for (const key of usedSprites) {
    const [who, expr] = key.split('|')
    const ch = story.characters[who]
    const config = ch?.isPlayer
      ? roster.self?.config
      : roster[who]?.config ?? ch?.defaultAvatar
    if (!config) continue
    const svg = renderToStaticMarkup(
      <AvatarView config={normalizeAvatar(config)} expr={expr as Expression} width={440} />,
    ).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" height="600" ')
    const png = await svgToPng(svg, 440, 600)
    zip.add(`game/images/${sanitize(who)} ${expr}.png`, png)
  }

  for (const bg of usedBgs) {
    const svg = renderToStaticMarkup(<Background id={bg} />)
      .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" ')
    const png = await svgToPng(svg, 1280, 720)
    zip.add(`game/images/bg ${sanitize(bg)}.png`, png)
  }

  return zip.finish()
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
