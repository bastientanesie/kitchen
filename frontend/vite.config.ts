import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    allowedHosts: ['host.docker.internal'],
    proxy: (() => {
      const target = process.env.BACKEND_URL ?? 'http://localhost:3000'
      const prefixes = [
        '/households',
        '/auth',
        '/webauthn',
        '/device-pairing',
        '/cooking-modes',
        '/ingredients',
      ]
      return Object.fromEntries(prefixes.map((prefix) => [prefix, target]))
    })(),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
