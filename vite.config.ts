import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('maplibre-gl') || id.includes('react-map-gl')) {
            return 'maplibre';
          }
          if (id.includes('framer-motion')) {
            return 'motion';
          }
          if (id.includes('about.json')) {
            return 'about-data';
          }
        },
      },
    },
  },
})
