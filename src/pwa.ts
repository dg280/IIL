/**
 * Le service worker est enregistré automatiquement par vite-plugin-pwa en mode
 * « autoUpdate » : les nouvelles versions s'appliquent toutes seules au rechargement.
 * Ce module ne fait qu'exposer quelques outils pour la coccinelle (vérifier /
 * forcer maintenant / reset dur), sans changer ce comportement automatique.
 */

/** En auto-update, la mise à jour s'applique seule → pas d'état « en attente » à gérer. */
export function updateReadySW(): boolean {
  return false
}

/** Demande au service worker de vérifier tout de suite s'il existe une nouvelle version. */
export async function pingUpdate(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    await reg?.update()
  } catch {
    /* hors-ligne / pas de SW */
  }
}

/**
 * Veilleur de mise à jour : vérifie régulièrement (et à chaque retour au premier
 * plan) s'il existe une nouvelle version, et RECHARGE automatiquement dès qu'un
 * nouveau service worker prend la main. Évite de rester bloqué sur une version en
 * cache — c'était le cas : l'auto-update ne vérifiait qu'au chargement de page.
 * Le garde `hadController` empêche tout rechargement au tout premier lancement.
 */
export function startUpdateWatcher(): () => void {
  if (!('serviceWorker' in navigator)) return () => {}
  const sw = navigator.serviceWorker
  const hadController = !!sw.controller
  let reloaded = false
  const onControllerChange = () => {
    if (hadController && !reloaded) {
      reloaded = true
      window.location.reload()
    }
  }
  sw.addEventListener('controllerchange', onControllerChange)
  const check = () => void pingUpdate()
  const id = window.setInterval(check, 60_000)
  const onVis = () => document.visibilityState === 'visible' && check()
  document.addEventListener('visibilitychange', onVis)
  check()
  return () => {
    sw.removeEventListener('controllerchange', onControllerChange)
    window.clearInterval(id)
    document.removeEventListener('visibilitychange', onVis)
  }
}

/** Recharge la page (récupère la version déjà mise à jour par l'auto-update). */
export async function applyUpdate(): Promise<void> {
  window.location.reload()
}

/**
 * Réinitialisation « dure » : désinscrit le SW et vide tous ses caches, puis
 * recharge → on récupère proprement la version actuellement déployée (utile pour
 * récupérer la dernière version tout de suite, ou débloquer un état cassé en cache).
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
