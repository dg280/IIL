/**
 * Mode debug : activable depuis le splash. Quand il est actif, une bulle 🐞
 * flottante permet à la testeuse (Rose) de remonter bugs & demandes de modif
 * avec le contexte du moment, et la création n'a pas de coût en gemmes.
 */

const KEY_DEBUG = 'celestine.debug'
const KEY_REPORTS = 'celestine.bugreports'
const KEY_LASTBUILD = 'celestine.lastbuild'
const KEY_ENDPOINT = 'celestine.bugendpoint'
const KEY_SECRET = 'celestine.bugsecret'

// worker déployé par défaut (public) : il ne fait rien sans le bon APP_SECRET
const DEFAULT_BUG_ENDPOINT = 'https://celestine-bugs.dg-66b.workers.dev'

/** URL de l'edge function qui crée une issue GitHub (boucle automatique). */
export function getBugEndpoint(): string {
  try {
    return localStorage.getItem(KEY_ENDPOINT) ?? DEFAULT_BUG_ENDPOINT
  } catch {
    return DEFAULT_BUG_ENDPOINT
  }
}
export function setBugEndpoint(url: string) {
  try {
    if (url.trim()) localStorage.setItem(KEY_ENDPOINT, url.trim())
    else localStorage.removeItem(KEY_ENDPOINT)
  } catch {
    /* ignore */
  }
}
export function getBugSecret(): string {
  try {
    return localStorage.getItem(KEY_SECRET) ?? ''
  } catch {
    return ''
  }
}
export function setBugSecret(s: string) {
  try {
    if (s.trim()) localStorage.setItem(KEY_SECRET, s.trim())
    else localStorage.removeItem(KEY_SECRET)
  } catch {
    /* ignore */
  }
}

export const BUILD_ID: string = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev'
export const BUILD_AT: string = typeof __BUILD_AT__ !== 'undefined' ? __BUILD_AT__ : ''

const KEY_GOOD = 'celestine.goodversion'
const KEY_STABLE = 'celestine.stableurl'

export interface VersionMark {
  build: string
  version: string
  at: string // quand Rose a marqué « ça marche »
}

/** La dernière version que Rose a confirmée « marche bien » (pour le retour arrière). */
export function getGoodVersion(): VersionMark | null {
  try {
    return JSON.parse(localStorage.getItem(KEY_GOOD) ?? 'null') as VersionMark | null
  } catch {
    return null
  }
}
export function setGoodVersion(v: VersionMark) {
  try {
    localStorage.setItem(KEY_GOOD, JSON.stringify(v))
  } catch {
    /* ignore */
  }
}

/** URL de secours (« version stable ») que peut publier un parent, pour le retour arrière. */
export function getStableUrl(): string {
  try {
    return localStorage.getItem(KEY_STABLE) ?? ''
  } catch {
    return ''
  }
}
export function setStableUrl(url: string) {
  try {
    if (url.trim()) localStorage.setItem(KEY_STABLE, url.trim())
    else localStorage.removeItem(KEY_STABLE)
  } catch {
    /* ignore */
  }
}

/**
 * Va chercher version.json « frais » (sans cache) sur le serveur. Renvoie l'id de
 * build actuellement DÉPLOYÉ, à comparer à BUILD_ID (celui qui tourne). S'ils
 * diffèrent → une nouvelle version est en ligne.
 */
export async function fetchDeployedBuild(): Promise<{ build: string; at?: string } | null> {
  try {
    const base = (import.meta as unknown as { env: { BASE_URL: string } }).env.BASE_URL || '/'
    const res = await fetch(`${base}version.json?_=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as { build: string; at?: string }
  } catch {
    return null
  }
}

export function isDebug(): boolean {
  try {
    return localStorage.getItem(KEY_DEBUG) === '1'
  } catch {
    return false
  }
}

export function setDebug(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY_DEBUG, '1')
    else localStorage.removeItem(KEY_DEBUG)
  } catch {
    /* ignore */
  }
}

export interface BugReport {
  text: string
  screen: string
  ctx: string
  at: string
  build: string
  issue?: number // numéro du ticket GitHub créé (si la boucle auto a marché)
  url?: string // lien du ticket
}

export function getReports(): BugReport[] {
  try {
    return JSON.parse(localStorage.getItem(KEY_REPORTS) ?? '[]') as BugReport[]
  } catch {
    return []
  }
}

export function addReport(r: BugReport) {
  const all = getReports()
  all.unshift(r)
  try {
    localStorage.setItem(KEY_REPORTS, JSON.stringify(all.slice(0, 50)))
  } catch {
    /* ignore */
  }
}

/** Rattache le numéro de ticket GitHub à la dernière remontée envoyée. */
export function attachIssueToLatest(issue: number, url?: string) {
  const all = getReports()
  if (!all.length) return
  all[0] = { ...all[0], issue, url }
  try {
    localStorage.setItem(KEY_REPORTS, JSON.stringify(all.slice(0, 50)))
  } catch {
    /* ignore */
  }
}

export function clearReports() {
  try {
    localStorage.removeItem(KEY_REPORTS)
  } catch {
    /* ignore */
  }
}

/**
 * Détecte si le build courant est différent du dernier vu (nouvelle version
 * déployée). Met à jour la référence et renvoie true la première fois qu'on voit
 * un nouveau build.
 */
export function checkNewBuild(): boolean {
  try {
    const last = localStorage.getItem(KEY_LASTBUILD)
    if (last !== BUILD_ID) {
      localStorage.setItem(KEY_LASTBUILD, BUILD_ID)
      return last !== null // pas de notif au tout premier lancement
    }
  } catch {
    /* ignore */
  }
  return false
}
