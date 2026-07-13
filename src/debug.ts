/**
 * Mode debug : activable depuis le splash. Quand il est actif, une bulle 🐞
 * flottante permet à la testeuse (Rose) de remonter bugs & demandes de modif
 * avec le contexte du moment, et la création n'a pas de coût en gemmes.
 */

const KEY_DEBUG = 'celestine.debug'
const KEY_REPORTS = 'celestine.bugreports'
const KEY_LASTBUILD = 'celestine.lastbuild'

export const BUILD_ID: string = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev'

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
