import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
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
        ],
      },
    }),
  ],
})
