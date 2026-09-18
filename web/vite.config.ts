import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // node_modules é um link para node_modules.nosync (fora do iCloud); sem isto o Vite não reconhece as dependências.
  resolve: { preserveSymlinks: true },
  server: {
    host: true,
    allowedHosts: true, // túnel (ngrok / cloudflared) em desenvolvimento
    proxy: {
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
    },
  },
})
