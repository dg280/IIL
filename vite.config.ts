import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  define: {
    // identifiant de build (change à chaque déploiement) → détection de nouvelle version
    __BUILD_ID__: JSON.stringify('b' + Date.now().toString(36)),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
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
