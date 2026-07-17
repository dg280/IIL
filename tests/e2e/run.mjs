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
const ready = new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('vite preview ne démarre pas')), 20000)
  server.stdout.on('data', (d) => {
    if (String(d).includes('Local:')) {
      clearTimeout(t)
      resolve()
    }
  })
  server.on('exit', (code) => reject(new Error(`vite preview terminé (code ${code})`)))
})

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
