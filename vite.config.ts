import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// 本地后端（wrangler dev）；可用 DIDA_API_PROXY 覆盖
const API_TARGET = process.env.DIDA_API_PROXY ?? 'http://127.0.0.1:3000'
const proxy = {
  '/api': { target: API_TARGET, changeOrigin: true },
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  // Relative paths so assets load in Capacitor Android WebView
  base: './',
  server: {
    proxy,
  },
  preview: {
    proxy,
  },
})
