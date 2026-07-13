/**
 * « Animalese » : petits bruitages de voix synthétisés (façon Animal Crossing /
 * Tomodachi) joués pendant que le texte du dialogue se dévoile. Aucun fichier
 * audio — tout est généré en WebAudio, donc hors-ligne et sans dépendance.
 */

let ctx: AudioContext | null = null
let enabled = true

function ac(): AudioContext | null {
  if (!enabled) return null
  try {
    if (!ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctx = new Ctor()
    }
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  } catch {
    enabled = false
    return null
  }
}

export function setVoiceEnabled(on: boolean) {
  enabled = on
}

export function isVoiceEnabled(): boolean {
  return enabled
}

/** Hauteur de voix (0.6–1.6) dérivée du personnage, stable pour un même id. */
export function voicePitch(seed: string, narrator = false): number {
  if (narrator) return 0.7
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffff
  return 0.85 + (h % 100) / 100 // 0.85 → 1.85
}

/** Un blip court, pitché ; joué par syllabe pendant la frappe du texte. */
export function playBlip(pitch: number) {
  const c = ac()
  if (!c) return
  const t = c.currentTime
  const osc = c.createOscillator()
  const gain = c.createGain()
  // base ~ 440 Hz, modulée par le pitch du personnage + petite variation
  const base = 300 * pitch * (0.94 + Math.abs(Math.sin(t * 40)) * 0.12)
  osc.type = 'square'
  osc.frequency.setValueAtTime(base, t)
  osc.frequency.linearRampToValueAtTime(base * 1.08, t + 0.05)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(0.06, t + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
  osc.connect(gain).connect(c.destination)
  osc.start(t)
  osc.stop(t + 0.1)
}

/** Petit son doux de sélection (clic de choix). */
export function playSelect() {
  const c = ac()
  if (!c) return
  const t = c.currentTime
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(660, t)
  osc.frequency.exponentialRampToValueAtTime(990, t + 0.09)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(0.08, t + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
  osc.connect(gain).connect(c.destination)
  osc.start(t)
  osc.stop(t + 0.18)
}
