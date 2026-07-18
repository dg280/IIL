/**
 * Vérification de l'infra LibertAI, à deux niveaux :
 *
 *  1) SONDE DIRECTE de l'API (`GET {base}/v1/models`) — marche depuis le
 *     navigateur (l'API LibertAI autorise le CORS, c'est déjà ainsi que la
 *     génération fonctionne). Dit si l'API répond et si la clé est acceptée.
 *
 *  2) ÉTAT DÉTAILLÉ via la page https://status.libertai.io (Uptime Kuma). Cette
 *     page n'envoie PAS d'en-tête CORS → on la relaie par le worker (route
 *     `?status=libertai` de bug-worker.js). Donne l'état service par service
 *     (image « Z-Image Turbo », texte « Hermes 3 8B », sites…).
 */

export const LIBERTAI_STATUS_URL = 'https://status.libertai.io/'

export interface LibertaiPing {
  reachable: boolean
  keyValid: boolean
  status: number | null
  modelCount: number
  error?: string
}

/** Sonde directe de l'API LibertAI (réachabilité + validité de la clé). */
export async function pingLibertai(baseUrl: string, apiKey: string): Promise<LibertaiPing> {
  const base = baseUrl.replace(/\/$/, '')
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), 12_000)
  try {
    const res = await fetch(`${base}/v1/models`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: ctrl.signal,
    })
    const keyValid = res.status !== 401 && res.status !== 403
    let modelCount = 0
    if (res.ok) {
      try {
        const j = (await res.json()) as { data?: unknown[]; models?: unknown[] }
        modelCount = (j.data ?? j.models ?? []).length
      } catch {
        /* corps non-JSON : peu importe, l'API a répondu */
      }
    }
    return { reachable: true, keyValid, status: res.status, modelCount }
  } catch {
    return {
      reachable: false,
      keyValid: false,
      status: null,
      modelCount: 0,
      error: ctrl.signal.aborted ? 'délai dépassé' : 'connexion impossible',
    }
  } finally {
    window.clearTimeout(timer)
  }
}

export interface LibertaiService {
  name: string
  group: string
  up: boolean | null
}
export interface LibertaiStatus {
  overall: 'up' | 'degraded' | 'down'
  image: boolean | null
  text: boolean | null
  downCount: number
  services: LibertaiService[]
  fetchedAt: number
}

/**
 * État détaillé via le relais worker (`{proxyBase}?status=libertai`).
 * Renvoie null si le worker ne connaît pas encore cette route (à redéployer)
 * ou s'il est injoignable — l'appelant retombe alors sur la sonde directe.
 */
export async function fetchLibertaiStatus(proxyBase: string): Promise<LibertaiStatus | null> {
  const url = `${proxyBase.replace(/\/$/, '')}?status=libertai`
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), 12_000)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) return null
    const j = (await res.json()) as Partial<LibertaiStatus> & { error?: string }
    if (j.error || !j.overall || !Array.isArray(j.services)) return null
    return j as LibertaiStatus
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
  }
}
