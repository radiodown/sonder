import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// base './' 로 두면 username.github.io/<아무 저장소명>/ 어디에 올려도 동작합니다 (HashRouter 사용).
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      pwaAssets: { image: 'public/icon.svg', preset: 'minimal-2023', overrideManifestIcons: true },
      manifest: {
        name: 'Library',
        short_name: 'Library',
        description: '나만의 책장',
        lang: 'ko',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        background_color: '#0b0d12',
        theme_color: '#0b0d12',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: { cacheName: 'covers', expiration: { maxEntries: 500 } },
          },
        ],
      },
    }),
  ],
})
