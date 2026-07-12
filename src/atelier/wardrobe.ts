import type { OutfitDesign } from './generator'

/** Garde-robe des créations de l'Atelier magique. */

export interface WardrobeItem extends OutfitDesign {
  id: string
  label: string
}

const KEY = 'celestine.wardrobe'
let memory: WardrobeItem[] = []

export function getWardrobe(): WardrobeItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as WardrobeItem[]
  } catch {
    /* repli mémoire */
  }
  return memory
}

function write(items: WardrobeItem[]) {
  memory = items
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    /* mémoire seulement */
  }
}

export function saveToWardrobe(design: OutfitDesign, label: string): WardrobeItem {
  const items = getWardrobe()
  const item: WardrobeItem = { ...design, id: `w${items.length + 1}_${label.length}${items.length * 7 + 1}`, label: label.slice(0, 40) }
  write([...items, item])
  return item
}

export function removeFromWardrobe(id: string) {
  write(getWardrobe().filter((i) => i.id !== id))
}
