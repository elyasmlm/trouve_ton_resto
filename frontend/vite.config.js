import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      // accessible depuis le téléphone via l'IP du PC (même Wi-Fi)
      host: true,
      // les appels /api passent par Vite : pas de CORS, et ça marche aussi depuis le téléphone
      proxy: {
        '/api': env.VITE_PROXY_TARGET || 'http://localhost:3001',
        // photos envoyées par les utilisateurs
        '/uploads': env.VITE_PROXY_TARGET || 'http://localhost:3001',
      },
    },
  }
})