import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  server: {
    host: '0.0.0.0',
    proxy: Object.fromEntries(
      [
        '/api',
        '/sanctum',
        '/login',
        '/logout',
        '/register',
        '/forgot-password',
        '/reset-password',
        '/email',
        '/user',
        '/two-factor-challenge',
        '/ingest',
        '/up',
        '/pending-email',
      ].map((prefix) => [
        prefix,
        {
          target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000',
          changeOrigin: false,
          bypass: (request: { method?: string }) =>
            request.method === 'GET' && ['/forgot-password', '/reset-password'].includes(prefix)
              ? '/index.html'
              : undefined,
        },
      ]),
    ),
  },
})
