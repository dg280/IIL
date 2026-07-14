/**
 * Gestion des versions du service worker en mode « prompt » : la nouvelle version
 * n'est PAS appliquée automatiquement. L'app détecte qu'une version est prête
 * (onNeedRefresh) et laisse Rose décider quand l'installer — ainsi elle reste sur
 * sa version qui marche (notion de beta) et peut choisir de passer à la suivante.
 */
import { registerSW } from 'virtual:pwa-register'

let ready = false // une nouvelle version est installée et attend d'être activée
let listener: (() => void) | null = null
let reg: ServiceWorkerRegistration | undefined

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    ready = true
    listener?.()
  },
  onRegisteredSW(_url, r) {
    reg = r
  },
})

/** Une nouvelle version est-elle installée et prête à être activée ? */
export function updateReadySW(): boolean {
  return ready
}

/** S'abonner à l'arrivée d'une nouvelle version prête. */
export function onUpdateReady(cb: () => void) {
  listener = cb
}

/** Active la nouvelle version (skipWaiting) et recharge la page. */
export function applyUpdate(): Promise<void> {
  return updateSW(true)
}

/** Demande au service worker de vérifier s'il existe une nouvelle version. */
export async function pingUpdate(): Promise<void> {
  try {
    await reg?.update()
  } catch {
    /* hors-ligne / pas de SW */
  }
}

/**
 * Réinitialisation « dure » : désinscrit le SW et vide tous ses caches, puis
 * recharge → on récupère proprement la version actuellement déployée (utile pour
 * débloquer un état cassé mis en cache).
 */
export async function hardReset(): Promise<void> {
  try {
    const regs = await navigator.serviceWorker?.getRegistrations()
    await Promise.all((regs ?? []).map((r) => r.unregister()))
    if (window.caches) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch {
    /* ignore */
  }
  window.location.reload()
}
