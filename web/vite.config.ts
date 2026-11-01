import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    basicSsl(), // Automatically generates and trusts local SSL cert
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react'
            }
            if (id.includes('framer-motion')) {
              return 'vendor-motion'
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons'
            }
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '^/(api|auth|users|events|forms|registrations|announcements|brackets|matches|leaderboard|leaderboards|points|lots|auction|feedback|contact|media|albums|uploads)': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        // Page loads share these prefixes with the API (/auth/callback, a reload on /events):
        // a browser navigation gets the SPA, only API calls are proxied.
        bypass: (req) => (req.headers.accept?.includes('text/html') ? '/index.html' : undefined),
      },
    },
  },
})
