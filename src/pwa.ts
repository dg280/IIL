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
