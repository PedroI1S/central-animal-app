import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// API_PORT permite apontar o front de desenvolvimento para outra API (ex.: uma instância de teste na 3001).
const API = `http://localhost:${process.env.API_PORT ?? 3000}`

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // node_modules é um link para node_modules.nosync (fora do iCloud); sem isto o Vite não reconhece as dependências.
  resolve: { preserveSymlinks: true },
  // Com preserveSymlinks o pacote do monorepo parece dependência externa e o Vite o pré-empacota em cache:
  // mudanças em packages/triagem não chegavam ao dev server. Excluído, ele é servido do código-fonte.
  optimizeDeps: { exclude: ['@ca/triagem'] },
  server: {
    host: true,
    allowedHosts: true, // túnel (ngrok / cloudflared) em desenvolvimento
    proxy: {
      '/api': API,
      '/uploads': API,
    },
  },
})
