// Orchestrateur e2e : sert dist/ (vite preview), lance les deux bancs, code de
// sortie non nul au moindre échec. Prérequis : `npm run build` déjà passé.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runFilterSuite } from './filter.mjs'
import { runSafetySuite } from './safety.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const PORT = 4181
const BASE = `http://localhost:${PORT}/`

if (!existsSync(root + 'dist/index.html')) {
  console.error('dist/ absent — lance `npm run build` avant `npm run test:e2e`.')
  process.exit(1)
}

// detached + kill du groupe : `npx` spawn vite en petit-fils, un kill simple le laisserait vivant (port occupé au run suivant)
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe', detached: true })
// tout ce que dit le serveur est gardé pour le diagnostic (essentiel en CI)
let serverOutput = ''
server.stdout.on('data', (d) => (serverOutput += String(d)))
server.stderr.on('data', (d) => (serverOutput += String(d)))
let serverExited = null
server.on('exit', (code) => (serverExited = code ?? -1))

// disponibilité par POLLING HTTP : parser la bannière stdout de vite est
// fragile hors TTY (CI) — on demande directement à la porte.
async function waitReady(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (serverExited !== null) throw new Error(`vite preview terminé (code ${serverExited})\n--- sortie serveur ---\n${serverOutput}`)
    try {
      const res = await fetch(BASE, { signal: AbortSignal.timeout(2000) })
      if (res.ok) return
    } catch {
      /* pas encore prêt */
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error(`vite preview ne répond pas après ${timeoutMs / 1000}s\n--- sortie serveur ---\n${serverOutput}`)
}
const ready = waitReady()

let fails = 0
try {
  await ready
  console.log('— banc 1/2 : filtre d’images par zones —')
  fails += await runFilterSuite()
  console.log('— banc 2/2 : pipeline de sécurité (UI réelle, API simulée) —')
  fails += await runSafetySuite(BASE)
} catch (e) {
  console.error(String(e))
  fails += 1
} finally {
  try {
    process.kill(-server.pid, 'SIGTERM')
  } catch {
    server.kill()
  }
}
console.log(fails ? `\nE2E : ${fails} ÉCHEC(S)` : '\nE2E : TOUT VERT')
process.exit(fails ? 1 : 0)
