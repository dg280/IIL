import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// identifiant de build (change à chaque déploiement) → détection fiable de nouvelle version
const BUILD_ID = 'b' + Date.now().toString(36)
const BUILD_AT = new Date().toISOString()

// écrit dist/version.json : lu « frais » par l'app pour savoir si une nouvelle version
// est déployée (JSON non précaché par workbox → toujours à jour au fetch)
function emitVersion() {
  return {
    name: 'emit-version',
    generateBundle() {
      // @ts-expect-error emitFile est fourni par le contexte du plugin Rollup
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID, at: BUILD_AT }) })
    },
  }
}

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
    __BUILD_AT__: JSON.stringify(BUILD_AT),
  },
  plugins: [
    react(),
    emitVersion(),
    VitePWA({
      // auto-update : les nouvelles versions s'appliquent toutes seules (au rechargement).
      // Le suivi de version dans la coccinelle (version.json + badge + retour arrière)
      // reste un filet de sécurité, sans bloquer la mise à jour automatique.
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      workbox: {
        // le modèle de modération d'image (nsfwjs, ~3.5 Mo) n'est PAS précaché :
        // il se charge à la demande (1re génération de portrait) puis reste en
        // cache navigateur. Évite de télécharger 3.5 Mo au 1er lancement.
        globIgnores: ['**/*.min-*.js'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      manifest: {
        name: "Célestine — Studio d'histoires",
        short_name: 'Célestine',
        description: 'Crée, joue et partage tes propres otome games',
        lang: 'fr',
        theme_color: '#f6a8c8',
        background_color: '#fdf3f8',
        display: 'standalone',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})
