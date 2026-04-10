import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  envDir: __dirname,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    // Mapbox is intentionally isolated and only loaded on map flows; keep warning noise low.
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) return 'react-vendor'
          if (id.includes('node_modules/react-router')) return 'router'

          // Keep map stack isolated and split heavy map libraries for faster parse.
          if (id.includes('/node_modules/mapbox-gl/')) return 'mapbox-core'
          if (id.includes('/node_modules/react-map-gl/')) return 'mapbox-react'
          if (id.includes('/node_modules/@mapbox/')) return 'mapbox-sdk'

          // QR/check-in libs are heavy and only used in settings flows.
          if (
            id.includes('/node_modules/html5-qrcode/') ||
            id.includes('/node_modules/react-qr-code/')
          ) {
            return 'qr-tools'
          }
        },
      },
    },
  },
})
