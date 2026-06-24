import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Inventario de Laboratorios',
        short_name: 'Inventario Lab',
        description:
          'Sistema de control de inventario para estaciones de trabajo de laboratorios.',
        theme_color: '#0f172a',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '/',
      },
    }),
  ],
})